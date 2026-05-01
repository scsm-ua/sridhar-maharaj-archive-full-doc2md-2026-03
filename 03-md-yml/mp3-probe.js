/*
Fetches the beginning of a remote MP3 file and parses its duration.

Strategy:
  1. Fetch the first 1 MB. Read the ID3v2 tag size from bytes 0-9.
  2. If audio starts within that buffer → parse directly (Xing/VBRI VBR or CBR).
  3. If the ID3 tag is larger than 1 MB → issue a second 8 KB range request
     starting exactly at the tag end, then parse that small buffer.

Exports:
  probeRemoteMp3(url) → Promise<{ status, contentType, totalSize, duration, error? }>
    - status:      HTTP status code (or null on network error)
    - contentType: value of Content-Type response header
    - totalSize:   total file size in bytes (or null)
    - duration:    "hh:mm:ss" string (or null if unparseable)
    - error:       error message string if the request failed
*/

'use strict';

const https = require('https');
const http  = require('http');

// How many bytes to fetch — enough to clear large ID3v2 tags (e.g. embedded cover art)
const FETCH_SIZE = 1048576; // 1 MB

// MPEG Layer 3 bitrates in kbps, indexed by [mpegVersion][bitrateIndex]
const L3_BITRATES = {
  1:  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2:  [0,  8, 16, 24, 32, 40, 48, 56,  64,  80,  96, 112, 128, 144, 160, 0],
  25: [0,  8, 16, 24, 32, 40, 48, 56,  64,  80,  96, 112, 128, 144, 160, 0],
};

// Sample rates in Hz, indexed by [mpegVersion][sampleRateIndex]
const SAMPLE_RATES = {
  1:  [44100, 48000, 32000, 0],
  2:  [22050, 24000, 16000, 0],
  25: [11025, 12000,  8000, 0],
};

/**
 * Read the ID3v2 tag end offset from the first 10 bytes.
 * Returns the byte offset where audio data begins (file-relative).
 * Returns 0 if no ID3 tag is present.
 */
function id3EndOffset(buffer) {
  if (buffer.length < 10) return 0;
  if (buffer[0] !== 0x49 || buffer[1] !== 0x44 || buffer[2] !== 0x33) return 0;
  const flags   = buffer[5];
  const tagSize = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) |
                  ((buffer[8] & 0x7f) <<  7) |  (buffer[9] & 0x7f);
  return 10 + tagSize + ((flags & 0x10) ? 10 : 0);
}

/**
 * Scan a buffer (which starts at fileOffset within the file) for the first
 * valid MPEG Layer 3 frame and compute duration from Xing/VBRI/CBR.
 * @param {Buffer} buffer
 * @param {number} fileOffset - byte position in the file where buffer starts
 * @param {number|null} fileSize
 * @returns {number|null} seconds
 */
function parseDurationFromBuffer(buffer, fileOffset, fileSize) {
  for (let i = 0; i < buffer.length - 3; i++) {
    if (buffer[i] !== 0xFF || (buffer[i + 1] & 0xE0) !== 0xE0) continue;

    const b1 = buffer[i + 1];
    const b2 = buffer[i + 2];
    const b3 = buffer[i + 3];

    const versionBits = (b1 >> 3) & 0x03;
    let mpegVersion;
    if      (versionBits === 0x03) mpegVersion = 1;
    else if (versionBits === 0x02) mpegVersion = 2;
    else if (versionBits === 0x00) mpegVersion = 25;
    else continue;

    if (((b1 >> 1) & 0x03) !== 0x01) continue; // Layer 3 only

    const bitrateIdx    = (b2 >> 4) & 0x0F;
    const sampleRateIdx = (b2 >> 2) & 0x03;
    const channelMode   = (b3 >> 6) & 0x03;

    const bitrate    = (L3_BITRATES[mpegVersion]  || [])[bitrateIdx];
    const sampleRate = (SAMPLE_RATES[mpegVersion] || [])[sampleRateIdx];
    if (!bitrate || !sampleRate) continue;

    const sideInfoSize = mpegVersion === 1
      ? (channelMode === 3 ? 17 : 32)
      : (channelMode === 3 ?  9 : 17);

    // Xing/Info VBR header
    const xingOff = i + 4 + sideInfoSize;
    if (xingOff + 8 <= buffer.length) {
      const tag = buffer.slice(xingOff, xingOff + 4).toString('ascii');
      if (tag === 'Xing' || tag === 'Info') {
        const xingFlags = buffer.readUInt32BE(xingOff + 4);
        if (xingFlags & 0x01) {
          const totalFrames     = buffer.readUInt32BE(xingOff + 8);
          const samplesPerFrame = mpegVersion === 1 ? 1152 : 576;
          return Math.round(totalFrames * samplesPerFrame / sampleRate);
        }
      }

      // VBRI header
      if (mpegVersion === 1) {
        const vbriOff = i + 4 + 32;
        if (vbriOff + 18 <= buffer.length) {
          const vbriTag = buffer.slice(vbriOff, vbriOff + 4).toString('ascii');
          if (vbriTag === 'VBRI') {
            const totalFrames = buffer.readUInt32BE(vbriOff + 14);
            return Math.round(totalFrames * 1152 / sampleRate);
          }
        }
      }
    }

    // CBR: estimate from remaining file bytes
    const audioStart = fileOffset + i;
    if (fileSize && fileSize > audioStart) {
      return Math.round((fileSize - audioStart) * 8 / (bitrate * 1000));
    }

    return null;
  }

  return null;
}

