/*
Main markdown processor for 03-md-yml stage.

Each plugin extracts metadata from the markdown and returns:
  { content: string, meta: object, modified: boolean, warnings?: string[] }

The processor merges all plugin metas into a single meta object.
Final output: YAML frontmatter + cleaned markdown.
*/

const path = require('path');
const { extractAuthor } = require('./extractors/03-author');
const { extractRecordId } = require('./extractors/02-record-id');
const { extractTitle } = require('./extractors/04-title');
const { extractTitleByFilename } = require('./extractors/05-title-by-filename');
const { extractEditors } = require('./extractors/01-editors');
const { extractMp3Override } = require('./extractors/06-mp3');
const { fixRecordIdPlugin } = require('./extractors/07-fix-record-id');
const { validateRecordId } = require('./extractors/08-record-id-validator');
const { recordIdToDate } = require('./extractors/09-recored-id-to-date');
const { finalCleanup } = require('./extractors/99-last');

// Plugin registry - add new plugins here
const PLUGINS = [
  {
    name: 'editors',
    statusKey: 'editorsExtracted',
    statusMessage: 'editors extracted',
    execute: (content) => extractEditors(content),
    hasWarnings: true,
  },
  {
    name: 'record-id',
    statusKey: 'recordIdExtracted',
    statusMessage: 'record_id extracted',
    execute: (content, fileName) => extractRecordId(content, fileName),
    hasWarnings: true,
  },
  {
    name: 'author',
    statusKey: 'authorExtracted',
    statusMessage: 'author extracted',
    execute: (content, fileName) => extractAuthor(content, fileName),
    hasWarnings: true,
  },
  {
    name: 'title',
    statusKey: 'titleExtracted',
    statusMessage: 'title extracted',
    execute: (content, fileName, currentMeta) => extractTitle(content, currentMeta),
    hasWarnings: true,
  },
  {
    name: 'title-by-filename',
    statusKey: 'titleByFilenameExtracted',
    statusMessage: 'title_from_filename set',
    execute: (content, fileName, currentMeta) => extractTitleByFilename(content, fileName, currentMeta),
    hasWarnings: true,
  },
  {
    name: 'mp3-override',
    statusKey: 'mp3OverrideExtracted',
    statusMessage: 'override_mp3 set',
    execute: (content, fileName) => extractMp3Override(content, fileName),
    hasWarnings: true,
  },
  {
    name: 'fix-record-id',
    statusKey: 'recordIdFixed',
    statusMessage: 'record_id fixed',
    execute: (content, fileName, currentMeta) => fixRecordIdPlugin(content, fileName, currentMeta),
    hasWarnings: true,
  },
  {
    name: 'record-id-validator',
    statusKey: 'recordIdValidated',
    statusMessage: 'record_id validated',
    execute: (content, fileName, currentMeta) => validateRecordId(content, fileName, currentMeta),
    hasWarnings: true,
  },
  {
    name: 'record-id-to-date',
    statusKey: 'recordIdToDateDone',
    statusMessage: 'date extracted from record_id',
    execute: (content, fileName, currentMeta) => recordIdToDate(content, fileName, currentMeta),
    hasWarnings: true,
  },
  {
    name: 'last',
    statusKey: 'finalCleanupDone',
    statusMessage: 'final cleanup done',
    execute: (content, fileName, currentMeta) => finalCleanup(content, fileName, currentMeta),
    hasWarnings: true,
  },
];

/**
 * Process markdown content through all plugins
 * @param {string} content - The markdown content to process
 * @param {string} fileName - The name of the file being processed (for logging)
 * @returns {Object} - { content: string, meta: object, appliedPlugins: string[], warnings: string[] }
 */
function processMarkdown(content, fileName) {
  let result = content;
  const meta = {};
  const status = {};
  const allWarnings = [];
  const allErrors = [];
  const appliedPlugins = [];

  for (const plugin of PLUGINS) {
    const pluginResult = plugin.execute(result, fileName, meta);

    if (pluginResult.modified) {
      result = pluginResult.content;
      if (pluginResult.meta) {
        Object.assign(meta, pluginResult.meta);
      }
      status[plugin.statusKey] = true;
      appliedPlugins.push(plugin.statusMessage);
    }

    if (plugin.hasWarnings) {
      if (pluginResult.warnings && pluginResult.warnings.length > 0) {
        allWarnings.push(...pluginResult.warnings);
        console.log(`  ⚠️  ${plugin.name} warnings in ${fileName}:`);
        pluginResult.warnings.forEach(w => console.log(`     ${w}`));
      }
      if (pluginResult.errors && pluginResult.errors.length > 0) {
        allErrors.push(...pluginResult.errors);
        console.log(`  ✗  ${plugin.name} errors in ${fileName}:`);
        pluginResult.errors.forEach(e => console.log(`     ${e}`));
      }
    }
  }

  return {
    content: result,
    meta,
    ...status,
    warnings: allWarnings,
    errors: allErrors,
    appliedPlugins,
  };
}

// Desired key order in YAML frontmatter; unlisted keys appear before the last listed key
const META_KEY_ORDER = [
  'record_id', 
  'mp3',
  'date', 
  'title', 
  'title_from_filename', 
  'comment', 
  'author', 
  'lang', 
  'editors', 
  'override_mp3', 
  'legacy_filename'];

/**
 * Returns a copy of meta with keys sorted according to META_KEY_ORDER.
 * Logs an error for any key not present in the list.
 */
function orderMeta(meta) {
  const allKeys = Object.keys(meta);
  for (const k of allKeys) {
    if (!META_KEY_ORDER.includes(k)) {
      console.error(`  ✗ orderMeta: unknown meta key "${k}" — add it to META_KEY_ORDER`);
    }
  }
  return META_KEY_ORDER
    .filter(k => allKeys.includes(k))
    .reduce((obj, k) => { obj[k] = meta[k]; return obj; }, {});
}

module.exports = { processMarkdown, orderMeta };
