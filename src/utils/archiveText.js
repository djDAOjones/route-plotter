// JSZip 3.10.1's browser DataWorker slices strings at this UTF-16 boundary,
// then its encoder handles each slice independently. Keep the distribution
// pin in archiveText.test.js: another encoder needs this proof reviewed.
const ZIP_TEXT_CHUNK_UNITS = 16384;
const isHigh = code => code >= 0xD800 && code <= 0xDBFF;
const isLow = code => code >= 0xDC00 && code <= 0xDFFF;
const textFailure = () => new Error('Project text cannot be saved intact. '
  + 'Shorten a label or rename an image, then try again.');

/** Check the exact prepared JSON, before a checked action can change live state. */
export function assertArchiveTextSafe(projectJSON) {
  if (typeof projectJSON !== 'string') throw textFailure();
  for (let index = 0; index < projectJSON.length; index++) {
    const code = projectJSON.charCodeAt(index);
    if (isHigh(code)) {
      if (!isLow(projectJSON.charCodeAt(index + 1)) || (index + 1) % ZIP_TEXT_CHUNK_UNITS === 0) {
        throw textFailure();
      }
      index += 1;
    } else if (isLow(code)) {
      throw textFailure();
    }
  }
}
