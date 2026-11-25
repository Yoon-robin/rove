// electron tools/icon.cjs: draws rove.ico (16 to 256) from the kit's mark
// (a deep square, a white R, a blue light behind it), with Pretendard 900.
const { app, BrowserWindow } = require("electron");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

const SIZES = [16, 24, 32, 48, 64, 128, 256];
app.whenReady().then(async () => {
  const pngs = [];
  const w = new BrowserWindow({ show: false, width: 256, height: 256, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true } });
  for (const s of SIZES) {
    w.setContentSize(s, s);
    await w.loadFile(join(__dirname, "icon.html"), { query: { s: String(s) } }).catch(() => w.loadFile(join(__dirname, "icon.html"), { query: { s: String(s) } }));
    await w.webContents.executeJavaScript("document.fonts.ready.then(() => 1)");
    await new Promise((r) => setTimeout(r, 300));
    const img = await w.webContents.capturePage({ x: 0, y: 0, width: s, height: s });
    pngs.push({ s, png: img.resize({ width: s, height: s, quality: "best" }).toPNG() });
    if (s === 256) writeFileSync(join(__dirname, "..", "rove-256.png"), pngs.at(-1).png);
  }
  w.destroy();
  // an .ico of PNG entries (Windows Vista and later read these)
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let at = head.length;
  pngs.forEach(({ s, png }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(s >= 256 ? 0 : s, o); head.writeUInt8(s >= 256 ? 0 : s, o + 1);
    head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(png.length, o + 8); head.writeUInt32LE(at, o + 12);
    at += png.length;
  });
  writeFileSync(join(__dirname, "..", "rove.ico"), Buffer.concat([head, ...pngs.map((p) => p.png)]));
  console.log("rove.ico", SIZES.join(","));
  app.quit();
});
