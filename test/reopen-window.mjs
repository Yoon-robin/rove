// node test/drive.mjs test/reopen-window.mjs: a window closed while another stays comes back
// whole with Ctrl+Shift+T (its tabs, which one was in front, its pins and groups), as in Chrome
// and Edge; a tab closed after it comes back first (newest first). A private window closed is
// not kept. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.KEY = () => R.keys({ type: "keyDown", key: "T", control: true, shift: true });
globalThis.URLS = (w) => w.tabs.map((t) => t.url);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(u("main")); await sleep(500);
    R.createWindow({ urls: [u("a"), u("b"), u("c")] }); await sleep(1200);
    const w = R.windows[1]; R.select(w.tabs[1]); R.pin(w.tabs[0]); w.win.setBounds({ x: 140, y: 120, width: 900, height: 640 }); await sleep(300);
    return "windows " + R.windows.length + " " + JSON.stringify(URLS(w));` },
  { js: `R.windows[1].win.close(); await sleep(800); return "closed, windows " + R.windows.length;` },
  { js: `R.select(R.windows[0].tabs[0]); await sleep(200); KEY(); await sleep(1500);
    const w = R.windows[1];
    const got = w && { n: R.windows.length, urls: URLS(w), front: w.tabs.indexOf(w.active ?? (R.active?.w === w ? R.active : null)), pinned: w.tabs.map((t) => !!t.pinned), at: w.win.getNormalBounds() };
    return CHECK("Ctrl+Shift+T: the closed window back with its tabs", !!w && got.n === 2 && JSON.stringify(got.urls) === JSON.stringify([u("a"), u("b"), u("c")]) && got.pinned[0] === true && got.at.x === 140 && got.at.width === 900, got);` },
  // newest first: a window closed, then a tab closed — the tab comes back first, then the window
  { js: `R.windows[1].win.close(); await sleep(800); R.newTab(u("x")); await sleep(500); R.closeTab(R.active); await sleep(300);
    KEY(); await sleep(800); const first = { n: R.windows.length, last: URLS(R.windows[0]).slice(-1)[0] };
    KEY(); await sleep(1500);
    return CHECK("newest first: the tab, then the window", first.n === 1 && first.last === u("x") && R.windows.length === 2, { first, then: R.windows.length });` },
  { js: `R.windows[1].win.close(); await sleep(800); R.createWindow({ priv: true }); await sleep(1000);
    const p = R.windows.find((w) => w.private); R.select(p.tabs[0]); R.go(u("secret")); await sleep(500); p.win.close(); await sleep(800);
    R.select(R.windows[0].tabs[0]); const before = R.windows.length; KEY(); await sleep(1500);
    const back = R.windows.filter((w) => w.private).length;
    return CHECK("a private window is not kept", back === 0 && !R.windows.some((w) => w.tabs.some((t) => t.url === u("secret"))), { before, after: R.windows.length, back });` },
];
