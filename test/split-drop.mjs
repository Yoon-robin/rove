// node test/drive.mjs test/split-drop.mjs: a tab dragged from the strip and let go at the page's
// left or right edge goes side by side with the tab in front, on that side (Brave's "split view drag
// and drop at the window's edge"); while it is held there the half it would take is shown. Let go in
// the middle of the page, it still goes to a window of its own; the tab in front is never offered.
// Mouse events go into the hidden window's strip (sendInputEvent). Local server only. ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.NAMES = () => R.tabs.map((t) => t.title);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
// press on the tab's middle in the strip, move in steps to (x, y), look, then let go
globalThis.DRAG = async (tab, x, y) => {
  const wc = R.win.webContents;
  const r = await wc.executeJavaScript("(() => { const b = document.querySelector('.tab[data-id=\\"" + tab.id + "\\"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()");
  const ev = (type, px, py) => wc.sendInputEvent({ type, x: Math.round(px), y: Math.round(py), button: "left", clickCount: 1 });
  ev("mouseDown", r.x, r.y); await sleep(50);
  for (let i = 1; i <= 8; i++) { ev("mouseMove", r.x + (x - r.x) * i / 8, r.y + (y - r.y) * i / 8); await sleep(40); }
  await sleep(400);
  const half = R.overlayOn && await R.overlay.webContents.executeJavaScript("(() => { const b = document.querySelector('.splitdrop .half')?.getBoundingClientRect(); return b && { top: b.top, left: b.left, right: b.right }; })()");
  const f = R.frame(), w = R.win.getContentBounds().width, mid = f.left + (w - f.left) / 2;
  const held = R.overlayOn ? { kind: R.overlayOn.kind, side: R.overlayOn.side, shown: R.overlay.getVisible(), half,
    onPage: !!half && half.top >= f.top && half.left >= f.left && (R.overlayOn.side === "left" ? half.right <= mid : half.left >= mid) } : null;
  ev("mouseUp", x, y); await sleep(700);
  return held;
};`;
export default [
  { js: H + `R.win.setContentSize(1200, 800); R.active.view.webContents.loadURL(U("a")).catch(() => {}); for (const n of ["b", "c", "d"]) R.newTab(U(n)); await sleep(1500);
    R.select(R.tabs[0]); await sleep(300);
    const a = R.tabs[0], c = R.tabs[2], f = R.frame(), w = R.win.getContentBounds().width;
    const held = await DRAG(c, w - 30, f.top + 300);
    const s = R.split, got = { held, split: s && [s.a.title, s.b.title], front: R.active?.title, strip: NAMES(), overlay: R.overlayOn, windows: R.windows.filter((x) => !x.gone).length };
    return CHECK("held at the right edge: the right half shown; let go: side by side on the right, it in front, the strip as it was", held?.kind === "splitdrop" && held.side === "right" && held.shown && held.onPage &&
      got.split?.join() === "a,c" && got.front === "c" && got.strip.join() === "a,b,c,d" && !got.overlay && got.windows === 1, got);` },
  { js: `R.unsplit(); R.select(R.tabs[0]); await sleep(300); const d = R.tabs[3], f = R.frame();
    const held = await DRAG(d, f.left + 30, f.top + 300);
    const s = R.split, got = { held, split: s && [s.a.title, s.b.title], front: R.active?.title, strip: NAMES() };
    return CHECK("let go at the left edge: on the left, though it is after in the strip", held?.side === "left" && held.onPage && got.split?.join() === "d,a" && got.front === "d" && got.strip.join() === "a,b,c,d", got);` },
  { js: `R.unsplit(); const a = R.tabs[0]; R.select(a); await sleep(300); const f = R.frame(), w = R.win.getContentBounds().width;
    const held = await DRAG(a, w - 30, f.top + 300);
    const got = { held, split: R.split, windows: R.windows.filter((x) => !x.gone).length };
    for (const x of R.windows.filter((x) => x !== R.windows[0] && !x.gone)) x.win.close(); await sleep(500);
    return CHECK("the tab in front at the edge: nothing offered, it is not paired with itself", !got.held && !got.split, got);` },
  { js: `R.use(R.windows[0]); R.unsplit(); R.select(R.tabs[0]); await sleep(300); const b = R.tabs.find((t) => t.title === "b"), f = R.frame(), w = R.win.getContentBounds().width;
    const n = R.windows.filter((x) => !x.gone).length;
    const held = await DRAG(b, w / 2, f.top + 300); await sleep(800);
    const got = { held, split: R.split, windows: R.windows.filter((x) => !x.gone).length - n };
    for (const x of R.windows.filter((x) => x !== R.windows[0] && !x.gone)) x.win.close(); await sleep(500); SRV.close();
    return CHECK("let go in the middle of the page: a window of its own, as before", !got.held && !got.split && got.windows === 1, got);` },
];
