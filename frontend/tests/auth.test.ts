import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { getCurrentUser, signIn, signOut } from '../src/api/auth.ts'

afterEach(() => mock.restoreAll())

test('restores backend user IDs and sends browser session credentials', async () => {
  for (const id of ['austin', 'john', 'another-user']) {
    mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      assert.equal(url, '/api/auth/me')
      assert.equal(options.credentials, 'same-origin')
      assert.equal(options.cache, 'no-store')
      return Response.json({ id, name: 'Test User' })
    })
    assert.equal((await getCurrentUser())?.id, id)
    mock.restoreAll()
  }
})

test('an unknown or expired session restores as signed out', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }))
  assert.equal(await getCurrentUser(), null)
})

test('sign-in sends the entered key and reports invalid-key errors', async () => {
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/auth/sign-in')
    assert.equal(options.method, 'POST')
    assert.equal(options.body, JSON.stringify({ access_key: 'wrong' }))
    return Response.json({ error: { code: 'unauthorized', message: 'Invalid access key.' } }, { status: 401 })
  })
  await assert.rejects(signIn('wrong'), /Invalid access key/)
})

test('rejects malformed session responses', async () => {
  for (const body of [{ id: '', name: 'User' }, { id: 123, name: 'User' }, { name: 'User' }, { id: 'austin' }, { id: 'austin', name: 123 }, null]) {
    mock.method(globalThis, 'fetch', async () => Response.json(body))
    await assert.rejects(getCurrentUser(), /invalid user/)
    mock.restoreAll()
  }
})

test('backend outages provide an actionable error and aborted checks stay aborted', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(getCurrentUser(), /Start the backend and try again/)
  mock.restoreAll()
  const controller = new AbortController()
  controller.abort()
  const abort = new DOMException('Aborted', 'AbortError')
  mock.method(globalThis, 'fetch', async () => { throw abort })
  await assert.rejects(getCurrentUser(controller.signal), error => error === abort)
})

test('sign-out posts to the server and reports failure instead of claiming success', async () => {
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/auth/sign-out')
    assert.equal(options.method, 'POST')
    return new Response(null, { status: 204 })
  })
  await signOut()
  mock.restoreAll()
  mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }))
  await assert.rejects(signOut(), /could not complete/)
})
