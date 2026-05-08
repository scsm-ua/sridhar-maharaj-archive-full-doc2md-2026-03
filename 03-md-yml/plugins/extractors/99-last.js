/*
Final cleanup processor — runs last after all extractors.

- Sets meta.legacy.filename from the file's basename (without extension)
- Preserves meta.legacy.mp3 if already set by 06-mp3.js
- Merges the canonical mp3 path into meta.audio.mp3 (preserving bytes/duration from 10-audio-meta)
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
function finalCleanup(content, fileName, currentMeta, config = {}) {
  const meta = {};

  meta.legacy = {
    ...(currentMeta.legacy || {}),
    filename: path.basename(fileName, path.extname(fileName)),
  };
  meta.lang = 'ru';

  const mp3Filename = getMP3Filename({...currentMeta, ...meta});
  const mp3Prefix = config.mp3_prefix || '';
  const canonicalMp3 = `${mp3Prefix}${mp3Filename}`;
  meta.audio = {
    ...(currentMeta.audio || {}),
    mp3: canonicalMp3,
  };

  return {
    content,
    meta,
    modified: true,
    warnings: [],
    errors: [],
  };
}

module.exports = { finalCleanup };
