import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { extractDocument } from './text-import.mjs';
import { createBridge } from './server.mjs';

function pdf(text = 'Synthetic office guidance') {
  const stream = `BT /F1 12 Tf 40 150 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let body = '%PDF-1.4\n', offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(x => String(x).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}
test('imports real TXT, Markdown, DOCX and PDF locally as editable text', async () => {
  assert.equal(await extractDocument(Buffer.from('\uFEFFSynthetic text\n'), 'txt'), 'Synthetic text');
  assert.equal(await extractDocument(Buffer.from('# Guidance\n\nSynthetic **Markdown**'), 'md'), '# Guidance\n\nSynthetic **Markdown**');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic office guidance</w:t></w:r></w:p></w:body></w:document>');
  assert.equal(await extractDocument(await zip.generateAsync({ type: 'nodebuffer' }), 'docx'), 'Synthetic office guidance');
  assert.match(await extractDocument(pdf(), 'pdf'), /Synthetic office guidance/);
});
test('invalid, empty, binary, oversized and textless documents fail explicitly', async () => {
  for (const [bytes, format, reason] of [[Buffer.alloc(0), 'txt', /nonempty/], [Buffer.alloc(5 * 1024 * 1024 + 1), 'pdf', /5 MB/], [Buffer.from('x'), 'doc', /DOCX|docx/], [Buffer.from('not a zip'), 'docx', /valid, readable/], [Buffer.from('bad pdf'), 'pdf', /valid, readable/], [Buffer.from([0xff, 0xfe]), 'txt', /valid, readable/], [Buffer.from('a\0b'), 'txt', /UTF-8/], [Buffer.from(' '), 'txt', /No readable text/], [Buffer.from('x'.repeat(200001)), 'md', /too much text/], [pdf(''), 'pdf', /No readable text/]]) {
    await assert.rejects(extractDocument(bytes, format), reason);
  }
});
test('upload endpoint rejects cross-origin requests and returns local text without API activity', async () => {
  let requests = 0; const app = createBridge({ env: {}, fetchImpl: async () => { requests++; throw new Error('No network expected'); } });
  const headers = { host: '127.0.0.1:28431', origin: 'http://127.0.0.1:28431', 'content-type': 'application/octet-stream' };
  try {
    const req = { method: 'POST', url: '/import-text?format=txt', headers, payload: Buffer.from('Synthetic upload') };
    assert.equal((await app.inject({ ...req, headers: { ...headers, origin: 'https://untrusted.example' } })).statusCode, 403);
    const result = await app.inject(req); assert.equal(result.statusCode, 200); assert.equal(result.json().text, 'Synthetic upload');
    assert.equal((await app.inject({ ...req, url: '/import-text?format=exe' })).statusCode, 400);
    assert.equal((await app.inject({ ...req, payload: Buffer.from(' ') })).statusCode, 422);
    assert.equal(requests, 0);
  } finally { await app.close(); }
});
test('file picker respects text limits, preserves concurrent edits and never saves or sends automatically', async () => {
  const source = await readFile(new URL('public/text-import.js', import.meta.url), 'utf8');
  for (const mode of ['valid', 'oversized', 'changed', 'disabled']) {
    const nodes = [], events = [], requests = [];
    const field = { id: 'guide', value: 'Existing text', disabled: false, maxLength: 20000, minLength: 6000, after() {}, dispatchEvent: e => events.push(e.type) };
    const document = { querySelectorAll: () => [field], querySelector: () => ({ textContent: 'Guide' }), createElement() { const n = { setAttribute() {}, append() {} }; nodes.push(n); return n; } };
    vm.runInNewContext(source, { document, MutationObserver: class { observe() {} }, Event, AbortSignal, fetch: async (url, options) => {
      requests.push({ url, options }); if (mode === 'changed') field.value = 'User edited'; if (mode === 'disabled') field.disabled = true;
      return { ok: true, json: async () => ({ text: 'x'.repeat(mode === 'oversized' ? 20001 : 6000) }) };
    } });
    const input = nodes[1], status = nodes[2]; input.files = [{ name: 'guide.txt', size: 6000 }]; await input.onchange();
    assert.equal(requests.length, 1); assert.equal(requests[0].url, '/import-text?format=txt');
    if (mode === 'valid') { assert.equal(field.value.length, 6000); assert.deepEqual(events, ['input']); assert.match(status.textContent, /Review/); }
    else { assert.equal(field.value, mode === 'changed' ? 'User edited' : 'Existing text'); assert.deepEqual(events, []); assert.match(status.textContent, /not imported/); }
  }
});
