import test from 'node:test';
import assert from 'node:assert/strict';
import { answersBody } from '../src/modules/assessments/assessments.validation.js';
import { scoreObjectiveQuestion, studentQuestion } from '../src/modules/assessments/assessments.service.js';

test('answer payloads require unique question IDs and reject reviewer fields', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(answersBody.safeParse({ answers: [{ questionId: id, answerText: 'Answer' }] }).success, true);
  assert.equal(answersBody.safeParse({ answers: [{ questionId: id, answerText: 'Answer', isCorrect: true }] }).success, false);
  assert.equal(answersBody.safeParse({ answers: [{ questionId: id, answerText: 'A' }, { questionId: id, answerText: 'B' }] }).success, false);
});

test('student-facing questions and options do not expose correctness before evaluation', () => {
  const view = studentQuestion({ id: 'q', questionText: 'Q', options: [{ id: 'o', optionText: 'A', isCorrect: true }] });
  assert.deepEqual(view, { id: 'q', questionText: 'Q', options: [{ id: 'o', optionText: 'A' }] });
});

test('objective scoring checks the exact correct option set', () => {
  const question = { questionType: 'MULTIPLE_SELECT', marks: 4, options: [{ id: 'a', isCorrect: true }, { id: 'b', isCorrect: true }, { id: 'c', isCorrect: false }] };
  assert.deepEqual(scoreObjectiveQuestion(question, { answerText: '["a","b"]' }), { isCorrect: true, marksObtained: 4 });
  assert.deepEqual(scoreObjectiveQuestion(question, { answerText: '["a"]' }), { isCorrect: false, marksObtained: 0 });
});
