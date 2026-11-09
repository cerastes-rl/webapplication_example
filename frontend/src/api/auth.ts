export type User = {
  id: string
  name: string
}

async function request(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    return await fetch(`/api/auth/${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new Error(
      'Cannot reach the sign-in service. Start the backend and try again.'
    )
  }
}

async function requireSuccess(response: Response): Promise<void> {
  if (response.ok) return
  const body = await response.json().catch(() => null)
  throw new Error(
    body?.error?.message ??
      'The sign-in service could not complete the request. Try again.'
  )
}

async function readUser(response: Response): Promise<User> {
  await requireSuccess(response)
  const user = await response.json().catch(() => null)
  if (
    !user ||
    typeof user.id !== 'string' ||
    user.id.length === 0 ||
    typeof user.name !== 'string'
  ) {
    throw new Error('The sign-in service returned an invalid user. Try again.')
  }
  return { id: user.id, name: user.name }
}

export async function getCurrentUser(
  signal?: AbortSignal
): Promise<User | null> {
  const response = await request('me', { signal })
  if (response.status === 401) {
    return null
  }
  return readUser(response)
}

export async function signIn(accessKey: string): Promise<User> {
  const response = await request('sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_key: accessKey })
  })
  return readUser(response)
}

export async function signOut(): Promise<void> {
  const response = await request('sign-out', { method: 'POST' })
  await requireSuccess(response)
}
