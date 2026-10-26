process.once('message', async workerData => {
try {
  const buffer = Buffer.from(workerData.bytes, 'base64'); let text;
  if (['txt', 'md'].includes(workerData.extension)) {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (text.includes('\0')) throw new Error('Use a UTF-8 text file, not a binary document.');
  } else if (workerData.extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer }, { externalFileAccess: false }); text = result.value;
  } else {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer, isEvalSupported: false, useSystemFonts: false });
    try {
      const info = await parser.getInfo();
      if (info.total > 100) throw new Error('PDF files must have at most 100 pages.');
      text = (await parser.getText({ pageJoiner: '\n\n' })).text;
    } finally { await parser.destroy(); }
  }
  text = text.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('No readable text was found. Scanned PDFs need OCR before upload.');
  if (text.length > 200000) throw new Error('The document contains too much text. Upload a shorter excerpt.');
  process.send({ text });
} catch (error) {
  const message = String(error.message || '');
  const safe = /^(Use a UTF-8|PDF files must|No readable text|The document contains)/.test(message) ? message
    : /password|encrypted/i.test(message) ? 'This file is password-protected. Upload an unlocked copy.'
    : 'Text extraction failed. Check that the file is a valid, readable TXT, Markdown, DOCX or PDF document.';
  process.send({ error: safe });
}
});
