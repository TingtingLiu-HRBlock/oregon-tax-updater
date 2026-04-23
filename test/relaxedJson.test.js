const test = require('node:test');
const assert = require('node:assert/strict');

const { parseRelaxedJson } = require('../relaxedJson');

test('Relaxed JSON parser: accepts trailing commas in objects and arrays', () => {
  const parsed = parseRelaxedJson(`{
    "name": "Example",
    "items": [
      1,
      2,
    ],
    "meta": {
      "year": 2025,
    },
  }`);

  assert.deepEqual(parsed, {
    name: 'Example',
    items: [1, 2],
    meta: { year: 2025 }
  });
});

test('Relaxed JSON parser: accepts line and block comments', () => {
  const parsed = parseRelaxedJson(`{
    // This is a line comment
    "name": "Federal",
    /* This is a block comment */
    "value": "2023-12-31T00:00:00"
  }`);

  assert.deepEqual(parsed, {
    name: 'Federal',
    value: '2023-12-31T00:00:00'
  });
});

test('Relaxed JSON parser: preserves comment-like text inside strings', () => {
  const parsed = parseRelaxedJson(`{
    "text": "Keep // this text",
    "moreText": "And /* this */ too",
  }`);

  assert.deepEqual(parsed, {
    text: 'Keep // this text',
    moreText: 'And /* this */ too'
  });
});
