// Word bank MCQs: valid options and correct answers spread over all four positions. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.window = globalThis;
for (const f of ['revision.js', 'wordbank.js']) vm.runInThisContext(fs.readFileSync(new URL('../data/' + f, import.meta.url), 'utf8'));
const src = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const code = src.slice(src.indexOf('WEEK_LABEL.WB='), src.indexOf('function vWords'));
const LKEY = {};
const WB = new Function('LESSONS', 'BLOCK', 'IT', 'WEEK_LABEL', 'LKEY', code + ';return WORD_BANK;')([], {}, {}, {}, LKEY);

test('word bank lessons can be picked in the exam builder', () => {
  for (const L of WB) assert.equal(LKEY['wb-' + L.id].blocks, L.blocks);
});
const items = WB.flatMap(L => L.items.map(x => x.it));

test('every question has 4 different options and a valid answer', () => {
  assert.equal(WB.length, 12);
  for (const it of items) {
    assert.equal(new Set(it.opts).size, 4, it.q);
    assert.ok(it.a >= 0 && it.a < 4, it.q);
  }
});

test('every singular/plural question uses its hand-written wrong options', () => {
  const D = window.WORD_DISTRACTORS;
  const plain = s => s.replace(/[ً-ْ]/g, '');
  const pl = items.filter(it => /^ما (جمع|مفرد) /.test(it.q));
  assert.ok(pl.length > 100);
  for (const it of pl) {
    const word = plain(it.q.match(/«(.+)»/)[1]);
    const wrong = (it.q.startsWith('ما جمع') ? D.pl : D.sg)[word];
    assert.ok(wrong, 'no options for ' + word);
    assert.deepEqual(it.opts.filter((_, i) => i !== it.a).map(plain).sort(), wrong.map(plain).sort(), it.q);
    // tashkeel must not give the answer away
    const vowels = /[ً-ِْ]/;
    if (!vowels.test(it.opts[it.a])) assert.ok(!it.opts.some(o => vowels.test(o)), 'vowels on wrong options: ' + it.q);
  }
});

test('correct answers are spread over all positions', () => {
  const count = [0, 0, 0, 0];
  let run = 1, maxRun = 1;
  items.forEach((it, i) => { count[it.a]++; run = i && it.a === items[i - 1].a ? run + 1 : 1; maxRun = Math.max(maxRun, run); });
  for (const n of count) assert.ok(n > items.length * 0.15, `positions ${count}`);
  assert.ok(maxRun <= 6, `same position ${maxRun} times in a row`);
});
