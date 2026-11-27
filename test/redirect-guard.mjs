// node test/drive.mjs test/redirect-guard.mjs: a web server cannot send a tab to our pages with a
// redirect (302 to rove://ui/newtab.html, or to rove://ui/go?q=file:...), in the tab or in a frame.
// MIKAEL n373. Local server only. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = process.mainModule.require("node:http");
globalThis.SRV = http.createServer((q, s) => {
  const to = { "/nt": "rove://ui/newtab.html", "/go": "rove://ui/go?q=" + encodeURIComponent("file:///C:/Windows/win.ini") }[q.url];
  if (to) { s.writeHead(302, { Location: to }); return s.end(); }
  s.writeHead(200, { "content-type": "text/html" }); s.end("<p>here</p>");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.URL_ = () => R.active.view.webContents.getURL();
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(BASE + "/"); await sleep(1000); R.go(BASE + "/nt"); await sleep(1500); const u = URL_();
    return CHECK("302 to the new tab: not followed", !u.startsWith("rove:"), u);` },
  { js: `R.go(BASE + "/go"); await sleep(1500); const u = URL_();
    return CHECK("302 to go?q=file: neither our page nor the file", !u.startsWith("rove:") && !u.startsWith("file:"), u);` },
  { js: `R.go(BASE + "/"); await sleep(1000);
    await R.active.view.webContents.executeJavaScript("document.body.insertAdjacentHTML('beforeend', '<iframe src=\\"' + location.origin + '/nt\\"></iframe>'), 1"); await sleep(1500);
    const urls = R.active.view.webContents.mainFrame.frames.map((f) => f.url);
    return CHECK("a frame redirected to our page: not loaded", !urls.some((x) => x.startsWith("rove:")), urls);` },
  { js: `SRV.close(); R.go(R.home ?? "rove://ui/newtab.html"); await sleep(800); const u = URL_();
    return CHECK("our own new tab still opens", u === "rove://ui/newtab.html", u);` },
];
