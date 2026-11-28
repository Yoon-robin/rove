// node test/drive.mjs test/vertical.mjs: vertical tabs, as a user meets them — turned on, the tabs
// are a list at the left (in every window), the page starts after it and under the one toolbar row;
// folded to icons the list is narrow and the page wider; the find row and two tabs side by side fit
// in what is left; a tab let go on the list joins it; it is kept for the next start; turned off, the
// strip is back on top. A local server in Rove's main process — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs"); globalThis.PATH = process.mainModule.require("node:path");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.UI = (w = R.win) => w.webContents.executeJavaScript("(() => { const s = document.getElementById('side'), l = document.getElementById('sidelist'); return { side: !s.hidden, narrow: s.classList.contains('narrow'), width: Math.round(s.getBoundingClientRect().width), rows: l ? l.querySelectorAll('.tab').length : 0, strip: document.getElementById('tabs-home').querySelectorAll('.tab').length, vertical: document.body.classList.contains('vertical') }; })()");
globalThis.PAGE = (t) => t.view.getBounds();
globalThis.SAVED = () => { try { return JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "settings.json"), "utf8")); } catch { return {}; } };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.loadURL(U("one")).catch(() => {}); R.newTab(U("two")); R.newTab(U("three")); await sleep(1200);
    R.createWindow(); await sleep(1500); globalThis.W2 = R.windows[R.windows.length - 1]; R.use(R.windows[0]);
    R.setVertical(true); await sleep(1500);
    const cb = R.win.getContentBounds(), p = PAGE(R.active), ui = await UI(), ui2 = await UI(W2.win), saved = SAVED();
    const got = { ui, ui2, page: p, frame: R.frame(), width: cb.width, saved: saved.vertical };
    return CHECK("on: the tabs at the left in every window, the page after them under one row, kept", ui.side && ui.vertical && ui.rows === 3 && ui.strip === 0 && ui.width >= 236 && ui.width <= 244 &&
      ui2.side && p.x === 240 && p.y === 44 && p.x + p.width <= cb.width && cb.width - p.x - p.width <= 12 && got.saved === true, got);` },
  { js: `R.setNarrow(true); await sleep(800); const cb = R.win.getContentBounds(), p = PAGE(R.active), ui = await UI();
    const got = { ui, page: p, saved: SAVED().narrow };
    R.setNarrow(false); await sleep(600); got.back = PAGE(R.active).x;
    return CHECK("folded to icons: the list narrow, the page wider; unfolded again", ui.narrow && ui.width <= 56 && p.x === 52 && cb.width - p.x - p.width <= 12 && got.saved === true && got.back === 240, got);` },
  { js: `R.setFind(true); await sleep(500); const f = PAGE(R.active); R.setFind(false); await sleep(400);
    const [a, b] = R.tabs; R.select(a); R.splitWith(b, a); await sleep(500); const pa = PAGE(a), pb = PAGE(b), cb = R.win.getContentBounds(); R.unsplit(); await sleep(300);
    const got = { find: f, a: pa, b: pb, width: cb.width };
    return CHECK("the find row and two side by side fit in what is left", f.y === 88 && f.x === 240 && pa.x === 240 && pa.x + pa.width <= pb.x && pb.x + pb.width <= cb.width && pa.y === pb.y && pa.y === 44 + 24, got);` },
  { js: `const b2 = W2.win.getContentBounds(); const inList = R.inStrip(W2, b2.x + 100, b2.y + 300), onTop = R.inStrip(W2, b2.x + 600, b2.y + 10);
    const t = R.tabs[2]; R.tear(t, b2.x + 100, b2.y + 300); await sleep(800);
    const got = { inList, onTop, moved: t.w === W2, there: W2.tabs.length };
    return CHECK("a tab let go on another window's list joins it (the top row is no strip now)", inList && !onTop && got.moved && got.there === 2, got);` },
  { js: `R.use(R.windows[0]); R.setVertical(false); await sleep(1200); const p = PAGE(R.active), ui = await UI(), ui2 = await UI(W2.win);
    const got = { ui, ui2, page: p, saved: SAVED().vertical }; W2.win.close(); SRV.close(); await sleep(500);
    return CHECK("off: the strip on top again, everywhere, kept", !ui.side && !ui.vertical && ui.strip === 2 && !ui2.side && p.x === 0 && p.y === 84 && got.saved === false, got);` },
];
