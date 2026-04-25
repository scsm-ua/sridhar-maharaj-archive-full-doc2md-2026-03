/*
Main markdown processor - runs all cleanup plugins on markdown content
*/

const { addItalicLineBreaks: addBoldLineBreaks } = require('./cleaners/bold-line-breaks');
const { addItalicLineBreaks } = require('./cleaners/italic-line-breaks');
const { convertFootnotes } = require('./cleaners/footnotes-converter');
const { applySimpleReplacements } = require('./cleaners/simple-replacements');
const { applySimpleReplacementsLast } = require('./cleaners/simple-replacements-last');
const { fixItalicBoundaries } = require('./cleaners/italic-boundaries');

// Plugin registry - add new plugins here
const PLUGINS = [
  {
    name: 'footnotes-converter',
    statusKey: 'footnotesConverted',
    statusMessage: 'footnotes converted',
    execute: (content, fileName) => convertFootnotes(content, fileName),
    hasWarnings: true
  },
  {
    name: 'simple-replacements',
    statusKey: 'simpleReplacementsApplied',
    statusMessage: 'simple replacements applied',
    execute: (content, fileName) => applySimpleReplacements(content)
  },
  {
    name: 'italic-boundaries',
    statusKey: 'italicBoundariesFixed',
    statusMessage: 'italic boundaries fixed',
    execute: (content, fileName) => fixItalicBoundaries(content)
  },
  {
    name: 'bold-line-breaks',
    statusKey: 'boldLineBreaksAdded',
    statusMessage: 'bold line breaks added',
    execute: (content, fileName) => addBoldLineBreaks(content)
  },
  {
    name: 'italic-line-breaks',
    statusKey: 'italicLineBreaksAdded',
    statusMessage: 'italic line breaks added',
    execute: (content, fileName) => addItalicLineBreaks(content)
  },
  {
    name: 'simple-replacements-last',
    statusKey: 'simpleReplacementsLastApplied',
    statusMessage: 'simple replacements last applied',
    execute: (content, fileName) => applySimpleReplacementsLast(content)
  },
];

/**
 * Process markdown content through all plugins
 * @param {string} content - The markdown content to process
 * @param {string} fileName - The name of the file being processed (for logging)
 * @returns {Object} - { content: string, [statusKeys]: boolean, warnings: array, appliedPlugins: array }
 */
function processMarkdown(content, fileName) {
  let result = content;
  const status = {};
  const allWarnings = [];
  const appliedPlugins = [];
  
  // Run each plugin in sequence
  for (const plugin of PLUGINS) {
    const pluginResult = plugin.execute(result, fileName);
    
    if (pluginResult.modified) {
      result = pluginResult.content;
      status[plugin.statusKey] = true;
      appliedPlugins.push(plugin.statusMessage);
    }
    
    // Handle warnings if plugin supports them
    if (plugin.hasWarnings && pluginResult.warnings && pluginResult.warnings.length > 0) {
      allWarnings.push(...pluginResult.warnings);
      console.log(`  ⚠️  ${plugin.name} warnings in ${fileName}:`);
      pluginResult.warnings.forEach(w => console.log(`     ${w}`));
    }
  }
  
  return {
    content: result,
    ...status,
    warnings: allWarnings,
    appliedPlugins
  };
}

module.exports = { processMarkdown };
