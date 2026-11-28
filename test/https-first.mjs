// node test/drive.mjs test/https-first.mjs: a page asked over http opens over https when the site
// has it (Brave's 'HTTPS 연결 업그레이드' 표준, on by default; Chrome's HTTPS-Upgrades). A site
// without working https falls back to http with no error page, and is not tried again this run.
// Not upgraded: an IP, this PC, a one-word name, a port of its own. Off with 막기 off, or on a site
// whose 막기 is off. Network: example.com (has https), http.badssl.com (https fails).
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.OPEN = async (url, until) => {
  const wc = R.active.view.webContents; const seen = [];
  const f = (e, u, inPlace, main) => { if (main) seen.push(u); };
  wc.on("did-start-navigation", f); wc.on("did-redirect-navigation", f);
  R.go(url); for (let i = 0; i < 80 && !(until(wc.getURL()) && !wc.isLoading()); i++) await sleep(250);
  await sleep(400); wc.off("did-start-navigation", f); wc.off("did-redirect-navigation", f);
  return { url: wc.getURL(), seen, failed: R.active.failed || null };
};`;
export default [
  { js: H + `await sleep(800); const got = await OPEN("http://example.com/", (u) => u.startsWith("https://example.com"));
    return CHECK("http://example.com opens over https", got.url === "https://example.com/" && !got.failed, got);` },
  { js: `const got = await OPEN("http://http.badssl.com/", (u) => u.startsWith("http://http.badssl.com"));
    const h = R.active.view.webContents.navigationHistory; got.back = h.getEntryAtIndex(h.getActiveIndex() - 1)?.url;
    return CHECK("a site whose https fails opens over http, no error page, back goes to the page before", got.url === "http://http.badssl.com/" && !got.failed && got.back === "https://example.com/", got);` },
  { js: `await OPEN("https://example.com/", (u) => u.startsWith("https://example.com")); const got = await OPEN("http://http.badssl.com/", (u) => u.startsWith("http://http.badssl.com"));
    return CHECK("that site is not tried over https again", got.url === "http://http.badssl.com/" && !got.seen.some((u) => u.startsWith("https:")), got);` },
  { js: `const wc = R.active.view.webContents;
    const got = ["http://127.0.0.1/", "http://localhost/", "http://a.localhost/", "http://intranet/", "http://example.com:8080/", "https://example.com/", "http://[::1]/"].map((url) => R.httpsFirst({ url, webContents: wc, webContentsId: wc.id }));
    return CHECK("not an IP, this PC, a one-word name, a port of its own, https", got.every((v) => v === null), got);` },
  { js: `R.setBlock(false); await sleep(200); const got = await OPEN("http://example.com/", (u) => u.startsWith("http://example.com")); R.setBlock(true);
    return CHECK("막기 off: left on http", got.url === "http://example.com/", got);` },
  // https that takes the connection and never answers (443 dropped): http after ~3 s, not ~30 s.
  // The tab's session goes through two local servers: http is answered, https is held open.
  { js: `const net = process.mainModule.require("node:net"), http = process.mainModule.require("node:http");
    const hang = net.createServer((s) => s.on("error", () => {})), plain = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>plain</title>"); });
    await new Promise((r) => hang.listen(0, "127.0.0.1", r)); await new Promise((r) => plain.listen(0, "127.0.0.1", r));
    const ses = R.active.view.webContents.session; await ses.setProxy({ proxyRules: "http=127.0.0.1:" + plain.address().port + ";https=127.0.0.1:" + hang.address().port });
    const t0 = Date.now(); const got = await OPEN("http://slow.example.com/", (u) => u.startsWith("http://slow.example.com")); got.ms = Date.now() - t0;
    await ses.setProxy({ mode: "direct" }); hang.close(); plain.close();
    return CHECK("an https that never answers: the http page within a few seconds", got.url === "http://slow.example.com/" && !got.failed && got.ms < 6000, got);` },
];
