// node test/drive.mjs test/hide-folded.mjs: vertical tabs folded to icons and "hide when folded" on —
// as Brave's "hide completely when collapsed": the strip goes, the page takes the room but for a
// thin edge, the pointer on that edge shows the tabs over the page; off again, the icons are back;
// the ≡ switch is there only with vertical tabs. The pointer is a stand-in, the hover an event —
// no real mouse. Local server only. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
const E = process.mainModule.require("electron"); globalThis.REAL = E.screen.getCursorScreenPoint;
globalThis.AT = null; E.screen.getCursorScreenPoint = () => AT || { x: -9999, y: -9999 };
globalThis.POINT = (x, y) => { const b = R.win.getContentBounds(); AT = { x: b.x + x, y: b.y + y }; };
globalThis.SIDE = () => R.win.webContents.executeJavaScript("(() => { const s = document.getElementById('side'); return { gone: s.classList.contains('tucked'), width: Math.round(s.getBoundingClientRect().width), list: !!document.getElementById('sidelist').getClientRects().length }; })()");
globalThis.EDGE = () => R.win.webContents.executeJavaScript("document.getElementById('side').dispatchEvent(new MouseEvent('mouseenter')), 1");
globalThis.MENU = () => R.overlay.webContents.executeJavaScript("(() => { const b = document.querySelector('[data-hide-folded]'); return b ? b.getAttribute('aria-checked') : null; })()");
globalThis.SAVED = () => JSON.parse(process.mainModule.require("node:fs").readFileSync(process.mainModule.require("node:path").join(process.env.ROVE_HOME, "settings.json"), "utf8")).hideFolded;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.loadURL(U("one")).catch(() => {}); R.newTab(U("two")); await sleep(1000);
    R.showOverlay({ kind: "menu" }); await sleep(500); const flat = await MENU(); R.hideOverlay();
    R.setVertical(true); await sleep(500); R.showOverlay({ kind: "menu" }); await sleep(500); const off = await MENU(); R.hideOverlay();
    const got = { flat, off };
    return CHECK("the ≡ switch: none with tabs across, off with vertical tabs", flat === null && off === "false", got);` },
  { js: `R.setNarrow(true); R.setHideFolded(true); await sleep(1000);
    const page = R.active.view.getBounds(), side = await SIDE(); await sleep(1000);
    const got = { page, side, frame: R.frame(), saved: SAVED() };
    return CHECK("folded and hidden: the page from the edge, the icons gone, kept in the settings", page.x === 4 && side.gone && side.width === 4 && !side.list && got.saved === true, got);` },
  { js: `POINT(2, 200); await EDGE(); await sleep(60); const early = R.overlayOn?.kind || null; await sleep(400);
    const o = R.overlay.getBounds(), kind = R.overlayOn?.kind, after = R.active.view.getBounds();
    const got = { early, kind, overlay: o, after };
    return CHECK("the pointer on the edge: the tabs over the page, the page where it was", !early && kind === "peek" && o.x === 0 && o.width === 240 && after.x === 4, got);` },
  { js: `POINT(400, 200); await sleep(400); const gone = R.overlayOn === null;
    R.setHideFolded(false); await sleep(600); const page = R.active.view.getBounds(), side = await SIDE();
    R.setNarrow(false); R.setVertical(false); await sleep(600); process.mainModule.require("electron").screen.getCursorScreenPoint = REAL; SRV.close();
    const got = { gone, page, side };
    return CHECK("the pointer off: gone; the switch off: the icons back", gone && page.x === 52 && !side.gone && side.width === 52 && side.list, got);` },
];
