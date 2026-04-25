/*
Fix formatting boundaries - move punctuation outside italic blocks
*/

/**
 * Check if content is wrapped in delimiters and is the full line
 * @param {string} innerText - The text inside italic markers
 * @param {string} startDelim - Opening delimiter
 * @param {string} endDelim - Closing delimiter
 * @param {string} match - The full match including *
 * @param {number} offset - Position in full string
 * @param {string} fullString - The entire content
 * @returns {boolean} - True if wrapped and is full line
 */
function isWrappedFullLine(innerText, startDelim, endDelim, match, offset, fullString) {
  if ((startDelim && !innerText.startsWith(startDelim)) || (endDelim && !innerText.endsWith(endDelim))) {
    return false;
  }
  
  // Check if this match is the entire line (excluding leading/trailing whitespace)
  const lineStart = fullString.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = fullString.indexOf('\n', offset + match.length);
  const endPos = lineEnd === -1 ? fullString.length : lineEnd;
  const lineContent = fullString.slice(lineStart, endPos);
  const trimmedLine = lineContent.trim();
  
  // If the match is the entire line content, return true
  return trimmedLine === match;
}

/*

Make italic inner text «*...*».
Remove italic from (...).

In:
*«парамадрита-бхакти-винода-падам» (Шри Прабхупада-падма-става, стих 7)*

Out:
«*парамадрита-бхакти-винода-падам*» (Шри Прабхупада-падма-става, стих 7)

*/
function fixQuoteFormatting(match) {
  // Remove outer italic markers
  const innerText = match.slice(1, -1); // Remove leading and trailing *
  
  // Pattern: «text» (scripture reference)
  // Allow optional space between quote and parenthetical
  const quotePattern = /^(«[^»]+»)[\.\s]*(\([^)]+\).?)$/;
  const quoteMatch = innerText.match(quotePattern);

  // console.log('---test---',quoteMatch)
  
  if (quoteMatch) {
    const quotePart = quoteMatch[1]; // «text»
    const parentheticalPart = quoteMatch[2]; // (scripture reference)
    
    // Remove quotes from quote part, wrap content in italic, then re-add quotes
    const textWithoutQuotes = quotePart.slice(1, -1); // Remove « and »
    const result = `«*${textWithoutQuotes}*» ${parentheticalPart}`;
    
    return result;
  }
  
  // If pattern doesn't match, return original
  return match;
}

/**
 * Fix italic formatting boundaries
 * @param {string} content - The markdown content
 * @returns {Object} - { content: string, modified: boolean }
 */
