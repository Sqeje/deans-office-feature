import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSchema } from './schema-text.mjs';

test('Windows and Linux checkouts compare equally', () => {
  assert.equal(normalizeSchema('type A = string;\r\n'), normalizeSchema('type A = string;\n'));
});
test('changed API types still fail comparison', () => {
  assert.notEqual(normalizeSchema('type A = string;\r\n'), normalizeSchema('type A = number;\n'));
});
