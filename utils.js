function getFilenameBase(meta) {
    const year = meta.date.year;
    const month = meta.date.month;
    let filename_base;
    if (month) {
      filename_base = `${year}/${String(month).padStart(2, '0')}/${meta.record_id}`;
    } else {
      filename_base = `${year}/${meta.record_id}`;
    }
    return filename_base;
}

export function getMP3Filename(meta) {
    return `${ getFilenameBase(meta) }_${meta.lang}.mp3`;
}

export function getMDFilename(meta) {
    return `${ getFilenameBase(meta) }.md`;
}
