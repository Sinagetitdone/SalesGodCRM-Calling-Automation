/* Import locally, preview in the existing box, and preserve the normal Save/Send action. */
(() => {
  for (const field of document.querySelectorAll('textarea:not(#contactCsv)')) {
    const label = document.createElement('label'), input = document.createElement('input'), status = document.createElement('p');
    const name = document.querySelector(`label[for="${field.id}"]`)?.textContent || 'this text';
    label.textContent = 'Upload a file to replace ' + name;
    input.type = 'file'; input.accept = '.txt,.md,.docx,.pdf'; input.setAttribute('aria-label', label.textContent);
    status.setAttribute('role', 'status'); status.textContent = 'TXT, Markdown, DOCX or PDF · up to 5 MB · extracted locally · review before saving';
    label.append(input); field.after(label, status);
    let busy = false;
    const sync = () => { input.disabled = field.disabled || busy; };
    new MutationObserver(sync).observe(field, { attributes: true, attributeFilter: ['disabled'] }); sync();
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      const original = field.value, extension = file.name.split('.').at(-1).toLowerCase();
      busy = true; sync(); status.textContent = 'Reading the file locally…';
      try {
        if (!['txt', 'md', 'docx', 'pdf'].includes(extension)) throw new Error('Choose TXT, Markdown (.md), Word (.docx) or PDF.');
        if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Choose a nonempty file no larger than 5 MB.');
        const response = await fetch('/import-text?format=' + extension, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(25000) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'File import failed (HTTP ' + response.status + ').');
        if (field.disabled || field.value !== original) throw new Error('The text box changed while the file was being read. Your text was kept; choose the file again.');
        if (field.maxLength >= 0 && result.text.length > field.maxLength) throw new Error(`The file has ${result.text.length.toLocaleString()} characters; this box allows ${field.maxLength.toLocaleString()}. Upload a shorter excerpt. Existing text was kept.`);
        field.value = result.text; field.dispatchEvent(new Event('input', { bubbles: true }));
        status.textContent = `Loaded ${result.text.length.toLocaleString()} characters. Review the text, then use the normal Save, Import or Send button.` + (field.minLength > result.text.length ? ` Add text to reach the ${field.minLength.toLocaleString()}-character minimum.` : '');
      } catch (error) { status.textContent = 'File not imported: ' + (error.name === 'TimeoutError' ? 'The local bridge did not finish reading the file in time.' : error.message); }
      finally { busy = false; input.value = ''; sync(); }
    };
  }
})();
