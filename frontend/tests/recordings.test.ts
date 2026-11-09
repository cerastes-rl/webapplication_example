import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { authorizeUpload, completeUpload, listRecordings, putFile } from '../src/api/recordings.ts'

const stored = {
  run_id: 12, filename: 'fixture.txt', size_bytes: 5, created_at: '2026-11-09T12:00:00Z', updated_at: '2026-11-09T12:00:00Z',
  language: 'en-US', requested_speakers: null, include_speaker_labels: true,
  include_timestamps: false, upload_stage: 'uploading', transcription_stage: 'not_started', error_message: null
}
afterEach(() => mock.restoreAll())

test('History loads the whole owned list in one request without renaming fields', async () => {
  const requests: string[] = []
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    requests.push(url)
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.cache, 'no-store')
    return Response.json(Array.from({ length: 105 }, (_, i) => ({ ...stored, run_id: i + 1 })))
  })
  const runs = await listRecordings()
  assert.equal(runs.length, 105)
  assert.deepEqual(requests, ['/api/runs'])
  assert.equal(runs[0].requested_speakers, null)
  assert.equal(runs[0].include_timestamps, false)
})

test('authorization sends only file metadata and settings', async () => {
  const controller = new AbortController()
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/uploads/authorize')
    assert.equal(options.signal, controller.signal)
    assert.deepEqual(JSON.parse(String(options.body)), {
      filename: 'fixture.txt', size_bytes: 5,
      requested_speakers: 3, include_speaker_labels: false, include_timestamps: true
    })
    return Response.json({ run: stored, upload_url: 'http://storage/blobs/generated.txt', headers: { 'x-ms-blob-type': 'BlockBlob' } })
  })
  const result = await authorizeUpload(new File(['hello'], 'fixture.txt'), {
    requested_speakers: 3, include_speaker_labels: false, include_timestamps: true
  }, controller.signal)
  assert.equal(result.run.run_id, 12)
  assert.equal(result.upload_url, 'http://storage/blobs/generated.txt')
})

test('completion checks the existing run and reports verification errors', async () => {
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/uploads/complete')
    assert.deepEqual(JSON.parse(String(options.body)), { run_id: 12 })
    return Response.json({ error: { message: 'No stored file yet.' } }, { status: 409 })
  })
  await assert.rejects(completeUpload(12), /No stored file yet/)

})

test('XHR sends the File directly to storage, measures bytes and supports abort', async () => {
  const original = globalThis.XMLHttpRequest
  class FakeXHR {
    static instances: FakeXHR[] = []
    upload = { onprogress: undefined as undefined | ((event: { loaded: number }) => void) }
    headers: Record<string, string> = {}
    status = 201
    onload = () => {}
    onerror = () => {}
    onabort = () => {}
    sent?: File
    url = ''
    constructor() { FakeXHR.instances.push(this) }
    open(method: string, url: string) { assert.equal(method, 'PUT'); this.url = url }
    setRequestHeader(key: string, value: string) { this.headers[key] = value }
    send(file: File) { this.sent = file }
    abort() { this.onabort() }
  }
  const current = () => FakeXHR.instances.at(-1)!
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest
  try {
    const file = new File(['hello'], 'fixture.txt')
    const controller = new AbortController()
    const progress: number[] = []
    const transfer = putFile(file, 'http://storage/blobs/file.txt', { 'x-ms-blob-type': 'BlockBlob' }, controller.signal, (value) => progress.push(value))
    assert.equal(current().url, 'http://storage/blobs/file.txt')
    assert.equal(current().sent, file)
    assert.equal(current().headers['x-ms-blob-type'], 'BlockBlob')
    current().upload.onprogress!({ loaded: 2 })
    assert.deepEqual(progress, [40])
    current().onload()
    await transfer
    const other = new AbortController()
    const cancelled = putFile(file, 'http://storage/blobs/file.txt', {}, other.signal, () => {})
    other.abort()
    await assert.rejects(cancelled, { name: 'AbortError' })
    const failed = putFile(file, 'http://storage/blobs/file.txt', {}, controller.signal, () => {})
    current().status = 413
    current().onload()
    await assert.rejects(failed, /Storage upload failed \(413\)/)
  } finally {
    globalThis.XMLHttpRequest = original
  }
})

test('a failed creation request is not automatically retried', async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async () => {
    calls += 1
    throw new TypeError('Lost response')
  })
  await assert.rejects(authorizeUpload(new File(['hello'], 'fixture.txt'), {
    requested_speakers: null, include_speaker_labels: true, include_timestamps: false
  }, new AbortController().signal), /Cannot reach the app API/)
  assert.equal(calls, 1)
})
