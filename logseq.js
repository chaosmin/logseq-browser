'use strict';

function extractProperties(text) {
  const properties = {};
  const nonPropertyLines = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-z][a-z0-9_-]*)::[ \t]*(.*)$/);
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
  text = text.replace(/^[a-z][a-z0-9_-]*::.*$/gm, '');
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
  const { properties, cleaned } = extractProperties(rawText);
  const propsHtml = renderPropertiesTable(properties);
  let text = cleaned;
  text = convertUnsupportedBlocks(text);
  text = convertBlockRefs(text);
  text = convertWikiLinks(text);
  text = convertTags(text);
  return { propsHtml, transformed: text };
}

module.exports = {
  extractProperties, convertWikiLinks, convertBlockRefs,
  convertUnsupportedBlocks, convertTags, renderPropertiesTable,
  filenameToTitle, toPlainText, preprocess,
};
