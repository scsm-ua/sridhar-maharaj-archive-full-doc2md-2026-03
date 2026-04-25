/**
 * RTF Cleanup Plugin
 * 
 * Cleans up RTF to Markdown conversion artifacts:
 * - Detects encoding issues (warns if soffice conversion failed)
 * - Removes RTF escape characters (^) except in footnote markers [^1]
 * - Removes escaped spaces (\ )
 * - Removes backslash escapes before markdown characters
 * - Removes trailing backslashes before blank lines
 * - Removes pandoc attribute syntax from links ([text]{.underline})
 * 
 * Note: Encoding is handled by soffice (RTF→DOCX conversion) before pandoc
 */

const { detectEncodingIssues } = require('./cleaners/encoding-detector');
const { removeRtfChars } = require('./cleaners/rtf-chars-remover');
const { removeEscapedSpaces } = require('./cleaners/escaped-spaces-remover');
const { removeBackslashEscapes } = require('./cleaners/backslash-escapes-remover');
const { removeTrailingBackslashes } = require('./cleaners/trailing-backslashes-remover');
const { removeLinkAttributes } = require('./cleaners/link-attributes-remover');

/**
 * Process markdown content converted from RTF files
 * @param {string} content - The markdown content to clean
 * @param {string} filename - Filename for logging context
 * @returns {Object} - { content: string, cleaned: boolean, hasEncodingIssues: boolean }
 */
function cleanRtfArtifacts(content, filename = '') {
  const beforeClean = content;
  
  // Detect encoding issues (warning only)
  const hasEncodingIssues = detectEncodingIssues(content, filename);
  
  // Remove RTF artifacts
  content = removeRtfChars(content);
  content = removeEscapedSpaces(content);
  content = removeBackslashEscapes(content);
  content = removeTrailingBackslashes(content);
  content = removeLinkAttributes(content);
  
  const wasCleanedRtf = content !== beforeClean;
  
  return {
    content,
    cleaned: wasCleanedRtf,
    hasEncodingIssues
  };
}

module.exports = {
  cleanRtfArtifacts
};
