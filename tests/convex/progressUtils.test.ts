import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProgressByContentItem, getBestPercentage, getLastActivityTimestamp } from '../../convex/utils/progressUtils'

type AnyProgress = any

const now = 1_700_000_000_000

function rec(overrides: Partial<AnyProgress> = {}): AnyProgress {
  return {
    _id: 'p1',
    _creationTime: now - 1_000,
    contentItemId: 'ci-1',
    percentage: 50,
    score: 5,
    maxScore: 10,
    bestScore: undefined,
    lastAttemptAt: now - 100,
    completedAt: undefined,
    latestPassed: false,
    passed: false,
    attempts: 1,
    completed: false,
    progressPercentage: 50,
    ...overrides,
  }
}

describe('convex/utils/progressUtils:getBestPercentage', () => {
  test('prefers bestScore if present', () => {
    const r = rec({ bestScore: 88, percentage: 10, score: 2, maxScore: 100 })
    assert.equal(getBestPercentage(r), 88)
  })

  test('falls back to percentage if bestScore absent', () => {
    const r = rec({ bestScore: undefined, percentage: 73 })
    assert.equal(getBestPercentage(r), 73)
  })

  test('derives from score/maxScore when others missing', () => {
    const r = rec({ bestScore: undefined, percentage: undefined, score: 7, maxScore: 14 })
    assert.equal(getBestPercentage(r), 50)
  })

  test('returns 0 when no score information', () => {
    const r = rec({ bestScore: undefined, percentage: undefined, score: undefined, maxScore: undefined })
    assert.equal(getBestPercentage(r), 0)
  })
})

describe('convex/utils/progressUtils:getLastActivityTimestamp', () => {
  test('prefers lastAttemptAt', () => {
    const r = rec({ lastAttemptAt: now - 5, completedAt: now - 10, _creationTime: now - 1000 })
    assert.equal(getLastActivityTimestamp(r), now - 5)
  })
  test('then completedAt', () => {
    const r = rec({ lastAttemptAt: undefined, completedAt: now - 10 })
    assert.equal(getLastActivityTimestamp(r), now - 10)
  })
  test('else creation time', () => {
    const r = rec({ lastAttemptAt: undefined, completedAt: undefined, _creationTime: now - 777 })
    assert.equal(getLastActivityTimestamp(r), now - 777)
  })
})

describe('convex/utils/progressUtils:summarizeProgressByContentItem', () => {
  test('aggregates across multiple entries for the same content item', () => {
    const r1 = rec({ _id: 'p1', _creationTime: now - 1000, contentItemId: 'ci-1', percentage: 40, attempts: 1, progressPercentage: 40, lastAttemptAt: now - 900 })
    const r2 = rec({ _id: 'p2', _creationTime: now - 900, contentItemId: 'ci-1', percentage: 80, attempts: 2, progressPercentage: 80, lastAttemptAt: now - 10, completed: true, completedAt: now - 10, latestPassed: true })
    const r3 = rec({ _id: 'p3', _creationTime: now - 800, contentItemId: 'ci-2', bestScore: 60, attempts: 3, progressPercentage: 60, lastAttemptAt: now - 20 })

    const map = summarizeProgressByContentItem([r1, r2, r3])

    const s1 = map.get('ci-1')!
    assert.ok(s1)
    assert.equal(s1.bestPercentage, 80, 'best percentage should be max across entries')
    assert.equal(s1.attempts, 2, 'attempts should be max observed')
    assert.equal(s1.completed, true, 'should mark completed if any record shows completed')
    assert.equal(s1.progressPercentage, 80, 'should track highest progressPercentage')
    assert.equal(s1.latestPercentage, 80, 'latest should come from most recent activity (r2)')
    assert.equal(s1.latestPassed, true, 'latestPassed propagated from latest record')
    assert.equal(s1.entries.length, 2)

    const s2 = map.get('ci-2')!
    assert.ok(s2)
    assert.equal(s2.bestPercentage, 60)
    assert.equal(s2.attempts, 3)
  })
})