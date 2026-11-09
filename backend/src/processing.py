"""One sequential submission, polling and import cycle for persisted runs."""

import logging
import threading
from pathlib import Path
from urllib.error import HTTPError

from src import database, speech_client

logger = logging.getLogger(__name__)
INTERVAL_SECONDS = 2


def process_run(path: Path, run: dict, phase: str) -> None:
    run_id = run['run_id']
    try:
        if phase == 'submit':
            if not database.claim_submission(path, run_id):
                return
            job_id, job = speech_client.submit(run)
        elif phase == 'poll':
            job_id = run['speech_job_id']
            job = speech_client.poll(job_id)
        else:
            text = speech_client.transcript(run['speech_job_id'])
            database.save_transcript(path, run_id, text)
            return
        raw, stage, error = speech_client.status(job)
        database.save_speech_status(path, run_id, job_id, raw, stage, error)
    except Exception as error:
        logger.warning('Speech %s failed for run %s: %s', phase, run_id, error)
        stage = None
        if phase == 'submit':
            # An HTTP rejection confirms no acceptance; all other outcomes are uncertain.
            stage = ('failed' if isinstance(error, HTTPError) and 400 <= error.code < 500
                     and error.code != 408 else 'submission_uncertain')
        elif isinstance(error, HTTPError) and error.code == 404:
            stage = 'failed'
        elif phase == 'import' and isinstance(error, (KeyError, ValueError, TypeError)):
            stage = 'failed'
        database.save_processing_error(path, run_id, f'Speech {phase} failed: {error}', stage)
        if isinstance(error, HTTPError):
            error.close()


def process_cycle(path: Path, stop: threading.Event) -> None:
    for phase in ('submit', 'poll', 'import'):
        if stop.is_set():
            return
        for run in database.processing_runs(path, phase):
            if stop.is_set():
                return
            try:
                process_run(path, run, phase)
            except Exception:
                logger.exception('Could not persist Speech %s for run %s', phase, run['run_id'])


def run_worker(path: Path, stop: threading.Event) -> None:
    while not stop.is_set():
        try:
            process_cycle(path, stop)
        except Exception:
            # Missing/uninitialized databases stay explicit setup errors, never create files.
            logger.exception('Speech processing cycle failed')
        stop.wait(INTERVAL_SECONDS)
