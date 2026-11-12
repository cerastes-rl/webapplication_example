import type { Run } from '../features/transcriptions/run.ts'

export type UploadSettings = {
  requested_speakers: number | null
  include_speaker_labels: boolean
  include_timestamps: boolean
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin', cache: 'no-store', signal,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('Cannot reach the app API. Start it and try again.')
  }
  const result = await response.json().catch(() => {
    throw new Error('Could not complete the request. Check the API logs and try again.')
  })
  if (!response.ok) throw new Error(result.error?.message ?? 'The request failed. Try again.')
  return result as T
}

export function listRecordings(signal?: AbortSignal): Promise<Run[]> {
  return request<Run[]>('runs', undefined, signal)
}

export function authorizeUpload(
  file: File, settings: UploadSettings, signal: AbortSignal
): Promise<{ run: Run; upload_url: string; headers: Record<string, string> }> {
  return request(
    'uploads/authorize', { filename: file.name, size_bytes: file.size, ...settings }, signal
  )
}

export function completeUpload(id: number, signal?: AbortSignal): Promise<Run> {
  return request<Run>('uploads/complete', { run_id: id }, signal)
}

export function cancelUpload(id: number): Promise<Run> {
  return request<Run>(`runs/${id}/cancel`, {})
}

export function failUpload(id: number): Promise<Run> {
  return request<Run>(`runs/${id}/upload-failed`, {})
}

export async function getTranscript(id: number, signal: AbortSignal): Promise<string> {
  return (await request<{ transcript_text: string }>(`runs/${id}/transcript`, undefined, signal)).transcript_text
}

export function putFile(
  file: File, url: string, headers: Record<string, string>, signal: AbortSignal,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    function finish(error?: Error) {
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    if (signal.aborted) {
      reject(new DOMException('Upload aborted.', 'AbortError'))
      return
    }
    xhr.open('PUT', url)
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value)
    xhr.upload.onprogress = (event) => onProgress(Math.min(100, Math.floor(event.loaded / file.size * 100)))
    xhr.onload = () => finish(xhr.status === 201 ? undefined : new Error(`Storage upload failed (${xhr.status}). Check storage or select the file again.`))
    xhr.onerror = () => finish(new Error('Cannot reach storage. Check the storage URL, CORS settings and service.'))
    xhr.onabort = () => finish(new DOMException('Upload aborted.', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    xhr.send(file)
  })
}
