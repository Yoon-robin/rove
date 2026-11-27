// node test/drive.mjs test/more-keys.mjs: Chrome's other default keys — Ctrl+PgUp/PgDn (the tab
// before, after), Ctrl+Shift+PgUp/PgDn (move the tab), Ctrl+F4 (close it), F3·Shift+F3·Ctrl+G·
// Ctrl+Shift+G (the next, the last match of the find box), Esc (stop loading), Ctrl+U (the page's
// source in a new tab), Alt+Home (the home page), Alt+F (the ≡ menu). Needs the network
// (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.u = (t) => "https://example.com/?" + t;
globalThis.KEY = (key, m = "") => R.keys({ type: "keyDown", key, control: m.includes("c"), shift: m.includes("s"), alt: m.includes("a") });
globalThis.AT = () => R.tabs.indexOf(R.active);
globalThis.ORDER = () => R.tabs.map((t) => t.view.webContents.getURL().split("?")[1] || t.view.webContents.getURL());
globalThis.FIND_ROW = () => R.win.webContents.executeJavaScript("!document.getElementById('find').hidden");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(u("a")); await sleep(800); R.newTab(u("b")); await sleep(800); R.newTab(u("c")); await sleep(800);
    R.select(R.tabs[0]); await sleep(200); const seen = [];
    KEY("PageDown", "c"); seen.push(AT()); KEY("PageUp", "c"); seen.push(AT()); KEY("PageUp", "c"); seen.push(AT());
    return CHECK("Ctrl+PgDn·PgUp: the tab after, before (round at the ends)", JSON.stringify(seen) === "[1,0,2]", seen);` },
  { js: `R.select(R.tabs[0]); await sleep(200); KEY("PageDown", "cs"); await sleep(200); const after = ORDER(); KEY("PageUp", "cs"); await sleep(200);
    return CHECK("Ctrl+Shift+PgDn·PgUp: the tab moves right, back", after.join() === "b,a,c" && ORDER().join() === "a,b,c" && AT() === 0, { after, back: ORDER() });` },
  { js: `R.select(R.tabs[2]); await sleep(200); const n = R.tabs.length; KEY("F4", "c"); await sleep(400);
    return CHECK("Ctrl+F4: the tab closes", R.tabs.length === n - 1 && ORDER().join() === "a,b", ORDER());` },
  { js: `R.select(R.tabs[0]); await sleep(300); R.setFind(true); await sleep(300);
    await R.win.webContents.executeJavaScript("(() => { const f = document.getElementById('findText'); f.value = 'Example'; f.dispatchEvent(new Event('input')); return 1; })()"); await sleep(300);
    const wc = R.active.view.webContents, was = wc.findInPage.bind(wc), got = [];
    wc.findInPage = (t, o) => { got.push([t, o.forward, o.findNext]); return was(t, o); };
    KEY("F3"); KEY("F3", "s"); KEY("g", "c"); KEY("G", "cs"); await sleep(200); wc.findInPage = was;
    return CHECK("F3·Shift+F3·Ctrl+G·Ctrl+Shift+G: next, last, next, last of the find box", JSON.stringify(got) === JSON.stringify([["Example", true, true], ["Example", false, true], ["Example", true, true], ["Example", false, true]]), got);` },
  { js: `R.setFind(false); await sleep(300); const before = await FIND_ROW(); KEY("F3"); await sleep(400); const open = await FIND_ROW(); R.setFind(false); await sleep(200);
    return CHECK("F3 with the find row closed: it opens", !before && open, { before, open });` },
  { js: `const n = R.tabs.length, at = AT(); KEY("u", "c"); await sleep(1200); const t = R.tabs[at + 1];
    return CHECK("Ctrl+U: the source in a new tab next to it", R.tabs.length === n + 1 && t?.view.webContents.getURL() === "view-source:" + u("a"), t?.view.webContents.getURL());` },
  { js: `R.select(R.tabs[0]); await sleep(200); const tab = R.active; KEY("Home", "a"); await sleep(1500);
    return CHECK("Alt+Home: the home page in this tab", R.active === tab && tab.view.webContents.getURL() === "rove://ui/newtab.html", tab.view.webContents.getURL());` },
  { js: `KEY("f", "a"); await sleep(300); const kind = R.overlayOn?.kind; R.hideOverlay(); await sleep(200);
    return CHECK("Alt+F: the ≡ menu", kind === "menu", kind);` },
  { js: `const http = process.mainModule.require("http"); const srv = http.createServer(() => {}); await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    R.go("http://127.0.0.1:" + srv.address().port + "/"); await sleep(600); const wc = R.active.view.webContents; const loading = wc.isLoading();
    KEY("Escape"); await sleep(300); const after = wc.isLoading(); srv.closeAllConnections(); srv.close();
    return CHECK("Esc while a page loads: it stops", loading && !after, { loading, after });` },
  // from a page: Ctrl+PgDn is one of the keys Rove keeps (as in Chrome, a page cannot stop it)
  { js: `R.go(u("p")); await sleep(1200); R.select(R.tabs[0]); await sleep(300); const wc = R.active.view.webContents;
    await wc.executeJavaScript("addEventListener('keydown', (e) => e.preventDefault(), true), 1");
    wc.focus(); for (const type of ["keyDown", "keyUp"]) wc.sendInputEvent({ type, keyCode: "PageDown", modifiers: ["control"] }); await sleep(300);
    return CHECK("Ctrl+PgDn from a page that takes every key: the next tab", AT() === 1, AT());` },
];
