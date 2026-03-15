#!/usr/bin/env node
/**
 * generate-icon.js
 *
 * Creates a placeholder 512×512 icon PNG in build-resources/icon.png.
 * electron-builder will auto-convert this PNG to:
 *   - .icns  for macOS
 *   - .ico   for Windows
 *   - .png   as-is for Linux
 *
 * Replace build-resources/icon.png with your actual app icon before release.
 * The script is a no-op if icon.png already exists.
 *
 * Zero dependencies — uses only Node.js built-ins (zlib, fs, path).
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const OUT_DIR  = path.resolve(__dirname, '../build-resources');
const OUT_FILE = path.join(OUT_DIR, 'icon.png');

if (fs.existsSync(OUT_FILE)) {
  console.log(`  Icon exists: ${OUT_FILE} — skipping generation`);
  process.exit(0);
}

// ── Palette ──────────────────────────────────────────────────────────────────

const SIZE = 512;

// Brand blue
const BLUE = [26, 90, 150];
// Lighter accent
const ACCENT = [64, 160, 220];
// White
const WHITE = [255, 255, 255];

// ── Minimal PNG encoder ───────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function buildPng(size) {
  // Raw scanlines: 1 filter byte (None=0) + RGBA pixels
  const raw = Buffer.alloc(size * (1 + size * 4), 0);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = size * 0.30;

  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      if (d < outerR) {
        // Background circle — gradient from BLUE to ACCENT radially
        const t = d / outerR;
        r = Math.round(BLUE[0] + (ACCENT[0] - BLUE[0]) * t * 0.6);
        g = Math.round(BLUE[1] + (ACCENT[1] - BLUE[1]) * t * 0.6);
        b = Math.round(BLUE[2] + (ACCENT[2] - BLUE[2]) * t * 0.6);
        a = 255;

        // White "RP" rendered as two simple rectangles for the R and a dot for the P
        // Simplified: draw a thick white upward-trending diagonal line (chart trend icon)
        const nx = (x - cx) / outerR;  // normalised −1…1
        const ny = (y - cy) / outerR;

        // Ascending line: y ≈ −0.5x (chart going up-right)
        const lineW  = 0.07;
        const onLine = Math.abs(ny + 0.5 * nx) < lineW && nx > -0.5 && nx < 0.5;

        // Arrowhead at top-right of line
        const arrowTipX =  0.50;
        const arrowTipY = -0.25;
        const arrowDist  = Math.sqrt((nx - arrowTipX) ** 2 + (ny - arrowTipY) ** 2);
        const onArrow    = arrowDist < 0.13;

        if (onLine || onArrow) {
          r = WHITE[0]; g = WHITE[1]; b = WHITE[2]; a = 255;
        }
      }

      const off = y * (1 + size * 4) + 1 + x * 4;
      raw[off]     = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Write output ──────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });
const png = buildPng(SIZE);
fs.writeFileSync(OUT_FILE, png);
console.log(`  Generated placeholder icon: ${OUT_FILE}  (${(png.length / 1024).toFixed(1)} KB)`);
console.log('  ⚠  Replace build-resources/icon.png with your actual app icon before release.');
