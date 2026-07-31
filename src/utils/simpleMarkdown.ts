/**
 * Minimal Markdown → HTML for the admin guide (no dependencies).
 * Supports: headings, paragraphs, bold, inline code, links, lists, tables, hr.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Links: [label](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i);
      const openParen = closeBracket >= 0 ? text.indexOf('(', closeBracket) : -1;
      const closeParen = openParen >= 0 ? text.indexOf(')', openParen) : -1;
      if (closeBracket > i && openParen === closeBracket + 1 && closeParen > openParen) {
        const label = text.slice(i + 1, closeBracket);
        const url = text.slice(openParen + 1, closeParen);
        const safeUrl = escapeHtml(url);
        const isExternal = /^https?:\/\//i.test(url);
        result += `<a href="${safeUrl}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inlineFormat(label)}</a>`;
        i = closeParen + 1;
        continue;
      }
    }

    // Bold: **text**
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end > i) {
        result += `<strong>${inlineFormat(text.slice(i + 2, end))}</strong>`;
        i = end + 2;
        continue;
      }
    }

    // Inline code: `code`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        result += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
        i = end + 1;
        continue;
      }
    }

    const ch = text[i];
    if (ch === '&') result += '&amp;';
    else if (ch === '<') result += '&lt;';
    else if (ch === '>') result += '&gt;';
    else result += ch;
    i += 1;
  }

  return result;
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

function renderTable(rows: string[]): string {
  if (rows.length < 2) return '';
  const header = parseTableRow(rows[0]);
  const bodyLines = rows.slice(2); // skip separator
  let html = '<div class="table-wrap"><table><thead><tr>';
  for (const cell of header) {
    html += `<th>${inlineFormat(cell)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const line of bodyLines) {
    if (!line.trim()) continue;
    html += '<tr>';
    for (const cell of parseTableRow(line)) {
      html += `<td>${inlineFormat(cell)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const parts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      parts.push('<hr />');
      i += 1;
      continue;
    }

    // Table
    if (
      line.trim().includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }
      parts.push(renderTable(tableLines));
      continue;
    }

    // Headings
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      // Match GitHub-style anchors used in the guide TOC (e.g. 1-introduction)
      parts.push(`<h${level} id="${id}">${inlineFormat(text)}</h${level}>`);
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      parts.push('<ul>');
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        parts.push(`<li>${inlineFormat(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      parts.push('</ul>');
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      parts.push('<ol>');
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        parts.push(`<li>${inlineFormat(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      parts.push('</ol>');
      continue;
    }

    // Paragraph (consume consecutive non-blank, non-special lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !(
        lines[i].includes('|') &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      )
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) {
      parts.push(`<p>${inlineFormat(para.join(' '))}</p>`);
    }
  }

  return parts.join('\n');
}
