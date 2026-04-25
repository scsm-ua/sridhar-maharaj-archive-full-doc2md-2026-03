/*
Extracts meta.author from the header section at the top of the file.

Scans the first bold/record_id lines at the top. Takes the first bold line
whose inner text is a known author (from AUTHORS dict). Removes that line
from the content.

Errors if a bold line at the top is not a record_id and not in AUTHORS dict.
*/

const { AUTHORS, nextNonEmpty, boldInner, parseRecordId, isHeaderLine, removeLine } = require('./helpers');

function extractAuthor(content) {
  const lines = content.split('\n');
  const warnings = [];
  const errors = [];
  let cursor = 0;

  while (true) {
    cursor = nextNonEmpty(lines, cursor);
    if (cursor === -1) break;

    const raw = lines[cursor].trim();
    if (!isHeaderLine(raw)) break; // body starts here

    const bold = boldInner(raw);

    if (bold !== null) {
      if (AUTHORS[bold] !== undefined) {
        return {
          content: removeLine(lines, cursor).join('\n'),
          meta: { author: AUTHORS[bold] },
          modified: true,
          warnings,
          errors,
        };
      }
      if (parseRecordId(bold) !== null) {
        cursor++; continue; // record_id line — skip, handled by other plugin
      }
      // Bold but unrecognized
      errors.push(`Unrecognized author name (not in AUTHORS dict): "${bold}"`);
      break;
    }

    // Plain known author (no bold markers)
    if (AUTHORS[raw] !== undefined) {
      return {
        content: removeLine(lines, cursor).join('\n'),
        meta: { author: AUTHORS[raw] },
        modified: true,
        warnings,
        errors,
      };
    }

    // Plain record_id line — skip
    cursor++;
  }

  return { content, meta: {}, modified: false, warnings, errors };
}

module.exports = { extractAuthor };
