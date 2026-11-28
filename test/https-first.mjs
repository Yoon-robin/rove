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
];