function fixItalicBoundaries(content) {
  let modified = false;
  
  // Process italic patterns: *text* but not **bold**
  const result = content.replace(/(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, (match, innerText, offset, fullString) => {
    // Skip timestamps like *#00:01:27#*
    if (match.match(/\*#\d\d:\d\d:\d\d#\*/)) {
      return match;
    }
    if (match.match(/\*#\[?\d\d:\d\d:\d\d\]?#\*/)) {
      return match;
    }
    if (match.match(/\*\d\d:\d\d:\d\d\*/)) {
      return match;
    }
    
    const firstChar = innerText[0];
    const lastChar = innerText[innerText.length - 1];
    const last2Char = innerText[innerText.length - 2];
    
    // Check if ALL content is just punctuation/spaces - remove italic styling entirely
    if (/^[.,;:!?\-—()»«" ]+$/.test(innerText)) {
    //   console.log(`${match} -> ${innerText} (removing italic, only punctuation/spaces)`);
      modified = true;
      return innerText;
    }

    // Quote + scripture. Italic only quote.
    // «*парамадрита-бхакти-винода-падам» (Шри Прабхупада-падма-става, стих 7*)
    // console.log('==-=test2===', match)
    if ((firstChar === '«' || firstChar === '"') && (lastChar === ')' || last2Char === ')')) {
      return fixQuoteFormatting(match);
    }

    // If inner contents wrapped in () or «» and is full line - do not change
    if (isWrappedFullLine(innerText, '(', ')', match, offset, fullString) ||
        isWrappedFullLine(innerText, '«', '»', match, offset, fullString) ||
        isWrappedFullLine(innerText, null, '»', match, offset, fullString) ||
        isWrappedFullLine(innerText, '«', null, match, offset, fullString) ||
        isWrappedFullLine(innerText, null, '-', match, offset, fullString)) {
      return match;
    }
    
    // Check if first/last chars are letters (Latin or Cyrillic + combining diacritics)
    const isLetter = (char) => /[a-zA-Z\u0400-\u04FF\u0300-\u036F]/.test(char);
    
    const firstIsLetter = isLetter(firstChar);
    const lastIsLetter = isLetter(lastChar);
    
    let currentText = innerText;
    let prefixPunct = '';
    let suffixPunct = '';
    
    // If first char is not a letter, it might be punctuation or space at the beginning
    if (!firstIsLetter) {
      // Check if it's punctuation/spaces that should be moved outside from the beginning
      const beginMatch = currentText.match(/^([.,;:!?\-—()»«" ]+)(.+)$/);
      if (beginMatch) {
        prefixPunct = beginMatch[1];
        currentText = beginMatch[2];
        modified = true;
      } else {
        // Not punctuation/space, just log it
        console.log('---- nop:', match);
      }
    }
    
    // If last char is not a letter, it might be punctuation or space at the end
    if (!lastIsLetter) {
      // Check if it's punctuation/spaces that should be moved outside from the end
      const endMatch = currentText.match(/^(.+?)([.,;:!?\-—()»«" ]+)$/);
      if (endMatch) {
        currentText = endMatch[1];
        suffixPunct = endMatch[2];
        modified = true;
      } else if (!prefixPunct) {
        // Not punctuation/space, just log it (only if we didn't already log for prefix)
        console.log('---- nop:', match);
      }
    }
    
    let result;
    // If we made any changes, return the modified version
    if (prefixPunct || suffixPunct) {
      result = `${prefixPunct}*${currentText}*${suffixPunct}`;
    }

    if (result) {

      function splitLast(str) {
        return [str.slice(0, -1), str.slice(-1)];
      }
      function splitFirst(str) {
        return [str.slice(0, 1), str.slice(1)];
      }

      // Italic intersects quotes at start "...«*...»...*...".
      if (/«$/.test(prefixPunct) && /^[^\*]+»/.test(`${currentText}*${suffixPunct}`)) {
        // Replace first « and *: «*text»* → *«text»*
        const [before, last] = splitLast(prefixPunct);
        prefixPunct = before;
        currentText = last + currentText;
      }

      // Italic intersects quotes at start `..."*..."...*...`.
      if (/"$/.test(prefixPunct) && /^[^\*]+"/.test(`${currentText}*${suffixPunct}`)) {
        // Replace first " and *: "*text"* → *"text"*
        const [before, last] = splitLast(prefixPunct);
        prefixPunct = before;
        currentText = last + currentText;
      }

      // Italic intersects braces at start "...(*...)...*...".
      if (/\($/.test(prefixPunct) && /^[^\*]+\)/.test(`${currentText}*${suffixPunct}`)) {
        // Replace first ( and *: (*text)* → *(text)*
        const [before, last] = splitLast(prefixPunct);
        prefixPunct = before;
        currentText = last + currentText;
      }

      // Italic intersects quotes at end "...*...«...*»...".
      if (/^»/.test(suffixPunct) && /«[^\*]+$/.test(`${prefixPunct}*${currentText}`)) {
        // Replace first « and *: «*text»* → *«text»*
        const [first, after] = splitFirst(suffixPunct);
        suffixPunct = after;
        currentText = currentText + first;
      }

      // Italic intersects quotes at end `...*..."...*"...`.
      if (/^"/.test(suffixPunct) && /"[^\*]+$/.test(`${prefixPunct}*${currentText}`)) {
        // Replace first " and *: "*text"* → *"text"*
        const [first, after] = splitFirst(suffixPunct);
        suffixPunct = after;
        currentText = currentText + first;
      }

      // Italic intersects braces at end "...*...(...*)...".
      if (/^\)/.test(suffixPunct) && /\([^\*]+$/.test(`${prefixPunct}*${currentText}`)) {
        // Replace first ( and *: (*text)* → *(text)*
        const [first, after] = splitFirst(suffixPunct);
        suffixPunct = after;
        currentText = currentText + first;
      }

      result = `${prefixPunct}*${currentText}*${suffixPunct}`;

      // console.log('--- debug2:', result)

      return result;
    }
    
    // Return unchanged
    return match;
  });
  
  return {
    content: result,
    modified
  };
}

module.exports = { fixItalicBoundaries };

