import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, generateToken, validatePassword, validateEmail } from '../../src/lib/auth/utils'

describe('auth/utils', () => {
  test('hashPassword and verifyPassword work for correct and incorrect inputs', async () => {
    const password = 'Aa123456'
    const wrong = 'Aa1234567'

    const hashed = await hashPassword(password)
    assert.notEqual(hashed, password, 'hash should not equal input')

    const ok = await verifyPassword(password, hashed)
    assert.equal(ok, true, 'verify should pass for correct password')

    const bad = await verifyPassword(wrong, hashed)
    assert.equal(bad, false, 'verify should fail for incorrect password')
  })

  test('generateToken should produce valid UUID-like strings and be unique', () => {
    const t1 = generateToken()
    const t2 = generateToken()
    assert.notEqual(t1, t2, 'tokens must be unique')
    // Very loose UUID v4-ish check: 36 chars with dashes in canonical positions
    assert.match(t1, /^[0-9a-fA-F-]{36}$/, 'token should look like a UUID')
  })

  test('validatePassword enforces length, lowercase, uppercase, and numeric rules', () => {
    const tooShort = validatePassword('Aa123')
    assert.equal(tooShort.valid, false)
    assert.ok(tooShort.errors.some(e => /at least 8/i.test(e)))

    const noLower = validatePassword('AAAAAAA1')
    assert.equal(noLower.valid, false)
    assert.ok(noLower.errors.some(e => /lowercase/i.test(e)))

    const noUpper = validatePassword('aaaaaaa1')
    assert.equal(noUpper.valid, false)
    assert.ok(noUpper.errors.some(e => /uppercase/i.test(e)))

    const noNumber = validatePassword('AAAAaaaa')
    assert.equal(noNumber.valid, false)
    assert.ok(noNumber.errors.some(e => /number/i.test(e)))

    const ok = validatePassword('Aa123456')
    assert.equal(ok.valid, true)
    assert.equal(ok.errors.length, 0)
  })

  test('validateEmail accepts common forms and rejects invalid ones', () => {
    assert.equal(validateEmail('user@example.com'), true)
    assert.equal(validateEmail('first.last+tag@sub.domain.co'), true)

    assert.equal(validateEmail('bad@'), false)
    assert.equal(validateEmail('bad@domain'), false)
    assert.equal(validateEmail('bad@@example.com'), false)
    assert.equal(validateEmail('no-at-symbol.example.com'), false)
  })
})