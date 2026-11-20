import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, loginSchema, verifyOtpSchema } from '../src/modules/auth/auth.validation.js';

test('registration accepts normalized phone and never accepts caller supplied role', () => {
  const base = { phone: '+14155552671', password: 'correct horse battery', fullName: 'Alex Student', highestQualification: 'DEGREE' };
  assert.equal(registerSchema.safeParse(base).success, true);
  assert.equal(registerSchema.safeParse({ ...base, role: 'ADMIN' }).success, false);
});

test('registration requires otherQualification only for OTHER', () => {
  const base = { phone: '+14155552671', password: 'correct horse battery', fullName: 'Alex Student', highestQualification: 'OTHER' };
  assert.equal(registerSchema.safeParse(base).success, false);
  assert.equal(registerSchema.safeParse({ ...base, otherQualification: 'Certificate' }).success, true);
});

test('registration rejects bcrypt inputs longer than 72 UTF-8 bytes', () => {
  const base = { phone: '+14155552671', password: `${'🔐'.repeat(19)}abc`, fullName: 'Alex Student', highestQualification: 'DEGREE' };
  assert.equal(registerSchema.safeParse(base).success, false);
});

test('login and OTP validation reject malformed input and unexpected fields', () => {
  assert.equal(loginSchema.safeParse({ phone: '4155552671', password: 'password', extra: true }).success, false);
  assert.equal(verifyOtpSchema.safeParse({ phone: '+14155552671', otp: '12a456' }).success, false);
});
