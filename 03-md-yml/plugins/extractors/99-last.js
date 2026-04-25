/*
Final cleanup processor — runs last after all extractors.

- Sets meta.legacy_filename from the file's basename (without extension)
- Strips internal cross-plugin keys (e.g. filename_record_id)
*/

const path = require('path');
const { getMP3Filename } = require('../../../utils');

/**
 * @param {string} content
 * @param {string} fileName
 * @param {Object} currentMeta
 * @returns {{ content: string, meta: Object, modified: boolean, warnings: string[], errors: string[] }}
 */
function finalCleanup(content, fileName, currentMeta) {
  const meta = {};

  meta.legacy_filename = path.basename(fileName, path.extname(fileName));
  meta.lang = 'ru';
  meta.mp3 = getMP3Filename({...currentMeta, ...meta});

  return {
    content,
    meta,
    modified: true,
    warnings: [],
    errors: [],
  };
}

module.exports = { finalCleanup };
