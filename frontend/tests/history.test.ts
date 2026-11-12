import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesHistoryFilter } from '../src/features/transcriptions/history.ts'
import type { Run } from '../src/features/transcriptions/run.ts'

test('History filters include active stages and keep failed or cancelled runs in All', () => {
  const stages: [Run['upload_stage'], Run['transcription_stage'], boolean, boolean][] = [
    ['uploading', 'not_started', false, true],
    ['completed', 'not_started', false, false],
    ['completed', 'queued', false, true],
    ['completed', 'running', false, true],
    ['completed', 'importing', false, true],
    ['completed', 'completed', true, false],
    ['failed', 'not_started', false, false],
    ['cancelled', 'not_started', false, false],
    ['completed', 'failed', false, false],
    ['completed', 'submission_uncertain', false, false]
  ]
  for (const [upload_stage, transcription_stage, ready, active] of stages) {
    const run = { upload_stage, transcription_stage }
    assert.equal(matchesHistoryFilter(run, 'all'), true)
    assert.equal(matchesHistoryFilter(run, 'completed'), ready)
    assert.equal(matchesHistoryFilter(run, 'in_progress'), active)
  }
})
