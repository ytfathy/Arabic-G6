// Checks the keyword answer grading in app.js (runs the real functions, cut out of the file). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = src.indexOf('const TASHKEEL'), end = src.indexOf('const wordsOf');
const ctx = {};
vm.runInNewContext(src.slice(start, end) + ';this.kwMatch=kwMatch;', ctx);
const { kwMatch } = ctx;

test('keyword found inside a longer, differently worded answer', () => {
  assert.ok(kwMatch('لأن الوقت يضيع منا', [['يضيع', 'يذهب']]));
});
test('with or without «ال», hamza and taa marbuta', () => {
  assert.ok(kwMatch('هي شفافية ونقاء', [['الشفافيه']]));
  assert.ok(kwMatch('الأمانة', [['امانه']]));
});
test('one typo in a long word is accepted', () => {
  assert.ok(kwMatch('الشفافيت', [['الشفافيه']]));
});
test('phrase keywords match in any order', () => {
  assert.ok(kwMatch('كانت مع نفسها تجلس', [['تجلس مع نفسها']]));
});
test('negation is not dropped: «لا يعود» needs «لا»', () => {
  assert.ok(!kwMatch('الوقت يعود', [['لا يعود']]));
  assert.ok(kwMatch('الوقت لا يعود', [['لا يعود']]));
});
test('wrong answer still wrong', () => {
  assert.ok(!kwMatch('لا أعرف', [['يضيع', 'يذهب']]));
  assert.ok(!kwMatch('', [['*']]));
});
test('two of three keyword groups is enough', () => {
  assert.ok(kwMatch('بفتوحها وعلومها', [['فتوح'], ['علوم'], ['بيان']]));
  assert.ok(!kwMatch('بفتوحها', [['فتوح'], ['علوم'], ['بيان']]));
});
test('strict (spelling) items stay exact', () => {
  assert.ok(!kwMatch('الشفافيت', [['الشفافية']], true));
  assert.ok(!kwMatch('امانة', [['أمانة']], true));
});
