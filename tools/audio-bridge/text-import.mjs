import { fork } from 'node:child_process';

export function extractDocument(bytes, extension) {
  if (!['txt', 'md', 'docx', 'pdf'].includes(extension)) return Promise.reject(new Error('Choose a TXT, Markdown (.md), Word (.docx) or PDF file.'));
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) return Promise.reject(new Error('Choose a nonempty file no larger than 5 MB.'));
  return new Promise((resolve, reject) => {
    // PDF native dependencies can crash during worker-thread teardown on Windows.
    // A bounded child process keeps malformed documents and native failures away from the bridge.
    const worker = fork(new URL('./text-import-worker.mjs', import.meta.url), [], { env: {}, execArgv: ['--max-old-space-size=128'], windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); worker.kill(); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => finish(new Error('Text extraction timed out after 20 seconds. Upload a shorter document.')), 20000);
    worker.once('message', result => finish(result.error ? new Error(result.error) : null, result.text));
    worker.once('error', () => finish(new Error('Text extraction exceeded available resources or could not start. Upload a smaller file.')));
    worker.once('exit', () => { if (!settled) finish(new Error('Text extraction stopped before completing.')); });
    worker.send({ bytes: Buffer.from(bytes).toString('base64'), extension });
  });
}

export function textImportRoutes(app) {
  let busy = false;
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 5 * 1024 * 1024 }, (_request, body, done) => done(null, body));
  app.post('/import-text', { bodyLimit: 5 * 1024 * 1024, schema: { querystring: { type: 'object', additionalProperties: false, required: ['format'], properties: { format: { type: 'string', enum: ['txt', 'md', 'docx', 'pdf'] } } } } }, async (request, reply) => {
    if (busy) return reply.code(409).send({ error: 'Another file is being read. Wait for it to finish.' });
    if (!Buffer.isBuffer(request.body)) return reply.code(400).send({ error: 'Upload the file as binary data.' });
    busy = true;
    try { return { text: await extractDocument(request.body, request.query.format) }; }
    catch (error) { return reply.code(422).send({ error: error.message }); }
    finally { busy = false; }
  });
}
