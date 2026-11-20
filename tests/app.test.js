import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://USER:PASSWORD@localhost:5432/vortex_lms?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-that-is-long-enough-32';

const { app } = await import('../src/app.js');

test('health endpoint reports service status', async () => {
  const response = await request(app).get('/api/v1/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
});

test('auth routes reject malformed input before database access', async () => {
  const response = await request(app).post('/api/v1/auth/login').send({ phone: 'not-e164', password: 'password' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('profile routes require a student token and reject privileged fields before database access', async () => {
  const unauthenticated = await request(app).get('/api/v1/profile');
  assert.equal(unauthenticated.status, 401);

  const token = jwt.sign({ typ: 'access', role: 'STUDENT' }, process.env.JWT_ACCESS_SECRET, { subject: '00000000-0000-4000-8000-000000000001', expiresIn: '15m', algorithm: 'HS256' });
  const forbiddenField = await request(app).patch('/api/v1/profile').set('Authorization', `Bearer ${token}`).send({ role: 'ADMIN' });
  assert.equal(forbiddenField.status, 400);
  assert.equal(forbiddenField.body.error.code, 'VALIDATION_ERROR');
});

test('student module routes validate query and path input before database access', async () => {
  const token = jwt.sign({ typ: 'access', role: 'STUDENT' }, process.env.JWT_ACCESS_SECRET, { subject: '00000000-0000-4000-8000-000000000001', expiresIn: '15m', algorithm: 'HS256' });
  for (const path of ['/api/v1/courses?page=0', '/api/v1/enrollments?pageSize=101', '/api/v1/assessments?page=-1', '/api/v1/notifications?page=0', '/api/v1/progress?page=0']) {
    const response = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 400, path);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR', path);
  }
  const removedLearningRoute = await request(app).get('/api/v1/lessons/not-a-uuid').set('Authorization', `Bearer ${token}`);
  assert.equal(removedLearningRoute.status, 404);
  for (const path of ['/api/v1/lessons', '/api/v1/tasks', '/api/v1/bookmarks']) {
    assert.equal((await request(app).get(path).set('Authorization', `Bearer ${token}`)).status, 404);
  }
  const invalidFileKey = await request(app).get('/api/v1/files/not-a-storage-key').set('Authorization', `Bearer ${token}`);
  assert.equal(invalidFileKey.status, 400);
});
