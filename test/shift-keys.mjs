// node test/drive.mjs test/shift-keys.mjs: Ctrl+Shift+W closes the window (not one tab) and
// Ctrl+Shift+D bookmarks every tab of the window (not a toggle of the one in front), as in Chrome;
// Ctrl+W and Ctrl+D stay as they were. Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.K = (key, shift) => R.keys({ type: "keyDown", key, control: true, shift: !!shift });
globalThis.MARKED = () => R.bookmarks.map((b) => b.url).filter((x) => x.startsWith(u(""))).sort();
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(u("a")); await sleep(600); R.newTab(u("b")); await sleep(600); R.newTab(u("c")); await sleep(600);
    R.select(R.tabs[1]); await sleep(200); K("d"); await sleep(200);
    return "start: " + JSON.stringify(MARKED());` },
  { js: `K("D", true); await sleep(300); const got = MARKED();
    return CHECK("Ctrl+Shift+D: every tab kept, the one already there stays", JSON.stringify(got) === JSON.stringify([u("a"), u("b"), u("c")]), got);` },
  { js: `K("d"); await sleep(300); const got = MARKED();
    return CHECK("Ctrl+D still takes the tab in front off", JSON.stringify(got) === JSON.stringify([u("a"), u("c")]), got);` },
  { js: `R.createWindow({ urls: [u("x"), u("y")] }); await sleep(1500); const n = R.windows.length, first = R.windows[0].tabs.length;
    K("W", true); await sleep(800);
    return CHECK("Ctrl+Shift+W: the window goes, the other stays as it was", R.windows.length === n - 1 && R.windows[0].tabs.length === first, { before: n, after: R.windows.length, first });` },
  { js: `R.select(R.windows[0].tabs[0]); await sleep(200); const n = R.tabs.length; K("w"); await sleep(500);
    return CHECK("Ctrl+W still closes one tab", R.tabs.length === n - 1 && R.windows.length === 1, { before: n, after: R.tabs.length });` },
  // from a page: Ctrl+Shift+W is one of the keys Rove keeps (a page cannot stop it)
  { js: `R.createWindow({ urls: [u("p")] }); await sleep(1500); const w = R.windows[1];
    await w.tabs[0].view.webContents.executeJavaScript("addEventListener('keydown', (e) => e.preventDefault(), true), 1");
    const wc = w.tabs[0].view.webContents; wc.focus(); for (const type of ["keyDown", "keyUp"]) wc.sendInputEvent({ type, keyCode: "W", modifiers: ["control", "shift"] }); await sleep(800);
    return CHECK("Ctrl+Shift+W from a page that takes every key: the window goes", R.windows.length === 1 && w.gone, { windows: R.windows.length });` },
];
