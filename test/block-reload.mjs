// node test/drive.mjs test/block-reload.mjs: turning 광고·추적 막기 off (or back on) for a site loads
// its page again, as Brave does when Shields go down or up — what was blocked comes only with a new
// load, so without it the switch seemed to do nothing on the page that broke. Other sites' tabs are
// not loaded again, and the switch for all sites (≡) loads nothing, as in Brave.
// A local server in Rove's main process counts the loads: no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.HITS = {};
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { HITS[q.url] = (HITS[q.url] || 0) + 1; s.writeHead(200, { "content-type": "text/html" }); s.end("<title>p</title>ok"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.PORT = SRV.address().port;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.newTab("http://localhost:" + PORT + "/other"); await sleep(1200); R.newTab("http://127.0.0.1:" + PORT + "/a"); await sleep(1200);
    R.setBlock(false, R.active.url); await sleep(1500);
    return CHECK("off for the site: its page loads again", HITS["/a"] === 2 && R.snapshot().block.siteOn === false, { hits: HITS, siteOn: R.snapshot().block.siteOn });` },
  { js: `R.setBlock(true, R.active.url); await sleep(1500);
    return CHECK("back on: loads again", HITS["/a"] === 3 && R.snapshot().block.siteOn === true, { hits: HITS });` },
  { js: `return CHECK("another site's tab is not loaded again", HITS["/other"] === 1, { hits: HITS });` },
  { js: `R.setBlock(false); await sleep(1000); R.setBlock(true); await sleep(1000);
    return CHECK("the switch for all sites loads nothing", HITS["/a"] === 3, { hits: HITS });` },
];
