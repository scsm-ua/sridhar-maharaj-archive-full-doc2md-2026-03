/*
Convert footnote syntax from (1) and \(1\) to Markdown [^1] and [^1]:
Also validate footnote integrity
*/

/**
 * Convert footnotes to Markdown syntax and validate integrity
 * @param {string} content - The markdown content
 * @param {string} fileName - The name of the file being processed (for logging)
 * @returns {Object} - { content: string, modified: boolean, warnings: string[] }
 */
function convertFootnotes(content) {

  let modified = false;
  const warnings = [];

  if (!(/^\\\(\d+/m).test(content)) {

    // Convert wrong formatting: \(1\) → (1):
    content = content.replace(/\\\\?\((\d+)\\\\?\)/g, (match, num) => {
        modified = true;
        return `(${num})`;
    });

    return {
        content,
        modified,
        warnings
    };
  }
  
  // Track references and definitions
  const references = new Set();
  const definitions = new Set();
  
  // Convert footnote definitions: \(1\) → [^1]:
  let result = content.replace(/^\\\\?\((\d+)\\\\?\)/mg, (match, num) => {
    definitions.add(num);
    modified = true;
    return `[^${num}]:`;
  });
  
  // Convert footnote references: (1) → [^1]
  // But be careful not to match things that are part of other syntax
  // Skip replacement if the match is on a line that starts with [^N]: (footnote definition)
  result = result.replace(/(\*\s*)?\((\d+)\)(\*)?/g, (match, prefix, num, suffix, offset) => {
    if (!prefix && !suffix) {
        return match;
    }
    references.add(num);
    modified = true;
    return `${prefix||''}[^${num}]${suffix||''}`;
  });

  result = result.replace(/\((\d+)\)$/mg, (match, num, offset) => {
    references.add(num);
    modified = true;
    return `[^${num}]`;
  });
  
  // Validate integrity
  for (const ref of references) {
    if (!definitions.has(ref)) {
      warnings.push(`Footnote reference [^${ref}] has no definition`);
    }
  }
  
  for (const def of definitions) {
    if (!references.has(def)) {
      warnings.push(`Footnote definition [^${def}]: has no reference`);
    }
  }
  
  return {
    content: result,
    modified,
    warnings
  };
}

module.exports = { convertFootnotes };
