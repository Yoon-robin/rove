// node test/drive.mjs test/tear.mjs: what docs/rove.md says is done, as a user meets it —
// a tab dragged out of the strip (a new window where it is let go, its page and Back list kept,
// not loaded again; let go on another window's tabs, it joins them; a window's only tab moves the
// window; the window left with none closes; side by side is undone; a private tab never goes into
// a normal window), and starting with the last run's tabs (only the one in front loads).
// A local server in Rove's main process that counts what it is asked for — no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.HITS = [];
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { if (q.url !== "/favicon.ico") HITS.push(q.url.slice(1)); s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.T = (w, n) => w.tabs.find((t) => t.title === n);
globalThis.NAMES = (w) => w.tabs.map((t) => t.title);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const w1 = R.windows[0]; R.active.view.webContents.loadURL(U("a")).catch(() => {}); const b = R.newTab(U("b1")); await sleep(800);
    b.view.webContents.loadURL(U("b")).catch(() => {}); R.newTab(U("c")); R.newTab(U("d")); await sleep(1200); globalThis.W1 = w1;
    const id = b.view.webContents.id, n = R.windows.length, cb = w1.win.getContentBounds(); HITS.length = 0;
    R.tear(b, cb.x + 300, cb.y + 300); await sleep(1500);
    const w2 = R.windows.find((w) => w !== w1 && !w.gone); globalThis.W2 = w2;
    const got = { windows: R.windows.length - n, there: w2 && NAMES(w2), sameView: b.view.webContents.id === id, back: b.view.webContents.navigationHistory.canGoBack(), loadedAgain: HITS, left: NAMES(w1), front: w2?.active === b, oldFront: !!w1.active && w1.active !== b, pos: w2?.win.getPosition() };
    return CHECK("a tab dragged out: a new window with it, its page and Back list kept, not loaded again", got.windows === 1 && got.there?.join() === "b" && got.sameView && got.back && !HITS.length &&
      got.left.join() === "a,c,d" && got.front && got.oldFront && got.pos[0] === cb.x + 180 && got.pos[1] === cb.y + 282, got);` },
  { js: `const b = W2.tabs[0], n = R.windows.length, cb = W1.win.getContentBounds(); R.tear(b, cb.x + 400, cb.y + 350); await sleep(500);
    const got = { windows: R.windows.length - n, tabs: NAMES(W2), pos: W2.win.getPosition() };
    return CHECK("a window's only tab dragged: the window moves, no new one", got.windows === 0 && got.tabs.join() === "b" && got.pos[0] === cb.x + 280 && got.pos[1] === cb.y + 332, got);` },
  { js: `const c = T(W1, "c"), b2 = W2.win.getContentBounds(); const inStrip = R.inStrip(W2, b2.x + 200, b2.y + 10); const n = R.windows.length;
    R.tear(c, b2.x + 200, b2.y + 10); await sleep(600);
    const got = { inStrip, windows: R.windows.length - n, there: NAMES(W2), left: NAMES(W1), front: W2.active === c, w: c.w === W2 };
    return CHECK("let go on another window's tabs: it joins them, in front there", inStrip && got.windows === 0 && got.there.join() === "b,c" && got.left.join() === "a,d" && got.front && got.w, got);` },
  // side by side: one of the two dragged out, the other takes the page; the window left empty closes
  { js: `R.use(W1); const [a, d] = W1.tabs; R.select(a); R.splitWith(d, a); await sleep(400); const was = !!R.split; const cb = W1.win.getContentBounds();
    R.tear(d, cb.x + 300, cb.y + 300); await sleep(1500); const w3 = R.windows.find((w) => w !== W1 && w !== W2 && !w.gone);
    R.use(W1); const got = { was, split: R.split, width: a.view.getBounds().width, area: cb.width - R.frame().left, w3: w3 && NAMES(w3) };
    R.moveToWindow(d, W2); await sleep(800); got.w3gone = !w3 || w3.gone; got.there = NAMES(W2);
    return CHECK("side by side undone when one is dragged out; the window left with no tab closes", was && got.split === null && Math.abs(got.width - got.area) <= 12 && got.w3?.join() === "d" && got.w3gone && got.there.join() === "b,c,d", got);` },
  // a pinned tab in a group: moved, it is neither (a group left empty goes)
  { js: `R.use(W2); const c = T(W2, "c"), b = T(W2, "b"); R.pin(b); const g = R.groupNew(c); await sleep(200);
    R.moveToWindow(b, W1); R.moveToWindow(c, W1); await sleep(600);
    const got = { b: { pinned: b.pinned, w1: b.w === W1 }, c: { group: c.group, w1: c.w === W1 }, groups: W2.groups.length, there: NAMES(W2), w1: NAMES(W1) };
    return CHECK("a pinned or grouped tab moved: it is neither there, its empty group goes", !b.pinned && got.b.w1 && c.group === null && got.c.w1 && got.groups === 0 && got.there.join() === "d" && got.w1.join() === "a,b,c", got);` },
  // a private tab never goes into a normal window, by menu or by dragging
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private && !w.gone); const pt = p.tabs[0];
    pt.view.webContents.loadURL(U("secret")).catch(() => {}); R.use(p); const pt2 = R.newTab(U("secret2")); await sleep(800);
    const b1 = W1.win.getContentBounds(); R.moveToWindow(pt, W1); R.tear(pt2, b1.x + 200, b1.y + 10); await sleep(1500);
    const normal = R.windows.filter((w) => !w.private && !w.gone).flatMap((w) => w.tabs.map((t) => t.title));
    const got = { normal, ptPrivate: pt.w.private, pt2Private: pt2.w.private, w1: NAMES(W1) };
    for (const w of R.windows.filter((w) => w.private && !w.gone)) w.win.close(); await sleep(800);
    return CHECK("a private tab never goes into a normal window", !normal.some((t) => t.startsWith("secret")) && got.ptPrivate && got.pt2Private && got.w1.join() === "a,b,c", got);` },
  // the last run's tabs: only the one in front loads, the others sleep (titles shown) until chosen
  { js: `HITS.length = 0; const n = R.windows.length;
    R.createWindow({ restore: { urls: [U("r1"), U("r2"), U("r3")], titles: ["One", "Two", "Three"], active: 1 } }); await sleep(2000);
    const w = R.windows[R.windows.length - 1]; const got = { made: R.windows.length - n, hits: [...HITS], asleep: w.tabs.map((t) => !!t.asleep), front: w.active === w.tabs[1], titles: w.tabs.map((t) => t.title) };
    R.use(w); R.select(w.tabs[2]); await sleep(1200); got.after = [...HITS]; got.woke = !w.tabs[2].asleep; w.win.close(); await sleep(500);
    return CHECK("starting with the last run's tabs: only the one in front loads", got.made === 1 && got.hits.join() === "r2" && JSON.stringify(got.asleep) === "[true,false,true]" && got.front &&
      got.titles[0] === "One" && got.after.join() === "r2,r3" && got.woke, got);` },
  { js: `R.use(W1); for (const w of R.windows.filter((w) => w !== W1 && !w.gone)) w.win.close(); SRV.close(); return undefined;` },
];
