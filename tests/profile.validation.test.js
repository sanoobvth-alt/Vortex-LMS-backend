import test from 'node:test';
import assert from 'node:assert/strict';
import { updateProfileSchema } from '../src/modules/profile/profile.validation.js';
import { buildProfileUpdate } from '../src/modules/profile/profile.service.js';

const current = { fullName: 'Alex Student', highestQualification: 'DEGREE', otherQualification: null };

test('profile updates allow only editable fields and reject empty bodies', () => {
  assert.equal(updateProfileSchema.safeParse({ fullName: 'Alex Updated' }).success, true);
  assert.equal(updateProfileSchema.safeParse({ role: 'ADMIN' }).success, false);
  assert.equal(updateProfileSchema.safeParse({}).success, false);
});

test('profile update clears other qualification when selecting a standard qualification', () => {
  assert.deepEqual(buildProfileUpdate({ ...current, highestQualification: 'OTHER', otherQualification: 'Certificate' }, { highestQualification: 'DEGREE' }), {
    highestQualification: 'DEGREE', otherQualification: null,
  });
});

test('profile update requires other qualification when switching to OTHER', () => {
  assert.throws(() => buildProfileUpdate(current, { highestQualification: 'OTHER' }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(buildProfileUpdate(current, { highestQualification: 'OTHER', otherQualification: 'Certificate' }), {
    highestQualification: 'OTHER', otherQualification: 'Certificate',
  });
});
