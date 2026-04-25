/*
Extracts meta.title_from_filename from filename-titles-fixed.json mapping.
Looks up the current file's name and sets title_from_filename to the titleRu value.
*/

const path = require('path');
const fs = require('fs');

const filenameTitlesPath = path.join(__dirname, '../..', 'filename-titles-fixed.json');
const filenameTitlesMap = {};
if (fs.existsSync(filenameTitlesPath)) {
  const filenameTitles = JSON.parse(fs.readFileSync(filenameTitlesPath, 'utf8'));
  filenameTitles.forEach(entry => {
    if (entry.filename) {
      filenameTitlesMap[entry.filename] = entry;
    }
  });
}

function extractTitleByFilename(content, fileName, currentMeta = {}) {
  const meta = {};
  const warnings = [];
  let modified = false;

  // Extract comment from filename: the part in parentheses, e.g. (MPR_4.1-4.4)
  const fileNameStem = fileName.replace(/\.md$/, '');
  const filenameCommentMatch = fileNameStem.match(/\s(\([^)]+\))$/);
  if (filenameCommentMatch) {
    const filenameComment = filenameCommentMatch[1];
    if (currentMeta.comment) {
      warnings.push(`comment override: "${currentMeta.comment}" → "${filenameComment}" (from filename)`);
    }
    meta.comment = filenameComment;
    modified = true;
  }

  const entry = filenameTitlesMap[fileName];
  if (entry && !entry.useTitleFromBody && entry.titleRu) {
    if (/^[(a-zA-Z]/.test(entry.titleRu)) {
      const newComment = entry.titleRu;
      const existingComment = meta.comment || currentMeta.comment;
      if (existingComment) {
        warnings.push(`comment override: "${existingComment}" → "${newComment}" (from filename-titles map)`);
      }
      meta.comment = newComment;
    } else if (entry.useTitleFromFile || !currentMeta.title) {
      meta.title = entry.titleRu;
    } else {
      meta.title_from_filename = entry.titleRu;
    }
    modified = true;
  }

  return { content, meta, modified, warnings, errors: [] };
}

module.exports = { extractTitleByFilename };
