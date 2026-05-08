/*
Extracts meta.record_id from the header section at the top of the file.

Scans the first bold/record_id lines at the top. Takes the first line
(bold or plain) whose text matches the record ID pattern. Removes that
line from the content.
*/

const { nextNonEmpty, boldInner, parseRecordIdLine, isHeaderLine, removeLine, RECORD_ID_CORE } = require('./helpers');

/** Matches an embedded record ID anywhere in a string */
const EMBEDDED_RECORD_ID_RE = new RegExp(RECORD_ID_CORE);

function extractRecordId(content, fileName) {
  const lines = content.split('\n');
  const warnings = [];
  const errors = [];
  let cursor = 0;
  const fileNameStem = (fileName || '').replace(/\.md$/, '');

  const fileNameId = fileNameStem ? (parseRecordIdLine(fileNameStem) || {}).id ?? null : null;

  let foundId = null;
  let foundTitle = null;
  const consumedIndexes = [];

  while (true) {
    cursor = nextNonEmpty(lines, cursor);
    if (cursor === -1) break;

    const raw = lines[cursor].trim();
    if (!isHeaderLine(raw)) break; // body starts here

    const candidate = boldInner(raw) ?? raw;
    const parsed = parseRecordIdLine(candidate);

    if (parsed === null) { cursor++; continue; }

    if (foundId === null) {
      // First record_id line
      foundId = parsed.id;
      consumedIndexes.push(cursor);
      if (parsed.title) {
        // Inline title: only use it if line doesn't match filename
        const candidate2 = candidate.replace(/\./g, '_');
        if (fileNameStem.indexOf(candidate) !== 0 && fileNameStem.indexOf(candidate2) !== 0) {
          foundTitle = parsed.title;
        }
      }
    } else if (foundTitle === null && parsed.title) {
      // Second line has a title — consume it and stop
      foundTitle = parsed.title;
      consumedIndexes.push(cursor);
      break;
    } else {
      break; // second plain ID or title already found — stop
    }

    cursor++;
  }

  if (foundId === null) {
    // Scan first few lines for an embedded record_id (e.g. "Author, 1982.02.25.A.B.C")
    let scanCursor = 0;
    let embeddedFound = false;
    for (let i = 0; i < 5; i++) {
      scanCursor = nextNonEmpty(lines, scanCursor);
      if (scanCursor === -1) break;
      const raw = lines[scanCursor].trim();
      const inner = boldInner(raw) ?? raw;
      const m = inner.match(EMBEDDED_RECORD_ID_RE);
      if (m) {
        warnings.push(`record_id not extracted — embedded in line: "${raw}"`);
        embeddedFound = true;
        break;
      }
      scanCursor++;
    }
    if (!embeddedFound && !fileNameId) {
      errors.push('no record_id found');
    }
    const metaFromFile = fileNameId ? { record_id: fileNameId } : {};
    return { content, meta: metaFromFile, modified: !!fileNameId, warnings, errors };
  }

  const meta = { record_id: foundId };
  if (foundTitle) {
    if (/^[(a-zA-Z0-9]/.test(foundTitle) && fileName.toLowerCase().indexOf(foundTitle.toLowerCase()) === -1) {
      const comment_re = foundTitle.match(/^(\([^)]+\))\s(.+)/);
      if (comment_re) {
        meta.legacy = { comment: comment_re[1] };
        meta.title = comment_re[2];
      } else {
        meta.legacy = { comment: foundTitle };
      }
    } else {
      meta.title = foundTitle;
    }
    warnings.push(`title extracted from header: "${foundTitle}"`);
  }

  // Remove consumed lines in reverse order to preserve indexes
  const resultLines = [...lines];
  for (const idx of [...consumedIndexes].sort((a, b) => b - a)) {
    resultLines.splice(idx, 1);
  }
  while (resultLines.length > 0 && resultLines[0].trim() === '') {
    resultLines.shift();
  }

  return {
    content: resultLines.join('\n'),
    meta,
    modified: true,
    warnings,
    errors,
  };
}

module.exports = { extractRecordId };
