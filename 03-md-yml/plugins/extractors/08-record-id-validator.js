/*
Last-stage validator for meta.record_id.

Runs after all extractors and fixers have run so the final record_id value is checked.

Validates:
  - No Cyrillic characters remain (should have been converted by fix-record-id)
  - No comma in the value
  - record_id matches the filename-derived record_id (meta.filename_record_id)
  - record_id is unique across all processed files (checked via reportDuplicateRecordIds)
*/

// Cross-file uniqueness registry: record_id → [fileName, ...]
const recordIdRegistry = new Map();

/**
 * @param {string} content
 * @param {string} fileName
 * @param {Object} currentMeta
 * @returns {{ content: string, meta: Object, modified: boolean, warnings: string[], errors: string[] }}
 */
function validateRecordId(content, fileName, currentMeta) {
  const id = currentMeta.record_id;
  const errors = [];

  if (id && typeof id === 'string') {
    if (/[\u0400-\u04FF]/.test(id)) {
      errors.push(`record_id still contains Cyrillic characters: "${id}"`);
    }
    if (id.includes(',')) {
      errors.push(`record_id contains a comma: "${id}"`);
    }

    const fileId = currentMeta.filename_record_id;
    if (fileId && fileId !== id) {
      errors.push(`record_id mismatch: content "${id}" vs filename "${fileId}"`);
    }

    // Register for cross-file uniqueness check
    if (!recordIdRegistry.has(id)) recordIdRegistry.set(id, []);
    recordIdRegistry.get(id).push(fileName);
  }

  return { content, meta: {}, modified: false, warnings: [], errors };
}

/**
 * Returns duplicate record_ids found across all processed files.
 * Call once after all files have been processed.
 * @returns {{ rid: string, files: string[] }[]}
 */
function reportDuplicateRecordIds() {
  return [...recordIdRegistry.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([rid, files]) => ({ rid, files }));
}

module.exports = { validateRecordId, reportDuplicateRecordIds };
