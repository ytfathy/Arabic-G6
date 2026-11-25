// Runs api/grade.js against a fake Claude API server. Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let lastBody = null, reply = null;
const server = http.createServer((req, res) => {
  let body = ''; req.on('data', d => body += d);
  req.on('end', () => {
    lastBody = JSON.parse(body);
    const { status = 200, json } = reply();
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(json));
  });
});
const message = (text, stop_reason = 'end_turn') => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason, stop_sequence: null,
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 },
});

let POST;
before(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  ({ POST } = await import('../api/grade.js'));
});
after(() => server.close());

const call = body => POST(new Request('https://x.test/api/grade', { method: 'POST', body: JSON.stringify(body) }));
const item = { id: 'w1#0', type: 'kw', question: 'مرادف تبث', model: 'تنشر', answer: 'تذيع' };

test('returns the AI decision and feedback per answer', async () => {
  reply = () => ({ json: message(JSON.stringify({ results: [{ id: 'w1#0', ok: true, feedback: 'تذيع مرادف صحيح لتنشر.' }, { id: 'other', ok: true, feedback: '' }] })) });
  const r = await call({ items: [item] });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).results, [{ id: 'w1#0', ok: true, feedback: 'تذيع مرادف صحيح لتنشر.' }]); // unknown ids dropped
  assert.equal(lastBody.model, 'claude-opus-5-5');
  assert.equal(lastBody.fallbacks, 'default');
  assert.equal(lastBody.output_config.format.type, 'json_schema');
  assert.match(lastBody.messages[0].content, /تذيع/);
});

test('bad requests are rejected', async () => {
  assert.equal((await call({ items: [] })).status, 400);
  assert.equal((await call({ items: Array(21).fill(item) })).status, 400);
  assert.equal((await POST(new Request('https://x.test/api/grade', { method: 'POST', body: 'nope' }))).status, 400);
});

test('API errors and refusals come back as errors, so the site keeps keyword grading', async () => {
  reply = () => ({ status: 400, json: { type: 'error', error: { type: 'invalid_request_error', message: 'boom' } } });
  assert.equal((await call({ items: [item] })).status, 502);
  reply = () => ({ json: message('', 'refusal') });
  assert.equal((await call({ items: [item] })).status, 502);
});

test('missing API key fails without calling Claude', async () => {
  const keep = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try { assert.equal((await call({ items: [item] })).status, 500); } finally { process.env.ANTHROPIC_API_KEY = keep; }
});
