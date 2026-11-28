// node test/drive.mjs test/vertical-scroll.mjs: a long vertical tab list scrolled by hand stays where
// it was while other tabs load or rename themselves (as in Brave); choosing a tab out of sight brings
// it into view, and so does turning vertical tabs on. A local server in Rove's main process — no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>page " + q.url.slice(1) + "</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.U = (t) => "http://127.0.0.1:" + SRV.address().port + "/" + t;
globalThis.LIST = (js) => R.win.webContents.executeJavaScript("(() => { const l = document.getElementById('sidelist'); " + js + " })()");
globalThis.SEEN = (n) => LIST("const t = l.querySelectorAll('.tab')[" + n + "].getBoundingClientRect(), b = l.getBoundingClientRect(); return t.top >= b.top - 1 && t.bottom <= b.bottom + 1");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.active.view.webContents.loadURL(U("0")).catch(() => {}); for (let i = 1; i < 40; i++) R.newTab(U(String(i)), { background: true }); await sleep(2500);
    R.select(R.tabs[39]); await sleep(300); R.setVertical(true); await sleep(1000);
    const got = { tabs: R.tabs.length, top: await LIST("return l.scrollTop"), seen: await SEEN(39) };
    return CHECK("turned on with the last tab chosen: the list shows it", got.tabs === 40 && got.top > 0 && got.seen, got);` },
  { js: `R.select(R.tabs[0]); await sleep(500); await LIST("l.scrollTop = l.scrollHeight; return 1"); await sleep(300);
    const before = await LIST("return l.scrollTop");
    await R.tabs[20].view.webContents.executeJavaScript("document.title = 'changed'"); R.tabs[25].view.webContents.reload(); await sleep(1000);
    const got = { before, after: await LIST("return l.scrollTop"), title: R.tabs[20].title };
    return CHECK("scrolled by hand: another tab renamed or reloaded, the list stays", got.before > 0 && got.after === got.before && got.title === "changed", got);` },
  { js: `await LIST("l.scrollTop = 0; return 1"); await sleep(200); R.select(R.tabs[35]); await sleep(600);
    const got = { top: await LIST("return l.scrollTop"), seen: await SEEN(35) }; SRV.close();
    return CHECK("a tab out of sight chosen: the list brings it into view", got.top > 0 && got.seen, got);` },
];
