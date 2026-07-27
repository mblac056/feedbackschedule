const fs = require('fs');
const { PNG } = require('pngjs');

const outDir =
  'C:/Users/MichaelBlack/Developer/mblac056/feedbackschedule/.worktrees/publish-schedules/public/icons';
fs.mkdirSync(outDir, { recursive: true });

const base =
  'C:/Users/MichaelBlack/.cursor/projects/c-Users-MichaelBlack-Developer-mblac056-feedbackschedule/assets/';

function isBackground(r, g, b, a, blackIsBg) {
  if (a < 20) return true;
  if (blackIsBg && r + g + b < 40) return true;
  return false;
}

function cropToMask(png, { blackIsBg = true } = {}) {
  const { width: w, height: h, data } = png;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) * 4;
      if (isBackground(data[i], data[i + 1], data[i + 2], data[i + 3], blackIsBg)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX) throw new Error('No content in region');

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const outData = Buffer.alloc(cw * ch * 4);

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = (y * cw + x) * 4;
      if (isBackground(data[si], data[si + 1], data[si + 2], data[si + 3], blackIsBg)) {
        outData[di + 3] = 0;
      } else {
        // Opaque black silhouette for CSS mask / currentColor tinting
        outData[di] = 0;
        outData[di + 1] = 0;
        outData[di + 2] = 0;
        outData[di + 3] = 255;
      }
    }
  }

  const out = new PNG({ width: cw, height: ch });
  out.data = outData;
  return { out, cw, ch };
}

function write(name, result) {
  fs.writeFileSync(`${outDir}/${name}`, PNG.sync.write(result.out));
  console.log('wrote', name, `${result.cw}x${result.ch}`);
}

// Refresh asset: black ink on transparent
const refreshSheet = PNG.sync.read(
  fs.readFileSync(
    `${base}c__Users_MichaelBlack_AppData_Roaming_Cursor_User_workspaceStorage_069142d06437a50e463e6c2803634523_images_refresh-bb579e1f-5d02-419f-ba2c-649bd5e57858.png`
  )
);
write('icon-refresh.png', cropToMask(refreshSheet, { blackIsBg: false }));

// QR asset: dark navy on black background
const qrSheet = PNG.sync.read(
  fs.readFileSync(
    `${base}c__Users_MichaelBlack_AppData_Roaming_Cursor_User_workspaceStorage_069142d06437a50e463e6c2803634523_images_qr-code-515c13bc-b4f1-4b3a-b929-f826b7d82aa3.png`
  )
);
write('icon-qr.png', cropToMask(qrSheet, { blackIsBg: true }));
