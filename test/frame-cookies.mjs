// node test/drive.mjs test/frame-cookies.mjs: with other sites' cookies blocked, a frame from another site
// (a comment box, a video) keeps the cookie it is sent for that one site (Brave keeps it too, for that site):
// framed again on the same site it gets it and reads it; framed on a third site, or visited first-hand,
// it is not sent the one kept there, so it can't follow anyone from site to site. Normal and private windows. Local servers.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = process.mainModule.require("node:http");
globalThis.SEEN = [];
// B: localhost, the framed site; its cookie meant for other sites, not marked Partitioned
globalThis.B = http.createServer((q, s) => {
  SEEN.push(q.headers.cookie || "");
  s.writeHead(200, { "content-type": "text/html", "set-cookie": "f=1; SameSite=None; Secure; Path=/" });
  s.end("<title>b</title><script>parent.postMessage('js:' + document.cookie, '*')</script>");
});
await new Promise((r) => B.listen(0, "127.0.0.1", r));
globalThis.BU = "http://localhost:" + B.address().port + "/";
// A on 127.0.0.1 and 127.0.0.2: two sites framing B
globalThis.A = http.createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>a</title><script>addEventListener('message', (e) => document.title = e.data)</script><iframe src='" + BU + "'></iframe>"); });
await new Promise((r) => A.listen(0, "0.0.0.0", r));
globalThis.ON = (ip) => "http://" + ip + ":" + A.address().port + "/";
globalThis.FRAMED = async (url) => { SEEN.length = 0; R.go(url); await sleep(1500); return { sent: SEEN.slice(), js: R.active.view.webContents.getTitle() }; };
globalThis.RUN = async (priv) => { const w = R.createWindow({ priv, urls: ["about:blank"] }); R.use(w); await sleep(800);
  const first = await FRAMED(ON("127.0.0.1")), again = await FRAMED(ON("127.0.0.1") + "?2"), third = await FRAMED(ON("127.0.0.2"));
  SEEN.length = 0; R.go(BU); await sleep(1200);
  return { first, again, third, own: SEEN.slice() }; };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
const kept = `(x) => x.first.sent[0] === "" && x.again.sent[0] === "f=1" && x.again.js === "js:f=1"`;
// B answers every time with its cookie, so what counts is what comes with the request
const alone = `(x) => x.third.sent[0] === "" && x.own[0] === ""`;
export default [
  { js: H + `const n = await RUN(false); globalThis.P = await RUN(true);
    return CHECK("normal: a frame keeps its cookie on the site it is on", (${kept})(n), n) + " / " + CHECK("normal: not on another site, nor first-hand", (${alone})(n), n);` },
  { js: `return CHECK("private: a frame keeps its cookie on the site it is on", (${kept})(P), P) + " / " + CHECK("private: not on another site, nor first-hand", (${alone})(P), P);` },
];
