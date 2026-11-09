"""HTTP calls to the standalone local Speech mock."""

import json
import os
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


STAGES = {'NotStarted': 'queued', 'Running': 'running', 'Succeeded': 'importing', 'Failed': 'failed'}


def job_url(job_id: str) -> str:
    base = os.environ.get('SSSCRIBE_SPEECH_URL', 'http://127.0.0.1:8002')
    return f"{base.rstrip('/')}/speechtotext/transcriptions/{quote(job_id, safe='')}"


def request_json(url: str, body: dict | None = None) -> dict:
    request = Request(url, data=json.dumps(body).encode() if body is not None else None,
                      headers={'Content-Type': 'application/json'})
    with urlopen(request, timeout=3) as response:
        return json.load(response)


def status(job: dict) -> tuple[str, str, str | None]:
    raw = job['status']
    stage = STAGES[raw]
    error = job.get('properties', {}).get('error', {}).get('message')
    return raw, stage, error if raw == 'Failed' else None


def submit(run: dict) -> tuple[str, dict]:
    base = os.environ.get('SSSCRIBE_SPEECH_URL', 'http://127.0.0.1:8002')
    job = request_json(f"{base.rstrip('/')}/speechtotext/transcriptions:submit", {
        'displayName': run['filename'],
        'locale': run['language'],
        'contentUrls': [f"data/blobs/audio/{run['storage_key']}"],
        'properties': {'destinationContainerUrl': 'data/blobs/transcripts'},
    })
    job_id = urlparse(job['self']).path.rstrip('/').rsplit('/', 1)[-1]
    if not job_id:
        raise ValueError('Speech did not return a job ID.')
    status(job)
    return job_id, job


def poll(job_id: str) -> dict:
    job = request_json(job_url(job_id))
    status(job)
    return job


def transcript(job_id: str) -> str:
    url = job_url(job_id) + '/files'
    while url:
        listing = request_json(url)
        for entry in listing['values']:
            if entry['kind'] == 'Transcription':
                result = request_json(entry['links']['contentUrl'])
                return '\n'.join(phrase['display'] for phrase in result['combinedRecognizedPhrases'])
        url = listing.get('@nextLink')
    raise ValueError('Speech returned no transcription file.')
