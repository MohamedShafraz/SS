const fs = require("fs");
const path = require("path");

const size = 256;
const pixels = Buffer.alloc(size * size * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;

  const bottomUpY = size - 1 - y;
  const offset = (bottomUpY * size + x) * 4;
  pixels[offset] = b;
  pixels[offset + 1] = g;
  pixels[offset + 2] = r;
  pixels[offset + 3] = a;
}

function fillRoundedRect(x, y, width, height, radius, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const left = xx - x;
      const right = x + width - 1 - xx;
      const top = yy - y;
      const bottom = y + height - 1 - yy;
      const dx = Math.max(radius - Math.min(left, right), 0);
      const dy = Math.max(radius - Math.min(top, bottom), 0);

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(xx, yy, ...color);
      }
    }
  }
}

function fillCircle(cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(x, y, ...color);
      }
    }
  }
}

function fillRect(x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(xx, yy, ...color);
    }
  }
}

function line(x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    fillCircle(x, y, Math.floor(thickness / 2), color);
  }
}

fillRoundedRect(0, 0, size, size, 42, [9, 16, 35, 255]);
fillRoundedRect(22, 22, 212, 212, 32, [15, 23, 42, 255]);
fillRoundedRect(50, 68, 138, 70, 10, [37, 99, 235, 255]);
fillRoundedRect(62, 80, 114, 46, 8, [255, 255, 255, 255]);
fillRect(64, 146, 120, 14, [255, 255, 255, 255]);
line(184, 80, 206, 144, 14, [255, 255, 255, 255]);
line(72, 160, 182, 160, 14, [255, 255, 255, 255]);
fillCircle(85, 188, 18, [37, 99, 235, 255]);
fillCircle(171, 188, 18, [37, 99, 235, 255]);
fillCircle(85, 188, 8, [255, 255, 255, 255]);
fillCircle(171, 188, 8, [255, 255, 255, 255]);
fillRect(78, 92, 20, 22, [9, 16, 35, 255]);
fillRect(112, 92, 20, 22, [9, 16, 35, 255]);
fillRect(146, 92, 20, 22, [9, 16, 35, 255]);

const bitmapHeaderSize = 40;
const maskRowSize = Math.ceil(size / 32) * 4;
const mask = Buffer.alloc(maskRowSize * size);
const imageSize = bitmapHeaderSize + pixels.length + mask.length;
const buffer = Buffer.alloc(6 + 16 + imageSize);

let offset = 0;
buffer.writeUInt16LE(0, offset);
buffer.writeUInt16LE(1, offset + 2);
buffer.writeUInt16LE(1, offset + 4);
offset += 6;

buffer.writeUInt8(0, offset);
buffer.writeUInt8(0, offset + 1);
buffer.writeUInt8(0, offset + 2);
buffer.writeUInt8(0, offset + 3);
buffer.writeUInt16LE(1, offset + 4);
buffer.writeUInt16LE(32, offset + 6);
buffer.writeUInt32LE(imageSize, offset + 8);
buffer.writeUInt32LE(22, offset + 12);
offset += 16;

buffer.writeUInt32LE(bitmapHeaderSize, offset);
buffer.writeInt32LE(size, offset + 4);
buffer.writeInt32LE(size * 2, offset + 8);
buffer.writeUInt16LE(1, offset + 12);
buffer.writeUInt16LE(32, offset + 14);
buffer.writeUInt32LE(0, offset + 16);
buffer.writeUInt32LE(pixels.length, offset + 20);
buffer.writeInt32LE(0, offset + 24);
buffer.writeInt32LE(0, offset + 28);
buffer.writeUInt32LE(0, offset + 32);
buffer.writeUInt32LE(0, offset + 36);
offset += bitmapHeaderSize;

pixels.copy(buffer, offset);
offset += pixels.length;
mask.copy(buffer, offset);

const outFile = path.join(process.cwd(), "build", "icon.ico");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, buffer);
console.log(outFile);
