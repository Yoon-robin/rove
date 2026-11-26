// node test/drive.mjs test/menu-anchor.mjs: the ≡ menu opens below its button (as Chrome's does),
// so pressing ≡ again to close it lands on the scrim, not on the menu's first row ("새 탭").
// Checked with the top tab strip and with side tabs (there ≡ sits above the overlay: hit ""). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.AT = async () => {
  const b = await R.win.webContents.executeJavaScript("(() => { const r = document.getElementById('menu').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom }; })()");
  const o = R.overlay.getBounds();
  const hit = await R.overlay.webContents.executeJavaScript("(() => { const e = document.elementFromPoint(" + (b.x - o.x) + ", " + (b.y - o.y) + "); const m = document.querySelector('.pop.menu').getBoundingClientRect(); return { hit: e?.className || '', menuTop: Math.round(m.top + " + o.y + "), menuBottom: Math.round(m.bottom + " + o.y + ") }; })()");
  return { button: Math.round(b.bottom), ...hit };
};
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
const at = (name) => ({ js: `R.showOverlay({ kind: "menu" }); await sleep(500); const a = await AT(); R.hideOverlay(); await sleep(200);
  return CHECK(${JSON.stringify(name)}, (a.hit.includes("scrim") || a.hit === "") && a.menuTop >= a.button, a);` });
export default [
  { js: H + `R.win.setContentSize(1280, 800); await sleep(400); return "ready";` },
  at("1280x800: ≡ again hits the scrim, menu under the button"),
  { js: `R.win.setContentSize(800, 600); await sleep(400); return 1;` },
  at("800x600: the same"),
  { js: `R.setVertical(true); await sleep(500); return 1;` },
  at("side tabs: the same"),
  { js: `R.setVertical(false); await sleep(300); return 1;` },
];
