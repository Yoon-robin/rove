// node test/drive.mjs test/popup-guard.mjs: a window a page opened (a sign-in popup) shares the tab's
// session, where rove:// is served, so it gets the tab's guard: the popup's page, a server redirect,
// the opener moving it, or a window the popup opens cannot reach our pages. MIKAEL n376.
// Local server only. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { BrowserWindow } = process.mainModule.require("electron");
const http = process.mainModule.require("node:http");
globalThis.SRV = http.createServer((q, s) => {
  if (q.url === "/nt") { s.writeHead(302, { Location: "rove://ui/newtab.html" }); return s.end(); }
  s.writeHead(200, { "content-type": "text/html" }); s.end("<p>here</p>");
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.BASE = "http://127.0.0.1:" + SRV.address().port;
globalThis.PAGE = (js) => R.active.view.webContents.executeJavaScript(js);
globalThis.PRESS = async () => { const wc = R.active.view.webContents; wc.sendInputEvent({ type: "mouseDown", x: 10, y: 600, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 600, button: "left", clickCount: 1 }); await sleep(100); };
globalThis.POPS = () => BrowserWindow.getAllWindows().filter((w) => !R.windows.some((x) => x.win === w) && w !== R.overlay?.getParentWindow?.() && !w.isDestroyed());
globalThis.OPEN = async () => { await PRESS(); await PAGE("window.w = window.open(location.origin + '/', 'p', 'width=500,height=400'), 1"); await sleep(1500); return POPS().find((w) => w.webContents.getURL().startsWith(BASE)); };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go(BASE + "/"); await sleep(1200); const p = await OPEN(); if (!p) return "FAIL no popup";
    await p.webContents.executeJavaScript("location.href = 'rove://ui/newtab.html', 1"); await sleep(1200); const u = p.webContents.getURL();
    return CHECK("the popup's own page cannot go to our page", !u.startsWith("rove:"), u);` },
  { js: `const p = POPS().find((w) => w.webContents.getURL().startsWith(BASE));
    await p.webContents.executeJavaScript("location.href = location.origin + '/nt', 1"); await sleep(1200); const u = p.webContents.getURL();
    return CHECK("a server redirect in the popup: not followed", !u.startsWith("rove:"), u);` },
  { js: `await PAGE("w.location = 'rove://ui/newtab.html', 1"); await sleep(1200);
    const p = POPS().find((w) => !w.isDestroyed()); const u = p?.webContents.getURL();
    return CHECK("the opener cannot move its popup to our page", !String(u).startsWith("rove:"), u);` },
  { js: `const p = POPS()[0]; const n = POPS().length;
    await p.webContents.executeJavaScript("window.open('rove://ui/newtab.html', 'q', 'width=300,height=300'), 1"); await sleep(1200);
    const urls = POPS().map((w) => w.webContents.getURL());
    return CHECK("a window the popup opens: not our page", !urls.some((x) => x.startsWith("rove:")), urls);` },
  { js: `await PAGE("w.location = location.origin + '/?ok', 1"); await sleep(1200); const urls = POPS().map((w) => w.webContents.getURL());
    POPS().forEach((w) => w.close()); SRV.close(); await sleep(300);
    return CHECK("the popup still goes to web pages", urls.some((x) => x.endsWith("/?ok")), urls);` },
];
