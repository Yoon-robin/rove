// node test/drive.mjs test/page-keys.mjs: a page has its keys before Rove's shortcuts, as in Chrome
// (Google Docs' Ctrl+F and Ctrl+H are its own find and replace); a key the page does not take is
// Rove's at once; the few Chrome keeps (Ctrl+T, W, N, Tab) stay Rove's whatever the page does; where no
// word comes Rove still gets it. Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.wc = () => R.active.view.webContents;
globalThis.PRESS = (key, mods = ["control"]) => { const w = wc(); w.focus(); for (const type of ["keyDown", "keyUp"]) w.sendInputEvent({ type, keyCode: key, modifiers: mods }); };
globalThis.TAKE = (k) => wc().executeJavaScript("window.TAKE = " + JSON.stringify(k) + "; window.K = []; 1");
globalThis.SAW = () => wc().executeJavaScript("K");
globalThis.UNTIL = async (f, ms = 1500) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return Date.now() - t; await sleep(10); } return -1; };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
const PAGE = `window.K = []; addEventListener('keydown', (e) => { if (e.ctrlKey) { K.push(e.key); if (e.key === window.TAKE) e.preventDefault(); } }); 1`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(1500); await wc().executeJavaScript(${JSON.stringify(PAGE)}); return "page ready " + wc().getURL();` },
  { js: `await TAKE("f"); PRESS("F"); await sleep(700); const got = { saw: await SAW(), find: R.snapshot().findOpen };
    return CHECK("Ctrl+F the page takes: the page's, no Rove find bar", got.saw.includes("f") && !got.find, got);` },
  { js: `await TAKE("h"); PRESS("H"); await sleep(700); const got = { saw: await SAW(), overlay: R.overlayOn?.panel || R.overlayOn?.kind || null };
    return CHECK("Ctrl+H the page takes: no history drawer", got.saw.includes("h") && !got.overlay, got);` },
  { js: `await TAKE(null); PRESS("F"); const ms = await UNTIL(() => R.snapshot().findOpen); const saw = await SAW(); R.setFind(false); await sleep(200);
    return CHECK("Ctrl+F the page lets go: Rove's find bar, at once (the word, not the wait)", ms >= 0 && ms < 300 && saw.includes("f"), { ms, saw });` },
  { js: `await TAKE("t"); const n = R.tabs.length, t0 = R.active; PRESS("T"); await sleep(700); const got = { tabs: R.tabs.length - n, saw: await t0.view.webContents.executeJavaScript("K") };
    if (R.active !== t0) { R.closeTab(R.active); R.select(t0); await sleep(300); }
    return CHECK("Ctrl+T stays Rove's even when the page would take it", got.tabs === 1 && !got.saw.includes("t"), got);` },
  // no word (a frame of another site, a PDF, a page that stops the key before the listener): Rove after the wait.
  // (sendInputEvent goes to the top frame, so a real frame of another site is not tried here: a page whose own
  // earlier listener stops the key stands in for it)
  { js: `await wc().loadURL("data:text/html,<script>addEventListener('keydown', (e) => e.stopImmediatePropagation(), true)</script><p>stop"); await sleep(800);
    PRESS("F"); const ms = await UNTIL(() => R.snapshot().findOpen); R.setFind(false);
    return CHECK("no word: Rove's find bar after the wait", ms >= 300, { ms });` },
  { js: `R.go("https://example.com/"); await sleep(1500); await wc().executeJavaScript(${JSON.stringify(PAGE)}); await TAKE("d");
    const n = R.bookmarks.length; PRESS("D"); await sleep(700); const saw = await SAW();
    return CHECK("a page loaded again has the listener too (Ctrl+D taken: no bookmark)", saw.includes("d") && R.bookmarks.length === n, { saw, added: R.bookmarks.length - n });` },
];
