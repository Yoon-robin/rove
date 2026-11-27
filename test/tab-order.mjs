// node test/drive.mjs test/tab-order.mjs: tabs a page opens in the background (Ctrl+click, middle
// click) line up after the ones it opened before, in the order they were opened, as in Chrome and
// Brave (Chromium's tab strip); and closing such a tab you went to brings back the tab it came from.
// Local server only. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = process.mainModule.require("node:http");
globalThis.SRV = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>" + q.url + "</title>" + [1, 2, 3].map((n) => "<a id=l" + n + " href='/" + n + "' style='display:block;height:40px'>" + n + "</a>").join("")); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
// Ctrl+click on link n (a real press, so the page opens it as a background tab)
globalThis.CTRL = async (n) => { const wc = R.active.view.webContents; const y = 20 + (n - 1) * 40;
  for (const type of ["mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: 8, y, button: "left", clickCount: 1, modifiers: ["control"] }); await sleep(600); };
globalThis.PATHS = () => R.tabs.map((t) => new URL(t.url).pathname);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(BASE + "/a"); await sleep(1200); R.newTab(BASE + "/z"); await sleep(800); R.select(R.tabs[0]); await sleep(300);
    await CTRL(1); await CTRL(2); await CTRL(3); await sleep(500);
    const got = PATHS(); return CHECK("three Ctrl+clicks: in the order opened, before the next tab", JSON.stringify(got) === JSON.stringify(["/a", "/1", "/2", "/3", "/z"]), got);` },
  { js: `R.select(R.tabs.find((t) => t.url.endsWith("/2"))); await sleep(300); const seen = [];
    for (let i = 0; i < 3; i++) { R.closeTab(R.active); await sleep(200); seen.push(new URL(R.active.url).pathname); }
    return CHECK("closing them: the next one it opened (right, then left), then the tab they came from", JSON.stringify(seen) === JSON.stringify(["/3", "/1", "/a"]), seen);` },
  { js: `const n = R.tabs.length; R.select(R.tabs.find((t) => t.url.endsWith("/z"))); await sleep(200); R.closeTab(R.active); await sleep(200);
    const at = new URL(R.active.url).pathname; SRV.close();
    return CHECK("a tab not opened from a page: its neighbour, as before", R.tabs.length === n - 1 && at === "/a", at);` },
];
