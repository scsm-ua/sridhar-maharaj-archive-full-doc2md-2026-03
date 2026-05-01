/*
Reads mp3-meta.json (produced by check-mp3.js) and adds meta.audio to each file.

meta.audio = { bytes: <file size in bytes>, duration: "hh:mm:ss" }
  (meta.audio.mp3 — the canonical path — is added later by 99-last.js)

The mp3-meta.json key is resolved from:
  - meta.legacy.mp3 if an override was set by 06-mp3.js
  - otherwise the .md stem + ".mp3"

Only fields present in mp3-meta.json are included (bytes and duration are optional).
*/

const fs   = require('fs');
const path = require('path');

const META_PATH = path.join(__dirname, '../../mp3-meta.json');

let _cache = null;

function loadMp3Meta() {
  if (_cache !== null) return _cache;
  _cache = {};
  if (!fs.existsSync(META_PATH)) return _cache;
  try { _cache = JSON.parse(fs.readFileSync(META_PATH, 'utf8')); } catch {}
  return _cache;
}

function extractAudioMeta(content, fileName, currentMeta) {
  const mp3Meta = loadMp3Meta();

  const stem = fileName.replace(/\.md$/, '');
  const mp3Filename = (currentMeta.legacy && currentMeta.legacy.mp3)
    ? currentMeta.legacy.mp3
    : stem + '.mp3';

  const info = mp3Meta[mp3Filename];
  if (!info) {
    return { content, meta: {}, modified: false };
  }

  const audio = {};
  if (info.bytes    != null) audio.bytes    = info.bytes;
  if (info.duration != null) audio.duration = info.duration;

  return { content, meta: { audio }, modified: true };
}

module.exports = { extractAudioMeta };
