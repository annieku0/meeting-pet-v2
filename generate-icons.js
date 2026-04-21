// Run with: node generate-icons.js
// Generates simple pixel art paw icon PNGs for the extension

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawPawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 16; // scale factor

  // Background
  ctx.fillStyle = '#1A1025';
  ctx.fillRect(0, 0, size, size);

  // Paw pad colors
  const pad = '#C060FF';
  const toe = '#E090FF';

  // Draw at 16-unit grid scaled to size
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, w * s, h * s);
  }

  // Main pad (center bottom)
  rect(4, 8, 8, 6, pad);

  // Three toe pads (top)
  rect(1, 4, 3, 3, toe);
  rect(6, 2, 4, 3, toe);
  rect(12, 4, 3, 3, toe);

  return canvas;
}

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

sizes.forEach(size => {
  const canvas = drawPawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png`);
});

console.log('Icons generated!');
