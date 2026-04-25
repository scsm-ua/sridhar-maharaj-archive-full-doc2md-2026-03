/*
Extracts meta.title from the header section at the top of the file.

Primary: first bold line that is not a record_id, not a known author, and does
not end with ":" (speaker label).

Fallback: if no bold title found, the first non-empty plain line after the bold
header is used if it is ≤ 200 characters and does not look like body text
(timestamps, footnotes, stage directions).
*/

const { AUTHORS, nextNonEmpty, boldInner, parseRecordId, removeLine } = require('./helpers');

const BODY_LINE_RE = /^\*#\d|^\[\^|^\[.+\]$|^[*_]/;

function extractTitle(content, existingMeta = {}) {
  const warnings = [];
  const errors = [];
  const lines = content.split('\n');
  let cursor = 0;

  while (true) {
    cursor = nextNonEmpty(lines, cursor);
    if (cursor === -1) break;

    const raw = lines[cursor].trim();
    const bold = boldInner(raw);

    if (bold === null) {
      // Fallback: try this plain line as title, but only if no title was already set
      if (
        !existingMeta.title &&
        raw.length <= 0 &&  // Disabled
        raw.indexOf('...') === -1 &&
        raw.indexOf('#') !== 0 &&
        !raw.endsWith(':') &&
        !BODY_LINE_RE.test(raw) &&
        parseRecordId(raw) === null &&
        AUTHORS[raw] === undefined
      ) {
        return {
          content: removeLine(lines, cursor).join('\n'),
          meta: { title: raw },
          modified: true,
          warnings,
          errors,
        };
      }
      break;
    }

    if (parseRecordId(bold) !== null) {
      cursor++; continue; // record_id line — skip
    }

    if (AUTHORS[bold] !== undefined) {
      cursor++; continue; // author line — skip
    }

    if (bold.endsWith(':')) break; // speaker label — body starts here

    // This bold line is the descriptive title
    return {
      content: removeLine(lines, cursor).join('\n'),
      meta: { title: bold },
      modified: true,
      warnings,
      errors,
    };
  }

  return { content, meta: {}, modified: false, warnings, errors };
}

module.exports = { extractTitle };

