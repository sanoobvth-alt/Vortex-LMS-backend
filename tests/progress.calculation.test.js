import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ??= 'postgresql://USER:PASSWORD@localhost:5432/vortex_lms?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-that-is-long-enough-32';
const { calculateActivityProgress, calculateEnrollmentProgress, calculateStreak } = await import('../src/modules/progress/progress.service.js');

test('course progress counts only published assessment outcomes', () => {
  const percent = calculateActivityProgress([
    { passingMarks: 5, attempts: [{ status: 'EVALUATED', score: 6 }] },
    { passingMarks: 5, attempts: [{ status: 'EVALUATED', score: 4 }] },
  ]);
  assert.equal(percent, 50);
});

test('course and week progress use the same activity calculation', () => {
  const result = calculateEnrollmentProgress({ id: 'enrollment', status: 'ACTIVE', course: { id: 'course', title: 'Course', slug: 'course', durationWeeks: 1, weeks: [{ id: 'week', weekNumber: 1, title: 'Week 1', assessments: [{ passingMarks: 1, attempts: [{ status: 'EVALUATED', score: 1 }] }] }] } });
  assert.equal(result.progressPercent, 100);
  assert.equal(result.weeks[0].progressPercent, 100);
});

test('activity streak counts configured local calendar dates', () => {
  const now = new Date('2026-01-02T12:00:00.000Z');
  assert.equal(calculateStreak([new Date('2026-01-01T23:00:00.000Z'), now], now), 2);
  assert.equal(calculateStreak([new Date('2025-12-31T12:00:00.000Z')], now), 0);
});
