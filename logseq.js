'use strict';

function stripLogbook(text) {
  // Remove :LOGBOOK: ... :END: blocks (Logseq time-tracking entries)
  const lines = text.split('\n');
  const out = [];
  let inLogbook = false;
  for (const line of lines) {
    const t = line.trim();
    if (t === ':LOGBOOK:') { inLogbook = true; continue; }
    if (t === ':END:') { inLogbook = false; continue; }
    if (!inLogbook) out.push(line);
  }
  return out.join('\n');
}

function markCollapsedBlocks(text) {
  // Find blocks with "collapsed:: true" and inject a collapse marker on the parent bullet.
  // Must run BEFORE extractProperties strips the collapsed:: lines.
  const lines = text.split('\n');
  const collapsedParents = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \t]*collapsed::[ \t]*true\s*$/.test(lines[i])) {
      for (let j = i - 1; j >= 0; j--) {
        if (/^[ \t]*-[ \t]/.test(lines[j])) { collapsedParents.add(j); break; }
      }
    }
  }
  return lines.map((line, i) =>
    collapsedParents.has(i)
      ? line.replace(/^([ \t]*-[ \t]+)/, '$1<span class="collapse-btn collapsed"></span>')
      : line
  ).join('\n');
}

function extractProperties(text) {
  const properties = {};
  const nonPropertyLines = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^[ \t]*([a-z][a-z0-9_-]*)::[ \t]*(.*)$/);
    if (m) properties[m[1]] = m[2].trim();
    else nonPropertyLines.push(line);
  }
  return { properties, cleaned: nonPropertyLines.join('\n') };
}

function convertWikiLinks(text) {
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, page, alias) =>
    `<a href="#/pages/${encodeURIComponent(page)}.md" class="wiki-link">${escapeHtml(alias)}</a>`
  );
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, page) =>
    `<a href="#/pages/${encodeURIComponent(page)}.md" class="wiki-link">${escapeHtml(page)}</a>`
  );
  return text;
}

function convertBlockRefs(text) {
  return text.replace(
    /\(\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\)/g,
    (_, uuid) => `<span class="block-ref" title="${uuid}">[ref]</span>`
  );
}

function convertUnsupportedBlocks(text) {
  text = text.replace(
    /\{\{embed \(\([^)\n]{0,200}\)\)\}\}/g,
    '<div class="unsupported-block">[Embedded block — not supported]</div>'
  );
  text = text.replace(
    /\{\{query[^}\n]{0,500}\}\}/g,
    '<div class="unsupported-block">[Dynamic query — not supported]</div>'
  );
  return text;
}

function convertTables(text) {
  // Logseq table format (no separator row, indented outline items):
  //   \t- | header | header |     <- header row (whitespace + "- |")
  //   \t  | data   | data   |     <- body rows  (whitespace + "|")
  // Strip indentation, inject missing "| --- |" separator so marked renders a table.
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const hm = line.match(/^(\s*)-\s+(\|.+\|)\s*$/);
    if (hm) {
      const headerContent = hm[2];
      // Collect continuation rows: lines starting with whitespace + "|"
      const bodyLines = [];
      let j = i + 1;
      while (j < lines.length && /^\s+\|/.test(lines[j])) {
        bodyLines.push(lines[j].replace(/^\s+/, ''));
        j++;
      }
      if (bodyLines.length > 0) {
        out.push(headerContent);
        // Only inject separator if the table doesn't already have one
        if (!/---/.test(bodyLines[0])) {
          const cols = (headerContent.match(/\|/g) || []).length - 1;
          out.push('| ' + Array(Math.max(1, cols)).fill('---').join(' | ') + ' |');
        }
        out.push(...bodyLines);
        i = j;
        continue;
      }
    }
    out.push(line);
    i++;
  }

  return out.join('\n');
}

function convertMermaid(text) {
  // Convert ```mermaid ... ``` fenced blocks to <div class="mermaid"> for mermaid.js to render
  return text.replace(/```mermaid[ \t]*\n([\s\S]*?)```/g, (_, code) =>
    `<div class="mermaid">${code.trim()}</div>`
  );
}

function convertHighlights(text) {
  return text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
}

function convertTags(text) {
  return text.replace(
    /([ \t])#([a-zA-Z][a-zA-Z0-9_/-]*)/g,
    (_, pre, tag) => `${pre}<span class="tag">#${tag}</span>`
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPropertiesTable(properties) {
  if (Object.keys(properties).length === 0) return '';
  const rows = Object.entries(properties)
    .map(([k, v]) => `<tr><td class="prop-key">${escapeHtml(k)}</td><td class="prop-value">${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<table class="logseq-properties">${rows}</table>`;
}

function filenameToTitle(filename) {
  return filename.replace(/\.md$/, '').replace(/___/g, '/');
}

function toPlainText(text) {
  text = text.replace(/^[ \t]*[a-z][a-z0-9_-]*::.*$/gm, '');
  text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1');
  text = text.replace(/\(\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)\)/g, '');
  text = text.replace(/\{\{[^}]*\}\}/g, '');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1');
  text = text.replace(/^[\s]*-\s+/gm, '');
  text = text.replace(/#[a-zA-Z][a-zA-Z0-9_/-]*/g, '');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function preprocess(rawText) {
  let text = markCollapsedBlocks(rawText);  // must run before extractProperties strips collapsed::
  text = stripLogbook(text);
  const { cleaned } = extractProperties(text);
  text = cleaned;
  text = convertUnsupportedBlocks(text);
  text = convertMermaid(text);
  text = convertTables(text);
  text = convertBlockRefs(text);
  text = convertHighlights(text);
  text = convertWikiLinks(text);
  text = convertTags(text);
  return { transformed: text };
}

module.exports = {
  stripLogbook, markCollapsedBlocks,
  extractProperties, convertMermaid, convertHighlights, convertWikiLinks, convertBlockRefs,
  convertUnsupportedBlocks, convertTables, convertTags, renderPropertiesTable,
  filenameToTitle, toPlainText, preprocess,
};
