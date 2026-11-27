// node test/drive.mjs test/newtab-icons.mjs: the new tab's tiles wear the site's own icon, the one Rove
// kept when the page showed it (icons.json), and a site with none keeps the globe. Local server only.
// Each line prints ok or FAIL.
const DOT = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = process.mainModule.require("node:http");
const page = (icon) => "<title>t</title>" + (icon ? "<link rel=icon href='data:image/png;base64,${DOT}'>" : "") + "<p>here</p>";
globalThis.SRV = [http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end(page(true)); }), http.createServer((q, s) => { s.writeHead(q.url === "/favicon.ico" ? 404 : 200, { "content-type": "text/html" }); s.end(page(false)); })];
await Promise.all(SRV.map((s, i) => new Promise((r) => s.listen(0, i ? "localhost" : "127.0.0.1", r))));
globalThis.WITH = "http://127.0.0.1:" + SRV[0].address().port + "/";
globalThis.BARE = "http://localhost:" + SRV[1].address().port + "/";
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `for (const u of [WITH, BARE, WITH]) { R.go(u); await sleep(1200); }
    R.go("rove://ui/newtab.html"); await sleep(1500);
    const tiles = await R.active.view.webContents.executeJavaScript("[...document.querySelectorAll('#sites a')].map((a) => ({ host: a.querySelector('span').textContent, img: a.querySelector('img')?.src.slice(0, 22) || null, globe: !!a.querySelector('svg') }))");
    SRV.forEach((s) => s.close());
    const w = tiles.find((t) => t.host.startsWith("127.0.0.1")), b = tiles.find((t) => t.host.startsWith("localhost"));
    return CHECK("a kept icon on its tile, the globe for none", w?.img === "data:image/png;base64," && !w.globe && b && !b.img && b.globe, tiles);` },
];
