/* Counts stay local and follow typed, pasted, uploaded and restored text. */
(() => {
  const fields = [...document.querySelectorAll('textarea:not([hidden]),input:not([type]),input[type="text"],input[type="search"],input[type="tel"],input[type="email"],input[type="url"]')].filter(field => !field.hidden);
  const counters = fields.map((field, index) => {
    const existingId = ({ callingBackground: 'backgroundCount', conversationGuide: 'guidanceCount' })[field.id];
    const output = existingId ? document.getElementById(existingId) : document.createElement('p');
    if (!existingId) { output.id = `text-count-${index}`; field.after(output); }
    output.classList.add('text-count');
    const described = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    described.add(output.id); field.setAttribute('aria-describedby', [...described].join(' '));
    let prior;
    const update = () => {
      const text = String(field.value || ''); if (text === prior) return; prior = text;
      const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
      output.textContent = `${text.length.toLocaleString()}${field.maxLength >= 0 ? ' / ' + field.maxLength.toLocaleString() : ''} characters · ${words.toLocaleString()} words` +
        (field.minLength > 0 ? ` · minimum ${field.minLength.toLocaleString()} characters` : '');
      output.title = 'Characters include spaces and line breaks. Words are separated by whitespace. Existing text length rules still apply.';
    };
    field.addEventListener('input', update); field.addEventListener('change', update); update();
    return update;
  });
  const refresh = () => counters.forEach(update => update());
  window.SalesGodTextCounts = { refresh };
  // Saved settings and copy/reset actions also assign values without input events.
  setInterval(refresh, 300);
})();
