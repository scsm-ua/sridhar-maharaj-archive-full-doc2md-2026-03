/*
Converts meta.record_id to date like YYYY.MM.DD.

If no day, or month - just skip, like YYYY, YYYY.MM.

Make date object:

meta.date = {year: , month:, day:} - last two optional.
*/

function extractDate(date_obj) {
    if (date_obj?.year) {
    const m = date_obj.month ? String(date_obj.month).padStart(2, '0') : '00';
    const d = date_obj.day ? String(date_obj.day).padStart(2, '0') : '00';
    return `${date_obj.year}-${m}-${d}`;
  }
}

/**
 * @param {string} content
 * @param {string} fileName
 * @param {Object} currentMeta
 * @returns {{ content: string, meta: Object, modified: boolean, warnings: string[], errors: string[] }}
 */
function recordIdToDate(content, fileName, currentMeta) {
  const warnings = [];
  const errors = [];

  const recordId = currentMeta && currentMeta.record_id;
  if (!recordId) {
    return { content, meta: {}, modified: false, warnings, errors };
  }

  // record_id format: YYYY.MM.DD[.suffixes...]
  // MM and DD may contain 'X' for unknown parts
  const parts = recordId.split('.');
  const year = parseInt(parts[0], 10);

  if (isNaN(year)) {
    errors.push(`Cannot parse year from record_id: ${recordId}`);
    return { content, meta: {}, modified: false, warnings, errors };
  }

  const date_obj = { year };

  if (parts.length >= 2 && !/X/i.test(parts[1])) {
    const month = parseInt(parts[1], 10);
    if (month && !isNaN(month)) {
      date_obj.month = month;

      if (parts.length >= 3 && !/X/i.test(parts[2])) {
        const day = parseInt(parts[2], 10);
        if (day && !isNaN(day)) {
          date_obj.day = day;
        }
      }
    }
  }

  const date = extractDate(date_obj);

  return {
    content,
    meta: { date },
    modified: true,
    warnings,
    errors,
  };
}

module.exports = { recordIdToDate };
