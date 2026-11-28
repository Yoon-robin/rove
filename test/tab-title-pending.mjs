// node test/drive.mjs test/tab-title-pending.mjs: an address gone to (typed, or a link given to go) shows on
// its tab while the page is slow to answer — not "새 탭" or the page before's title — and the page's own title
// takes its place when it comes; a link opened in a new tab (behind) too. A local server in Rove's main process — no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { setTimeout(() => { s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); s.end("<title>" + (q.url === "/one" ? "첫 쪽" : "늦은 쪽") + "</title>"); }, q.url === "/one" ? 0 : 2500); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "127.0.0.1:" + SRV.address().port;
globalThis.TITLE = () => R.win.webContents.executeJavaScript("document.querySelector('#tabs .tab[aria-selected=true] .t').textContent");`;
export default [
  { js: H + `R.newTab("about:blank"); await sleep(500); R.go("http://" + BASE + "/slow"); await sleep(900); const during = await TITLE(); await sleep(2600); const after = await TITLE();
    return CHECK("a new tab: the address while it loads, then the page's title", during === BASE + "/slow" && after === "늦은 쪽", { during, after });` },
  { js: `R.go("http://" + BASE + "/one"); await sleep(900); R.go("http://" + BASE + "/later"); await sleep(900); const during = await TITLE(); await sleep(2600); const after = await TITLE();
    return CHECK("from a page with a title: the new address, not the last title", during === BASE + "/later" && after === "늦은 쪽", { during, after });` },
  { js: `const from = R.active; const t = R.newTab("http://" + BASE + "/link", { background: true, from }); await sleep(900);
    const read = () => R.win.webContents.executeJavaScript("[...document.querySelectorAll('#tabs .tab .t')].map((e) => e.textContent)");
    const during = (await read())[R.tabs.indexOf(t)]; await sleep(2600); const after = (await read())[R.tabs.indexOf(t)];
    return CHECK("a link opened in a new tab behind: the address while it loads, not 새 탭", during === BASE + "/link" && after === "늦은 쪽", { during, after });` },
  { js: `SRV.closeAllConnections?.(); SRV.close(); return 1;` },
];