/**
 * Fetch the first FETCH_SIZE bytes of a remote MP3, then parse its duration.
 * If the ID3 tag is larger than FETCH_SIZE, issues a second small range request
 * starting just after the tag to locate the first audio frame.
 * @param {string} url
 * @returns {Promise<{ status: number|null, contentType: string, totalSize: number|null, duration: string|null, error?: string }>}
 */
function secondsToHms(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Fetch bytes [start, start+size) of url into a Buffer. */
function fetchRange(url, start, size) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    let settled = false;
    const settle = (r) => { if (!settled) { settled = true; resolve(r); } };
    const req = lib.request(
      url,
      { method: 'GET', headers: { Range: `bytes=${start}-${start + size - 1}` } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        const done = () => settle({ ok: true, buffer: Buffer.concat(chunks) });
        res.on('end', done);
        res.on('close', done);
        res.on('error', () => settle({ ok: false }));
      }
    );
    req.on('error', () => settle({ ok: false }));
    req.setTimeout(15000, () => { req.destroy(); settle({ ok: false }); });
    req.end();
  });
}

async function probeRemoteMp3(url) {
  // --- first request: up to FETCH_SIZE bytes from the start ---
  const { status, contentType, totalSize, buffer } = await new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    let settled = false;
    const settle = (r) => { if (!settled) { settled = true; resolve(r); } };

    const req = lib.request(
      url,
      { method: 'GET', headers: { Range: `bytes=0-${FETCH_SIZE - 1}` } },
      (res) => {
        const contentType = res.headers['content-type'] || '';
        let totalSize = null;
        const cr = res.headers['content-range'];
        if (cr) { const m = cr.match(/\/(\d+)$/); if (m) totalSize = parseInt(m[1]); }
        if (totalSize === null && res.headers['content-length']) totalSize = parseInt(res.headers['content-length']);

        const chunks = [];
        let received = 0;
        res.on('data', (chunk) => {
          if (received >= FETCH_SIZE) return;
          chunks.push(chunk);
          received += chunk.length;
          if (received >= FETCH_SIZE) req.socket && req.socket.destroy();
        });
        const done = () => settle({ status: res.statusCode, contentType, totalSize, buffer: Buffer.concat(chunks) });
        res.on('end', done);
        res.on('close', done);
        res.on('error', () => settle({ status: null, contentType: '', totalSize: null, buffer: null, error: 'response error' }));
      }
    );
    req.on('error', (err) => settle({ status: null, contentType: '', totalSize: null, buffer: null, error: err.message }));
    req.setTimeout(20000, () => { req.destroy(); settle({ status: null, contentType: '', totalSize: null, buffer: null, error: 'timeout' }); });
    req.end();
  });

  if (!buffer) return { status, contentType, totalSize: null, duration: null, error: 'request failed' };

  // --- try to parse from the first buffer ---
  const audioStart = id3EndOffset(buffer);

  if (audioStart < buffer.length) {
    // Audio data is within the first buffer
    const audioBuffer = buffer.slice(audioStart);
    const secs = parseDurationFromBuffer(audioBuffer, audioStart, totalSize);
    return { status, contentType, totalSize, duration: secs != null ? secondsToHms(secs) : null };
  }

  // --- ID3 tag is larger than FETCH_SIZE: second targeted request ---
  const FRAME_PROBE = 8192; // 8 KB is enough to hold the first frame header + Xing/VBRI
  const { ok, buffer: frameBuffer } = await fetchRange(url, audioStart, FRAME_PROBE);
  if (!ok || !frameBuffer) {
    return { status, contentType, totalSize, duration: null };
  }

  const secs = parseDurationFromBuffer(frameBuffer, audioStart, totalSize);
  return { status, contentType, totalSize, duration: secs != null ? secondsToHms(secs) : null };
}

module.exports = { probeRemoteMp3 };
