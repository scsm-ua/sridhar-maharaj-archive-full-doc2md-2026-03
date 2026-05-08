function getFilenameBase(meta) {
    const date_bits = meta.date.split('-');
    const year = date_bits[0];
    const month = date_bits[1];
    let filename_base;
    if (month && parseInt(month)) {
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
