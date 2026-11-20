import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ??= 'postgresql://USER:PASSWORD@localhost:5432/vortex_lms?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-that-is-long-enough-32';
const { inspectUpload } = await import('../src/services/privateStorage.js');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/jREAAAAASUVORK5CYII=', 'base64');

test('private upload validation checks actual file signature and declared MIME', async () => {
  const detected = await inspectUpload({ buffer: png, size: png.length, mimetype: 'image/png' }, ['image/png']);
  assert.equal(detected.mime, 'image/png');
  await assert.rejects(inspectUpload({ buffer: png, size: png.length, mimetype: 'application/pdf' }, ['application/pdf']), { code: 'INVALID_FILE_TYPE' });
});

test('private upload validation rejects over-limit files before storage', async () => {
  await assert.rejects(inspectUpload({ buffer: Buffer.alloc(1), size: 5_242_881, mimetype: 'image/png' }, ['image/png']), { code: 'FILE_TOO_LARGE' });
});
