"""Persisted worker transitions and per-run failures, without background races."""

import sqlite3
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import database, processing, speech_client


class ProcessingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'app.db'
        database.initialize_database(self.path)
        self.stop = threading.Event()

    def add_run(self, upload='completed', stage='not_started', job_id=None, raw=None):
        with database.connect(self.path) as connection:
            return connection.execute(
                """INSERT INTO runs (owner_id, filename, storage_key, upload_stage,
                    transcription_stage, speech_job_id, speech_status)
                    VALUES ('austin', 'source.txt', 'source.txt', ?, ?, ?, ?)""",
                (upload, stage, job_id, raw),
            ).lastrowid

    def row(self, run_id):
        return database.upload_record(self.path, 'austin', run_id)

    def cycle(self):
        processing.process_cycle(self.path, self.stop)

    def test_every_eligible_run_is_submitted_once_and_polling_uses_saved_ids(self):
        ids = [self.add_run(), self.add_run()]
        excluded = [self.add_run(upload='uploading'), self.add_run(upload='cancelled'),
                    self.add_run(stage='submission_uncertain')]
        def submit(run):
            # Claim is durable and no SQL transaction is held across HTTP.
            self.assertEqual(self.row(run['run_id'])['transcription_stage'], 'submission_uncertain')
            with database.connect(self.path) as connection:
                connection.execute('UPDATE runs SET error_message = NULL WHERE run_id = ?', (run['run_id'],))
            return f"job-{run['run_id']}", {'status': 'NotStarted'}
        with patch.object(speech_client, 'submit', side_effect=submit) as send, \
                patch.object(speech_client, 'poll', return_value={'status': 'Running'}) as poll:
            self.cycle()
            self.cycle()
        self.assertEqual([call.args[0]['run_id'] for call in send.call_args_list], ids)
        self.assertEqual([call.args[0] for call in poll.call_args_list], [f'job-{i}' for i in ids] * 2)
        self.assertTrue(all(self.row(i)['transcription_stage'] == 'running' for i in ids))
        self.assertTrue(all(self.row(i)['speech_job_id'] is None for i in excluded))

    def test_lost_submission_is_uncertain_without_retry_and_other_runs_continue(self):
        first, second = self.add_run(), self.add_run()
        with patch.object(speech_client, 'submit', side_effect=[
            TimeoutError('response lost'), ('second-job', {'status': 'NotStarted'}),
        ]) as send, patch.object(speech_client, 'poll', return_value={'status': 'NotStarted'}):
            self.cycle()
            self.cycle()
        self.assertEqual(send.call_count, 2)
        self.assertEqual(self.row(first)['transcription_stage'], 'submission_uncertain')
        self.assertIn('response lost', self.row(first)['error_message'])
        self.assertEqual(self.row(second)['transcription_stage'], 'queued')

    def test_poll_errors_do_not_block_other_jobs_and_terminal_jobs_stop_polling(self):
        unavailable = self.add_run(stage='running', job_id='unavailable', raw='Running')
        missing = self.add_run(stage='queued', job_id='missing', raw='NotStarted')
        failed = self.add_run(stage='running', job_id='failed', raw='Running')
        ready = self.add_run(stage='running', job_id='ready', raw='Running')
        def poll(job_id):
            if job_id == 'unavailable':
                raise URLError('offline')
            if job_id == 'missing':
                raise HTTPError('http://speech/missing', 404, 'Not found', {}, None)
            if job_id == 'failed':
                return {'status': 'Failed', 'properties': {'error': {'message': 'Invalid UTF-8'}}}
            return {'status': 'Succeeded'}
        with patch.object(speech_client, 'poll', side_effect=poll) as fetch, \
                patch.object(speech_client, 'transcript', return_value='Exact text\n') as download:
            self.cycle()
            self.cycle()
        self.assertEqual(fetch.call_count, 5)
        self.assertEqual(self.row(unavailable)['transcription_stage'], 'running')
        self.assertEqual(self.row(missing)['transcription_stage'], 'failed')
        self.assertEqual(self.row(failed)['error_message'], 'Invalid UTF-8')
        self.assertEqual(self.row(ready)['transcript_text'], 'Exact text\n')
        self.assertEqual(self.row(ready)['transcription_stage'], 'completed')
        download.assert_called_once_with('ready')

    def test_import_retries_transient_errors_from_persisted_state(self):
        run_id = self.add_run(stage='importing', job_id='saved-job', raw='Succeeded')
        with patch.object(speech_client, 'poll') as poll, patch.object(speech_client, 'transcript',
                side_effect=[URLError('offline'), 'Recovered transcript']):
            self.cycle()
            self.assertEqual(self.row(run_id)['transcription_stage'], 'importing')
            self.assertIsNone(self.row(run_id)['transcript_text'])
            self.cycle()
        poll.assert_not_called()
        row = self.row(run_id)
        self.assertEqual((row['transcript_text'], row['transcription_stage'], row['error_message']),
                         ('Recovered transcript', 'completed', None))

    def test_missing_results_and_malformed_content_are_recorded(self):
        first = self.add_run(stage='importing', job_id='expired', raw='Succeeded')
        second = self.add_run(stage='importing', job_id='bad-result', raw='Succeeded')
        with patch.object(speech_client, 'transcript', side_effect=[
            HTTPError('http://speech/files', 404, 'Expired', {}, None), ValueError('Invalid result'),
        ]):
            self.cycle()
        for run_id in [first, second]:
            self.assertEqual(self.row(run_id)['transcription_stage'], 'failed')
            self.assertIsNone(self.row(run_id)['transcript_text'])

    def test_result_listing_pagination_and_display_text(self):
        with patch.object(speech_client, 'request_json', side_effect=[
            {'values': [{'kind': 'TranscriptionReport'}], '@nextLink': 'http://speech/page2'},
            {'values': [{'kind': 'Transcription', 'links': {'contentUrl': 'http://speech/result'}}]},
            {'combinedRecognizedPhrases': [{'display': 'First\n'}, {'display': 'Second'}]},
        ]) as fetch:
            self.assertEqual(speech_client.transcript('job'), 'First\n\nSecond')
        self.assertEqual(fetch.call_args_list[1].args[0], 'http://speech/page2')
        self.assertEqual(fetch.call_args_list[2].args[0], 'http://speech/result')

    def test_stopped_cycle_does_not_submit(self):
        self.add_run()
        self.stop.set()
        with patch.object(speech_client, 'submit') as send:
            self.cycle()
        send.assert_not_called()

    def test_worker_does_not_create_an_uninitialized_database(self):
        missing = Path(self.directory.name) / 'missing.db'
        with self.assertRaises(sqlite3.OperationalError):
            processing.process_cycle(missing, self.stop)
        self.assertFalse(missing.exists())
