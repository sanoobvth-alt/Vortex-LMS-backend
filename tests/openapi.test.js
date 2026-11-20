import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';

test('OpenAPI document parses and documents the student portal routes', async () => {
  const source = await readFile(new URL('../openapi.yaml', import.meta.url), 'utf8');
  const document = parseDocument(source);
  assert.deepEqual(document.errors, []);
  const spec = document.toJS();
  assert.equal(spec.openapi, '3.1.0');
  for (const path of ['/auth/register', '/profile', '/courses', '/enrollments', '/assessments/{assessmentId}/attempts', '/attempts/{attemptId}/result', '/dashboard', '/notifications', '/progress', '/certificates', '/files/{storageKey}']) {
    assert.ok(spec.paths[path], `missing OpenAPI path ${path}`);
  }
  assert.equal(Object.keys(spec.paths).some((path) => path.includes('admin')), false);
});
