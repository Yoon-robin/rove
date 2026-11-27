// node test/drive.mjs test/amp.mjs: a page made in AMP (<html amp>, <html ⚡>) goes to its
// rel=canonical, in its place (Back goes to the page before, not the AMP one), as Brave's De-AMP
// does by default. Not when the canonical is itself, not to javascript:, not round and round
// (A's canonical B is AMP with canonical A), not with blocking off for the site.
// No network: a local server. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
if (!globalThis.BASE) {
  const http = process.mainModule.require("node:http");
  const amp = (attr, canon) => "<!doctype html><html " + attr + "><head><link rel=canonical href='" + canon + "'><title>amp</title></head><body>amp</body></html>";
  const pages = {
    "/start": "<title>start</title>start",
    "/news/amp": amp("amp", "/news"), "/bolt/amp": amp("\\u26a1", "/bolt"),
    "/news": "<title>news</title>news", "/bolt": "<title>bolt</title>bolt",
    "/self": amp("amp", "/self"), "/js": amp("amp", "javascript:alert(1)"),
    "/a": amp("amp", "/b"), "/b": amp("amp", "/a"),
  };
  const srv = http.createServer((q, s) => { s.setHeader("content-type", "text/html; charset=utf-8"); s.end(pages[q.url] ?? "<title>404</title>"); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  globalThis.BASE = "http://127.0.0.1:" + srv.address().port;
}
globalThis.VISIT = async (path) => {
  const wc = R.active.view.webContents;
  R.active.unAmpedAt = 0;
  wc.loadURL(BASE + "/start"); for (let i = 0; i < 40 && !wc.getURL().endsWith("/start"); i++) await sleep(100);
  await sleep(300);
  wc.loadURL(BASE + path); await sleep(2500);
  return wc.getURL().slice(BASE.length);
};`;
export default [
  { js: H + `await sleep(800); const at = await VISIT("/news/amp"); const wc = R.active.view.webContents;
    const back = wc.navigationHistory.getEntryAtIndex(wc.navigationHistory.getActiveIndex() - 1)?.url.slice(BASE.length);
    return CHECK("an AMP page goes to its canonical, and Back is the page before", at === "/news" && back === "/start", { at, back });` },
  { js: H + `const at = await VISIT("/bolt/amp"); return CHECK("<html ⚡> too", at === "/bolt", at);` },
  { js: H + `const got = { self: await VISIT("/self"), js: await VISIT("/js"), loop: await VISIT("/a") };
    return CHECK("not to itself, not to javascript:, one hop only", got.self === "/self" && got.js === "/js" && got.loop === "/b", got);` },
  { js: H + `R.setBlock(false, BASE + "/"); const at = await VISIT("/news/amp"); R.setBlock(true, BASE + "/");
    return CHECK("a site let be keeps its AMP page", at === "/news/amp" && R.settings.allow.length === 0, at);` },
];
