// node test/drive.mjs test/cross-cookies.mjs: other sites' cookies are blocked from the start, in normal and
// private windows (Brave's Shields; Chrome's and Brave's private windows block them too): a site visited first-hand
// keeps its cookie, but in a frame on another site it neither gets it (the request's Cookie) nor reads it
// (document.cookie). ≡ 다른 사이트 쿠키 막기 is on; turned off it is kept in settings.json and the menu says the
// change takes the next start (one Chromium switch for the whole run, D-071). Local servers: no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = process.mainModule.require("node:http"), fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path");
globalThis.DISK = () => { try { return JSON.parse(fs.readFileSync(path.join(process.env.ROVE_HOME, "settings.json"), "utf8")); } catch { return {}; } };
globalThis.SEEN = [];
// B: localhost (another site than 127.0.0.1), its cookie SameSite=None so only the third-party block keeps it home
globalThis.B = http.createServer((q, s) => {
  if (q.url === "/set") { s.writeHead(200, { "content-type": "text/html", "set-cookie": "t=1; SameSite=None; Secure; Path=/" }); return s.end("<title>b</title>set"); }
  if (q.url === "/frame") SEEN.push(q.headers.cookie || "");
  s.writeHead(200, { "content-type": "text/html" }); s.end("<script>parent.postMessage('js:' + document.cookie, '*')</script>");
});
await new Promise((r) => B.listen(0, "127.0.0.1", r));
globalThis.BU = "http://localhost:" + B.address().port;
globalThis.A = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>a</title><script>addEventListener('message', (e) => document.title = e.data)</script><iframe src='" + BU + "/frame'></iframe>"); });
await new Promise((r) => A.listen(0, "127.0.0.1", r));
globalThis.AU = "http://127.0.0.1:" + A.address().port + "/";
globalThis.FRAMED = async (priv) => { SEEN.length = 0; const w = R.createWindow({ priv, urls: [BU + "/set"] }); R.use(w); await sleep(1500);
  const own = await R.active.view.webContents.executeJavaScript("document.cookie"); R.go(AU); await sleep(2000);
  return { own, header: SEEN.slice(), js: R.active.view.webContents.getTitle() }; };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const n = await FRAMED(false), p = await FRAMED(true);
    const blocked = (x) => x.own === "t=1" && x.header.length === 1 && x.header[0] === "" && x.js === "js:";
    return CHECK("a site's cookie stays with it, not sent nor read in another site's frame (normal, private)", blocked(n) && blocked(p), { normal: n, private: p });` },
  { js: `R.showOverlay({ kind: "menu" }); await sleep(700);
    globalThis.ROW = () => R.overlay.webContents.executeJavaScript("(() => { const b = document.querySelector('.pop.menu [data-cookies]'); return b && { on: b.getAttribute('aria-checked'), label: b.getAttribute('aria-label'), later: document.getElementById('cookies-later')?.textContent || '' }; })()");
    const r = await ROW();
    return CHECK("≡ shows it on", r && r.on === "true" && r.label === "다른 사이트 쿠키 막기" && !r.later, r);` },
  { js: `await R.overlay.webContents.executeJavaScript("document.querySelector('.pop.menu [data-cookies]').click()"); await sleep(1200);
    const r = await ROW(), disk = DISK().cookies;
    return CHECK("turned off: kept, and the menu says it takes the next start", r && r.on === "false" && r.later.includes("다시 켜면") && disk === false, { r, disk });` },
  { js: `await R.overlay.webContents.executeJavaScript("document.querySelector('.pop.menu [data-cookies]').click()"); await sleep(1200);
    const r = await ROW();
    return CHECK("back on: as at the start, no note", r && r.on === "true" && !r.later && DISK().cookies === true, r);` },
];
