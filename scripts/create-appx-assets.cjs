const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outDir = path.join(process.cwd(), "build", "appx");

const colors = {
  transparent: [0, 0, 0, 0],
  navy: [9, 16, 35, 255],
  panel: [15, 23, 42, 255],
  blue: [37, 99, 235, 255],
  teal: [20, 184, 166, 255],
  white: [255, 255, 255, 255],
  ink: [2, 8, 23, 255],
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createCanvas(width, height, fill = colors.transparent) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = fill[0];
    pixels[offset + 1] = fill[1];
    pixels[offset + 2] = fill[2];
    pixels[offset + 3] = fill[3];
  }
  return { width, height, pixels };
}

function blend(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (y * canvas.width + x) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  canvas.pixels[offset] = Math.round(color[0] * alpha + canvas.pixels[offset] * inverse);
  canvas.pixels[offset + 1] = Math.round(color[1] * alpha + canvas.pixels[offset + 1] * inverse);
  canvas.pixels[offset + 2] = Math.round(color[2] * alpha + canvas.pixels[offset + 2] * inverse);
  canvas.pixels[offset + 3] = Math.min(255, Math.round(color[3] + canvas.pixels[offset + 3] * inverse));
}

function roundedRect(canvas, x, y, width, height, radius, color) {
  for (let yy = Math.floor(y); yy < y + height; yy += 1) {
    for (let xx = Math.floor(x); xx < x + width; xx += 1) {
      const left = xx - x;
      const right = x + width - 1 - xx;
      const top = yy - y;
      const bottom = y + height - 1 - yy;
      const dx = Math.max(radius - Math.min(left, right), 0);
      const dy = Math.max(radius - Math.min(top, bottom), 0);
      if (dx * dx + dy * dy <= radius * radius) blend(canvas, xx, yy, color);
    }
  }
}

function circle(canvas, cx, cy, radius, color) {
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) blend(canvas, x, y, color);
    }
  }
}

function line(canvas, x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    circle(
      canvas,
      Math.round(x0 + (x1 - x0) * t),
      Math.round(y0 + (y1 - y0) * t),
      Math.max(1, Math.floor(thickness / 2)),
      color
    );
  }
}

function drawPosMark(canvas, x, y, size) {
  const u = size / 256;
  roundedRect(canvas, x, y, size, size, 42 * u, colors.navy);
  roundedRect(canvas, x + 22 * u, y + 22 * u, 212 * u, 212 * u, 32 * u, colors.panel);
  roundedRect(canvas, x + 50 * u, y + 68 * u, 138 * u, 70 * u, 10 * u, colors.blue);
  roundedRect(canvas, x + 62 * u, y + 80 * u, 114 * u, 46 * u, 8 * u, colors.white);
  roundedRect(canvas, x + 64 * u, y + 146 * u, 120 * u, 14 * u, 3 * u, colors.white);
  line(canvas, x + 184 * u, y + 80 * u, x + 206 * u, y + 144 * u, 14 * u, colors.white);
  line(canvas, x + 72 * u, y + 160 * u, x + 182 * u, y + 160 * u, 14 * u, colors.white);
  circle(canvas, x + 85 * u, y + 188 * u, 18 * u, colors.blue);
  circle(canvas, x + 171 * u, y + 188 * u, 18 * u, colors.blue);
  circle(canvas, x + 85 * u, y + 188 * u, 8 * u, colors.white);
  circle(canvas, x + 171 * u, y + 188 * u, 8 * u, colors.white);
  roundedRect(canvas, x + 78 * u, y + 92 * u, 20 * u, 22 * u, 2 * u, colors.ink);
  roundedRect(canvas, x + 112 * u, y + 92 * u, 20 * u, 22 * u, 2 * u, colors.ink);
  roundedRect(canvas, x + 146 * u, y + 92 * u, 20 * u, 22 * u, 2 * u, colors.ink);
}

function drawSquareTile(width, height) {
  const canvas = createCanvas(width, height, colors.transparent);
  const inset = Math.max(3, Math.round(Math.min(width, height) * 0.08));
  const bg = Math.min(width, height) - inset * 2;
  roundedRect(canvas, inset, inset, bg, bg, Math.max(6, bg * 0.16), [17, 94, 89, 255]);
  const markSize = bg * 0.78;
  drawPosMark(canvas, (width - markSize) / 2, (height - markSize) / 2, markSize);
  return canvas;
}

function drawWideTile(width, height) {
  const canvas = createCanvas(width, height, colors.transparent);
  roundedRect(canvas, 0, 0, width, height, Math.max(8, height * 0.1), [17, 94, 89, 255]);
  drawPosMark(canvas, height * 0.12, height * 0.12, height * 0.76);
  const barX = height * 0.98;
  roundedRect(canvas, barX, height * 0.28, width - barX - height * 0.14, height * 0.12, height * 0.04, colors.white);
  roundedRect(canvas, barX, height * 0.48, width - barX - height * 0.42, height * 0.08, height * 0.03, [96, 165, 250, 255]);
  roundedRect(canvas, barX, height * 0.64, width - barX - height * 0.28, height * 0.08, height * 0.03, colors.teal);
  return canvas;
}

function writePng(fileName, canvas) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    raw[rowStart] = 0;
    canvas.pixels.copy(raw, rowStart + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }

  const png = Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(outDir, fileName), png);
}

fs.mkdirSync(outDir, { recursive: true });

const squareAssets = [
  ["StoreLogo.png", 50],
  ["StoreLogo.scale-200.png", 100],
  ["Square44x44Logo.png", 44],
  ["Square44x44Logo.scale-200.png", 88],
  ["Square150x150Logo.png", 150],
  ["Square150x150Logo.scale-200.png", 300],
  ["SmallTile.png", 71],
  ["SmallTile.scale-200.png", 142],
  ["LargeTile.png", 310],
  ["LargeTile.scale-200.png", 620],
];

for (const [fileName, size] of squareAssets) {
  writePng(fileName, drawSquareTile(size, size));
}

writePng("Wide310x150Logo.png", drawWideTile(310, 150));
writePng("Wide310x150Logo.scale-200.png", drawWideTile(620, 300));
writePng("SplashScreen.png", drawWideTile(620, 300));

console.log(`AppX tile assets written to ${outDir}`);
