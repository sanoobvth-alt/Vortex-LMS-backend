import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const enabled = process.env.RUN_DATABASE_TESTS === '1';

test('student API database integration: authentication, assessments, progress, and private files', { skip: !enabled }, async () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-that-is-long-enough-32';
  process.env.UPLOAD_DIR ??= '.db-test-uploads';
  const [{ app }, { prisma }, { deletePrivateUpload }] = await Promise.all([
    import('../src/app.js'), import('../src/config/prisma.js'), import('../src/services/privateStorage.js'),
  ]);
  const suffix = Date.now().toString().slice(-10);
  const phone = `+1555${suffix}`;
  const password = 'integration password one';
  const newPassword = 'integration password two';
  const userIds = [];
  const storedKeys = [];

  try {
    const registered = await request(app).post('/api/v1/auth/register').send({ phone, password, fullName: 'Integration Student One', highestQualification: 'DEGREE' });
    assert.equal(registered.status, 202);
    assert.match(registered.body.data.developmentOtp, /^\d{6}$/);
    const createdUser = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    assert.ok(createdUser);
    userIds.push(createdUser.id);
    assert.equal((await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: registered.body.data.developmentOtp })).status, 200);
    const login = await request(app).post('/api/v1/auth/login').send({ phone, password });
    assert.equal(login.status, 200);
    const oldRefreshCookie = login.headers['set-cookie'][0].split(';')[0];
    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldRefreshCookie);
    assert.equal(rotated.status, 200);
    assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', oldRefreshCookie)).status, 401);
    const rotatedCookie = rotated.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request(app).post('/api/v1/auth/logout').set('Cookie', rotatedCookie)).status, 200);
    const forgotten = await request(app).post('/api/v1/auth/forgot-password').send({ phone });
    assert.equal(forgotten.status, 202);
    assert.equal((await request(app).post('/api/v1/auth/reset-password').send({ phone, otp: forgotten.body.data.developmentOtp, newPassword })).status, 200);
    const relogin = await request(app).post('/api/v1/auth/login').send({ phone, password: newPassword });
    assert.equal(relogin.status, 200);
    const token = relogin.body.data.accessToken;
    assert.equal((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`)).status, 200);

    const second = await prisma.user.create({ data: {
      phone: `+1666${suffix}`, passwordHash: 'integration-only-unused-hash', role: 'STUDENT', status: 'ACTIVE', phoneVerifiedAt: new Date(),
      profile: { create: { fullName: 'Integration Student Two', highestQualification: 'PLUS_TWO', studentCode: `INT-${suffix}-2` } },
    } });
    userIds.push(second.id);
    const jwt = (await import('jsonwebtoken')).default;
    const secondToken = jwt.sign({ typ: 'access', role: 'STUDENT' }, process.env.JWT_ACCESS_SECRET, { subject: second.id, expiresIn: '15m', algorithm: 'HS256' });
    const course = await prisma.course.findUnique({ where: { slug: 'sample-web-development-foundations' }, include: { weeks: { orderBy: { weekNumber: 'asc' }, include: { assessments: true } } } });
    assert.ok(course, 'run npm run db:seed before database integration tests');
    const firstProfile = await prisma.studentProfile.findUnique({ where: { userId: createdUser.id }, select: { id: true } });
    const secondProfile = await prisma.studentProfile.findUnique({ where: { userId: second.id }, select: { id: true } });
    const firstEnrollment = await prisma.enrollment.create({ data: { studentId: firstProfile.id, courseId: course.id } });
    const secondEnrollment = await prisma.enrollment.create({ data: { studentId: secondProfile.id, courseId: course.id } });
    assert.equal((await request(app).get('/api/v1/courses').set('Authorization', `Bearer ${token}`)).status, 200);
    assert.equal((await request(app).get(`/api/v1/enrollments/${secondEnrollment.id}`).set('Authorization', `Bearer ${token}`)).status, 404);
    assert.equal((await request(app).get(`/api/v1/enrollments/${firstEnrollment.id}/weeks`).set('Authorization', `Bearer ${token}`)).status, 200);
    assert.equal((await request(app).get('/api/v1/progress').set('Authorization', `Bearer ${token}`)).body.data.courses[0].progressPercent, 0);

    const assessment = course.weeks[1].assessments[0];
    const assessmentView = await request(app).get(`/api/v1/assessments/${assessment.id}`).set('Authorization', `Bearer ${token}`);
    assert.equal(assessmentView.status, 200);
    assert.equal('isCorrect' in assessmentView.body.data.assessment.questions[0].options[0], false);
    const attempt = await request(app).post(`/api/v1/assessments/${assessment.id}/attempts`).set('Authorization', `Bearer ${token}`);
    assert.equal(attempt.status, 201);
    const answers = [];
    for (const question of assessmentView.body.data.assessment.questions) {
      const correct = await prisma.assessmentOption.findFirst({ where: { questionId: question.id, isCorrect: true }, select: { id: true } });
      answers.push({ questionId: question.id, selectedOptionId: correct.id });
    }
    const badAnswers = await request(app).put(`/api/v1/attempts/${attempt.body.data.attempt.id}/answers`).set('Authorization', `Bearer ${token}`).send({ answers: [{ questionId: '00000000-0000-4000-8000-000000000099', answerText: 'outside' }] });
    assert.equal(badAnswers.status, 400);
    assert.equal((await request(app).put(`/api/v1/attempts/${attempt.body.data.attempt.id}/answers`).set('Authorization', `Bearer ${token}`).send({ answers })).status, 200);
    assert.equal((await request(app).post(`/api/v1/attempts/${attempt.body.data.attempt.id}/submit`).set('Authorization', `Bearer ${token}`)).status, 200);
    const result = await request(app).get(`/api/v1/attempts/${attempt.body.data.attempt.id}/result`).set('Authorization', `Bearer ${token}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.result.status, 'EVALUATED');
    assert.equal(Number(result.body.data.result.score), 2);
    assert.equal((await request(app).get(`/api/v1/attempts/${attempt.body.data.attempt.id}/result`).set('Authorization', `Bearer ${secondToken}`)).status, 404);
    assert.equal((await request(app).get('/api/v1/progress').set('Authorization', `Bearer ${token}`)).body.data.courses[0].progressPercent, 100);
    assert.equal((await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${token}`)).status, 200);

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/jREAAAAASUVORK5CYII=', 'base64');
    const uploaded = await request(app).post('/api/v1/profile/documents').set('Authorization', `Bearer ${token}`).field('documentType', 'PASSPORT').attach('file', png, { filename: 'sample.png', contentType: 'image/png' });
    assert.equal(uploaded.status, 201);
    const documentKey = uploaded.body.data.document.downloadUrl.split('/').at(-1);
    storedKeys.push(documentKey);
    assert.equal((await request(app).get(`/api/v1/files/${documentKey}`).set('Authorization', `Bearer ${token}`)).status, 200);
    assert.equal((await request(app).get(`/api/v1/files/${documentKey}`).set('Authorization', `Bearer ${secondToken}`)).status, 404);
  } finally {
    for (const key of storedKeys) await deletePrivateUpload(key).catch(() => {});
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
