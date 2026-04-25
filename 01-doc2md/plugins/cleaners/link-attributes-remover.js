/**
 * Link Attributes Remover
 * 
 * Removes pandoc attribute syntax from markdown links.
 * Converts: [text]{.underline}(url) → [text](url)
 */

/**
 * Remove attribute syntax from markdown links
 * @param {string} content - Content to process
 * @returns {string} - Processed content
 */
function removeLinkAttributes(content) {
  // Pattern: [text]{.attribute}(url) → [text](url)
  // Also handles: [[text]{.attribute}](url) → [text](url) (removes double brackets)
  return content
    .replace(/\[\[([^\]]+)\]\{[^}]+\}\]/g, '[$1]')  // [[text]{.attr}] → [text]
    .replace(/\[([^\]]+)\]\{[^}]+\}/g, '[$1]');     // [text]{.attr} → [text]
}

module.exports = { removeLinkAttributes };
