import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const inline = text => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/https:\/\/[^\s<]+/g, url => {
    const target = url.replace(/[.,;:!?]+$/, '');
    return `<a href="${target}">${target}</a>${url.slice(target.length)}`;
  });

export async function buildSetupGuide() {
  const markdown = await readFile(new URL('SETUP.md', import.meta.url), 'utf8');
  const sections = [], blocks = [];
  let list = false, fence = false, code = [];
  const closeList = () => { if (list) { blocks.push('</ol>'); list = false; } };
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('```')) {
      closeList();
      if (fence) { blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); code = []; }
      fence = !fence; continue;
    }
    if (fence) { code.push(line); continue; }
    if (!line.trim()) { closeList(); continue; }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      closeList(); const level = heading[1].length;
      const id = 'section-' + sections.length;
      if (level === 2) sections.push({ id, title: heading[2] });
      blocks.push(`<h${level}${level === 2 ? ` id="${id}"` : ''}>${inline(heading[2])}</h${level}>`); continue;
    }
    const item = /^(\d+)\. (.+)$/.exec(line);
    if (item) {
      if (!list) { blocks.push(`<ol start="${item[1]}">`); list = true; }
      blocks.push(`<li>${inline(item[2])}</li>`); continue;
    }
    closeList(); blocks.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  const nav = `<nav aria-label="Guide contents"><strong>Jump to a step</strong><ul>${sections.map(s => `<li><a href="#${s.id}">${escape(s.title)}</a></li>`).join('')}</ul></nav>`;
  const content = blocks.join('\n').replace('</h1>', '</h1>\n' + nav);
  await writeFile(new URL('SETUP.html', import.meta.url), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SalesGod Team — Step-by-step guide</title>
<style>body{font:17px/1.65 system-ui,sans-serif;color:#173c34;background:#f2f6f3;margin:0}main{max-width:880px;margin:32px auto;background:white;padding:40px;border-radius:18px}h1{font-size:36px;line-height:1.2}h2{border-top:1px solid #d7e5de;padding-top:28px;margin-top:38px;font-size:25px;scroll-margin-top:20px}h3{font-size:20px;margin-top:30px}li{margin:14px 0;padding-left:5px}code{background:#edf3f0;border-radius:4px;padding:2px 5px;overflow-wrap:anywhere}pre{background:#173c34;color:white;padding:18px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}pre code{background:transparent;color:inherit;padding:0}a{color:#166454}p{overflow-wrap:anywhere}nav{background:#edf3f0;padding:20px;border-radius:10px}nav ul{padding-left:20px}nav li{margin:6px 0}nav a{text-decoration:none}@media(max-width:600px){main{margin:0;padding:20px;border-radius:0}h1{font-size:29px}}@media print{body{background:white}main{margin:0;padding:0;max-width:none}nav{display:none}h2,h3{break-after:avoid}pre{border:1px solid #ccc;background:white;color:black}a{color:inherit}}</style></head>
<body><main>${content}</main></body></html>\n`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await buildSetupGuide();
