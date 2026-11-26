// node test/drive.mjs test/views.mjs: what docs/rove.md says is done, each as a user meets it —
// a site's zoom kept for the site (not for another site, not from a private window); two tabs side
// by side (each half of the page area, a ratio that keeps both readable, undone when one closes);
// reading mode (an article seen as readable, shown with no script of the page's, Back to the page);
// a tab put to sleep keeps its address and back list and comes back when chosen.
// A local server in Rove's main process (127.0.0.1 and localhost are two sites) — no network.
// Each line prints ok or FAIL.
const P = (n) => `<p>${"This is a long paragraph of the article, written to be read from start to end, sentence after sentence. ".repeat(6)} ${n}</p>`;
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (q.url.startsWith("/art")) return s.end(${JSON.stringify(`<title>An article</title><body><header>menu</header><article><h1>The headline</h1>${P(1)}${P(2)}<script>document.documentElement.dataset.ran = 1</script><img src="/none" onerror="document.documentElement.dataset.ran = 1">${P(3)}${P(4)}${P(5)}</article></body>`)});
  s.end("<title>" + q.url + "</title><p>short</p>");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
const port = SRV.address().port;
globalThis.A = "http://127.0.0.1:" + port; globalThis.B = "http://localhost:" + port;
globalThis.LOAD = async (tab, url) => { tab.view.webContents.loadURL(url).catch(() => {}); await sleep(900); };
globalThis.Z = (tab) => Math.round(tab.view.webContents.getZoomFactor() * 100) / 100;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  // zoom
  { js: H + `await LOAD(R.active, A + "/one"); R.zoom(1); R.zoom(1); await sleep(200);
    const t2 = R.newTab(A + "/two"); await sleep(1000); const t3 = R.newTab(B + "/three"); await sleep(1000);
    const got = { here: Z(R.tabs[0]), kept: R.settings.zoom["127.0.0.1"], sameSite: Z(t2), otherSite: Z(t3) };
    return CHECK("a site's zoom: kept for it, not for another site", got.here === 1.25 && got.kept === 1.25 && got.sameSite === 1.25 && got.otherSite === 1, got);` },
  { js: `R.select(R.tabs[0]); R.zoom(0); await sleep(200);
    return CHECK("zoom back to 100%: the site's entry goes", Z(R.tabs[0]) === 1 && !("127.0.0.1" in R.settings.zoom), R.settings.zoom);` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); const p = R.windows.find((w) => w.private); await LOAD(p.tabs[0], B + "/secret");
    R.use(p); R.select(p.tabs[0]); R.zoom(1); await sleep(200); const got = { zoomed: Z(p.tabs[0]), kept: R.settings.zoom };
    p.win.close(); await sleep(800);
    return CHECK("a private window's zoom is not kept", got.zoomed === 1.1 && !("localhost" in got.kept), got);` },
  // side by side
  { js: `R.use(R.windows[0]); while (R.tabs.length > 2) R.closeTab(R.tabs[R.tabs.length - 1]); await sleep(300);
    const [a, b] = R.tabs; R.select(a); R.splitWith(b, a); await sleep(500);
    const ba = a.view.getBounds(), bb = b.view.getBounds(), f = R.frame(), w = R.win.getContentBounds().width;
    const got = { split: !!R.split, shown: [a.view.getVisible(), b.view.getVisible()], a: ba, b: bb, sleepy: [R.canSleep(a), R.canSleep(b)] };
    return CHECK("two tabs side by side: both shown, side by side, neither put to sleep", got.split && got.shown.every(Boolean) && ba.x < bb.x && ba.x + ba.width <= bb.x &&
      Math.abs(ba.width - bb.width) <= 12 && bb.x + bb.width <= w && ba.y === bb.y && !got.sleepy.some(Boolean), got);` },
  { js: `R.splitRatio(0.02); await sleep(300); const [a, b] = R.tabs; const narrow = a.view.getBounds().width;
    R.splitRatio(0.98); await sleep(300); const other = b.view.getBounds().width; R.splitRatio(0.5);
    return CHECK("the divider stops where a side would get under 320px", narrow >= 318 && other >= 318, { narrow, other });` },
  { js: `const b = R.tabs[1]; R.closeTab(b); await sleep(400); const a = R.tabs[0];
    const got = { split: R.split, width: a.view.getBounds().width, area: R.win.getContentBounds().width - R.frame().left };
    return CHECK("closing one of the two: the other takes the whole page", got.split === null && Math.abs(got.width - got.area) <= 12, got);` },
  // reading mode
  { js: `await LOAD(R.active, A + "/art"); await sleep(1500);
    const t = R.active; const can = t.readable; await R.read(t); await sleep(1200);
    const wc = t.view.webContents, url = wc.getURL();
    const shown = await wc.executeJavaScript("({ h1: [...document.querySelectorAll('h1')].map((h) => h.textContent), paras: document.querySelectorAll('p').length, scripts: document.scripts.length, handlers: document.querySelectorAll('[onerror]').length, ran: document.documentElement.dataset.ran || null, menu: document.body.innerText.includes('menu') })").catch((e) => ({ err: e.message }));
    return CHECK("an article: readable, shown without the page's script or its menu", can === true && t.reader === true && url.startsWith("data:text/html") &&
      shown.h1.length >= 1 && shown.paras >= 5 && shown.scripts === 0 && shown.ran === null && !shown.menu, { can, reader: t.reader, shown });` },
  { js: `const t = R.active; await R.read(t); await sleep(1200);
    return CHECK("reading mode again: back to the page", t.reader === false && t.view.webContents.getURL() === A + "/art", { reader: t.reader, url: t.view.webContents.getURL() });` },
  { js: `await LOAD(R.active, A + "/plain"); await sleep(1500);
    return CHECK("a page with no article: not readable", R.active.readable === false, R.active.readable);` },
  // sleeping tabs
  { js: `const t = R.newTab(B + "/s1"); await sleep(1000); await LOAD(t, B + "/s2"); R.select(R.tabs[0]); await sleep(300);
    const before = t.view.webContents.id; const slept = R.sleepTab(t); await sleep(1500);
    const got = { slept, asleep: !!t.asleep, newView: t.view.webContents.id !== before, url: t.url, entries: t.asleep?.entries.map((e) => e.url.replace(B, "")) };
    return CHECK("a tab put to sleep: its page goes, its address and back list stay", slept && got.asleep && got.newView && got.url === B + "/s2" && JSON.stringify(got.entries) === '["/s1","/s2"]', got);` },
  { js: `const t = R.tabs[R.tabs.length - 1]; R.select(t); await sleep(1500); const wc = t.view.webContents;
    const got = { asleep: !!t.asleep, url: wc.getURL(), back: wc.navigationHistory.canGoBack() };
    return CHECK("chosen again: it wakes on its page, Back still there", !got.asleep && got.url === B + "/s2" && got.back, got);` },
  { js: `R.select(R.tabs[0]); await sleep(200); const t = R.tabs[R.tabs.length - 1]; t.seen = 0; R.settings.sleep = false; R.sleepIdle(); await sleep(300); const off = !!t.asleep;
    R.settings.sleep = true; R.sleepIdle(); await sleep(1500); const on = !!t.asleep;
    return CHECK("idle tabs sleep only with the setting on", !off && on, { off, on });` },
  // a tab opened behind stays behind (Ctrl+click, a middle click): the extensions take every tab
  // Rove gives them as the chosen one, and asked Rove to choose it
  { js: `const front = R.active; const bg = R.newTab(A + "/behind", { background: true }); await sleep(800);
    const got = { stayed: R.active === front, bgActive: R.active === bg };
    return CHECK("a tab opened behind stays behind", got.stayed, got);` },
  { js: `SRV.close(); return undefined;` },
];
