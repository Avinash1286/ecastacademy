import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as Cert from '../../convex/certificates'

// Minimal Id alias for convenience in tests
type Id<T extends string> = string

type Tables = {
  certificatesFirst?: any | null
  certificatesByUser?: any[]
  certificatesByCertificateId?: any | null
  chapters?: any[]
  // Sequence of content items collect results per chapter in call order
  contentItemsPerChapter?: any[][]
  progressRecords?: any[]
  course?: any | null
  user?: any | null
}

// Very small stub of Convex ctx used by handlers
function makeCtx(tables: Tables) {
  const inserted: any[] = []
  let contentItemsCollectIdx = 0

  const ctx = {
    db: {
      query: (table: string) => ({
        withIndex: (_name: string, _cb: any) => ({
          async first() {
            if (table === 'certificates') {
              // used by checkEligibility (by_userId_courseId) and getCertificate (by_certificateId)
              return tables.certificatesFirst ?? tables.certificatesByCertificateId ?? null
            }
            return null
          },
          async collect() {
            if (table === 'chapters') {
              return tables.chapters ?? []
            }
            if (table === 'contentItems') {
              const list = tables.contentItemsPerChapter?.[contentItemsCollectIdx++] ?? []
              return list
            }
            if (table === 'progress') {
              return tables.progressRecords ?? []
            }
            if (table === 'certificates') {
              // for getUserCertificates (by_userId)
              return tables.certificatesByUser ?? []
            }
            return []
          },
        }),
      }),
      async get(id: Id<any>) {
        // Heuristics: treat values starting with 'course' as course ids, 'user' as user ids
        if ((id as string).startsWith('course')) return tables.course ?? null
        if ((id as string).startsWith('user')) return tables.user ?? null
        return null
      },
      async insert(_table: string, doc: any) {
        inserted.push(doc)
        return 'new-id'
      },
      async patch() { /* not used in these tests */ },
      async delete() { /* not used in these tests */ },
    },
    scheduler: {
      async runAfter(_delay: number, _fn: any, _args: any) {
        // noop; assertions can monkey-patch this if needed
      },
    },
  }

  return { ctx, inserted }
}

let realNow: () => number

beforeEach(() => {
  realNow = Date.now
  // Freeze time for deterministic certificateId and timestamps
  Date.now = () => 1_700_000_000_000
})

afterEach(() => {
  Date.now = realNow
})

