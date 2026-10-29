// Contact normalization and CSV parsing are independent of database state.
export const contactImportLimits = { csvCharacters: 400000, contacts: 1000, nameCharacters: 80 };

export function phone(value) {
  const raw = String(value).trim();
  if (!/^[+\d\s().-]+$/.test(raw)) throw new Error('Use a phone number without extensions.');
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && digits.length === 10) digits = '1' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Include a valid country code.');
  return '+' + digits;
}
export function parseContacts(csv) {
  if (typeof csv !== 'string' || csv.length > contactImportLimits.csvCharacters) throw new Error('CSV exceeds the import limit.');
  const rows = [];
  let row = [], field = '', quoted = false;
  csv = csv.replace(/^\uFEFF/, '');
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (c === ',' || c === '\n' || c === undefined)) {
      row.push(field.trim());
      field = '';
      if (c !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== '\r') {
      field += c ?? '';
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quote.');
  const columns = rows.shift()?.map(x => x.toLowerCase().replace(/[ _-]/g, ''));
  if (!columns || ['firstname', 'lastname', 'phone'].some(x => !columns.includes(x))) throw new Error('CSV needs first_name,last_name,phone headers.');
  if (!rows.length || rows.length > contactImportLimits.contacts) throw new Error('Import between 1 and 1000 contacts.');
  const seen = new Set(), contacts = [];
  let duplicates = 0;
  for (const [index, values] of rows.entries()) {
    const get = key => values[columns.indexOf(key)]?.trim() || '';
    if (values.length !== columns.length) throw new Error(`Row ${index + 2}: wrong column count.`);
    const first = get('firstname'), last = get('lastname');
    if (!first) throw new Error(`Row ${index + 2}: first name is required.`);
    if (first.length > contactImportLimits.nameCharacters || last.length > contactImportLimits.nameCharacters || /[\x00-\x1f]/.test(first + last)) throw new Error(`Row ${index + 2}: invalid name.`);
    let number;
    try {
      number = phone(get('phone'));
    } catch {
      throw new Error(`Row ${index + 2}: invalid phone number.`);
    }
    if (seen.has(number)) {
      duplicates++;
      continue;
    }
    seen.add(number);
    contacts.push({ firstName: first, lastName: last, phone: number });
  }
  return { contacts, duplicates };
}
