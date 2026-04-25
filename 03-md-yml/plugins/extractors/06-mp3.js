/*
Reads the manual MP3 override mapping from errors_mp3_found_fixed_links.md.

Format (3 lines per entry):
  - [](../output/03-md-yml/NN/filename.md) MP3 unexpected status 403: ...
  - https://...default.mp3   (original/default URL — ignored)
  - https://...real.mp3      (override URL — OR "none" to skip)

Sets meta.override_mp3 to the third-line URL when it is not "none".
*/

const fs   = require('fs');
const path = require('path');

const MAPPING_PATH = path.join(__dirname, '../../errors_mp3_found_fixed_links.md');

/** Lazily loaded mapping: base filename → override mp3 URL */
let _mapping = null;

function loadMapping() {
  if (_mapping !== null) return _mapping;
  _mapping = {};

  if (!fs.existsSync(MAPPING_PATH)) return _mapping;

  const lines = fs.readFileSync(MAPPING_PATH, 'utf8').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    // Match lines like: - [](../output/03-md-yml/01/filename.md) ...
    const linkMatch = line.match(/^- \[\]\(\.\.\/output\/[^/]+\/[^/]+\/([^/]+\.md)\)/);
    if (linkMatch) {
      const baseName = linkMatch[1];
      const line3 = (lines[i + 2] || '').trim();
      const url = line3.startsWith('- ') ? line3.slice(2).trim() : null;
      if (url && url !== 'none') {
        const fileName3 = url.split('/').pop();
        _mapping[baseName] = decodeURIComponent(fileName3);
      }
      i += 3;
      continue;
    }
    i++;
  }
  return _mapping;
}

function extractMp3Override(content, fileName) {
  const mapping = loadMapping();
  const override = mapping[fileName];
  if (!override) {
    return { content, meta: {}, modified: false };
  }
  return {
    content,
    meta: { override_mp3: override },
    modified: true,
  };
}

module.exports = { extractMp3Override };