describe('convex/certificates:checkEligibility', () => {
  const userId: Id<'users'> = 'user-1'
  const courseId: Id<'courses'> = 'course-1'

  test('returns alreadyIssued when certificate exists', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: { certificateId: 'cert-123' },
    })
    // @ts-expect-error accessing internal handler for unit testing
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.deepEqual(res, { alreadyIssued: true, certificateId: 'cert-123' })
  })

  test('not a certification course', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: false, name: 'Course A' },
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, false)
    assert.match(res.reason, /Not a certification course/)
  })

  test('no graded items in course', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: true, name: 'C1' },
      chapters: [{ _id: 'ch-1' }],
      contentItemsPerChapter: [[{ _id: 'i-1', isGraded: false }]],
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, false)
    assert.match(res.reason, /No graded items/)
  })

  test('requires all graded items to be attempted', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: true, name: 'C1' },
      chapters: [{ _id: 'ch-1' }],
      contentItemsPerChapter: [[{ _id: 'i-1', isGraded: true, maxPoints: 100 }]],
      progressRecords: [], // no attempts
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, false)
    assert.match(res.reason, /Not all graded items attempted/)
  })

  test('fails when any graded item not passed', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: true, name: 'C1', passingGrade: 70 },
      chapters: [{ _id: 'ch-1' }],
      contentItemsPerChapter: [[{ _id: 'i-1', isGraded: true, maxPoints: 100 }]],
      progressRecords: [
        { contentItemId: 'i-1', percentage: 60, _creationTime: 1, lastAttemptAt: 2, attempts: 1, completed: false, progressPercentage: 60 },
      ],
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, false)
    assert.match(res.reason, /graded item\(s\) not passed/)
  })

  test('overall grade below passingGrade even if per-item passingScore lower', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: true, name: 'C1', passingGrade: 70 },
      chapters: [{ _id: 'ch-1' }],
      contentItemsPerChapter: [[{ _id: 'i-1', isGraded: true, maxPoints: 100, passingScore: 50 }]],
      progressRecords: [
        { contentItemId: 'i-1', percentage: 60, _creationTime: 1, lastAttemptAt: 2, attempts: 1, completed: true, progressPercentage: 60, latestPassed: true },
      ],
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, false)
    assert.match(res.reason, /Overall grade .* below passing grade 70%/)
  })

  test('user must exist to issue certificate', async () => {
    const { ctx } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: true, name: 'C1', passingGrade: 70 },
      chapters: [{ _id: 'ch-1' }],
      contentItemsPerChapter: [[{ _id: 'i-1', isGraded: true, maxPoints: 100 }]],
      progressRecords: [
        { contentItemId: 'i-1', percentage: 80, _creationTime: 1, lastAttemptAt: 2, attempts: 1, completed: true, progressPercentage: 100, latestPassed: true },
      ],
      user: null,
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, false)
    assert.match(res.reason, /User not found/)
  })

  test('successfully issues certificate when eligible', async () => {
    const { ctx, inserted } = makeCtx({
      certificatesFirst: null,
      course: { _id: courseId, isCertification: true, name: 'C1', passingGrade: 70 },
      chapters: [{ _id: 'ch-1' }],
      contentItemsPerChapter: [[{ _id: 'i-1', isGraded: true, maxPoints: 100 }]],
      progressRecords: [
        { contentItemId: 'i-1', percentage: 90, _creationTime: 1, lastAttemptAt: 2, attempts: 1, completed: true, progressPercentage: 100, latestPassed: true },
      ],
      user: { _id: userId, email: 'u@example.com', name: 'User' },
    })
    // @ts-expect-error
    const res = await (Cert.checkEligibility as any).handler(ctx, { userId, courseId })
    assert.equal(res.eligible, true)
    assert.equal(res.issued, true)
    assert.ok(typeof res.certificateId === 'string' && res.certificateId.length > 0)
    assert.ok(res.overallGrade >= 70)

    // ensure an insert took place
    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].courseId, courseId)
    assert.equal(inserted[0].userId, userId)
    assert.equal(inserted[0].courseName, 'C1')
  })
})

describe('convex/certificates:getUserCertificates', () => {
  test('sorts by completionDate descending', async () => {
    const { ctx } = makeCtx({
      certificatesByUser: [
        { certificateId: 'c1', completionDate: 100 },
        { certificateId: 'c2', completionDate: 300 },
        { certificateId: 'c3', completionDate: 200 },
      ],
    })
    // @ts-expect-error
    const res = await (Cert.getUserCertificates as any).handler(ctx, { userId: 'user-1' })
    assert.deepEqual(res.map((c: any) => c.certificateId), ['c2', 'c3', 'c1'])
  })
})

describe('convex/certificates:getCertificate', () => {
  test('returns certificate when found', async () => {
    const { ctx } = makeCtx({
      certificatesByCertificateId: { certificateId: 'c-xyz', completionDate: 123 },
    })
    // @ts-expect-error
    const cert = await (Cert.getCertificate as any).handler(ctx, { certificateId: 'c-xyz' })
    assert.equal(cert.certificateId, 'c-xyz')
  })

  test('throws when not found', async () => {
    const { ctx } = makeCtx({
      certificatesByCertificateId: null,
    })
    await assert.rejects(
      // @ts-expect-error
      () => (Cert.getCertificate as any).handler(ctx, { certificateId: 'missing' }),
      /Certificate not found/
    )
  })
})

describe('convex/certificates:manualCheckEligibility', () => {
  test('schedules internal check', async () => {
    let called = 0
    let delaySeen = -1
    let argsSeen: any = null

    const { ctx } = makeCtx({})
    ctx.scheduler.runAfter = async (delay, _fn, args) => {
      called++
      delaySeen = delay
      argsSeen = args
    }

    // @ts-expect-error
    const out = await (Cert.manualCheckEligibility as any).handler(ctx, { userId: 'user-1', courseId: 'course-1' })
    assert.deepEqual(out, { scheduled: true })
    assert.equal(called, 1)
    assert.equal(delaySeen, 0)
    assert.deepEqual(argsSeen, { userId: 'user-1', courseId: 'course-1' })
  })
})