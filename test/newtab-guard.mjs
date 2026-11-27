// node test/drive.mjs test/newtab-guard.mjs: web pages cannot reach our pages now that a tab's
// session serves rove:// (the new tab): a page cannot take its tab there, frame it or open it in a
// window, and a popup cannot walk its opener tab to the new tab and then to rove://ui/go?q=file:...
// (the new tab's field takes what its own page sends, and only to http(s) or a search).
// MIKAEL n366. Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { BrowserWindow } = process.mainModule.require("electron");
globalThis.PAGE = (js) => R.active.view.webContents.executeJavaScript(js);
globalThis.PRESS = async () => { const wc = R.active.view.webContents; wc.sendInputEvent({ type: "mouseDown", x: 10, y: 600, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 600, button: "left", clickCount: 1 }); await sleep(100); };
globalThis.POP = () => BrowserWindow.getAllWindows().find((w) => !R.windows.some((x) => x.win === w));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(2500); await PAGE("location.href = 'rove://ui/newtab.html', 1"); await sleep(1200);
    const url = R.active.view.webContents.getURL(); return CHECK("a web page cannot take its tab to the new tab", url === "https://example.com/", url);` },
  { js: `await PRESS(); await PAGE("window.open('https://example.com/', 'p', 'width=500,height=400'), 1"); await sleep(2500); const p = POP();
    if (!p) return "FAIL no popup";
    await p.webContents.executeJavaScript("opener.location = 'rove://ui/newtab.html', 1"); await sleep(1500); const one = R.active.view.webContents.getURL();
    await p.webContents.executeJavaScript("opener.location = 'rove://ui/go?q=' + encodeURIComponent('file:///C:/Windows/win.ini'), 1"); await sleep(1500); const two = R.active.view.webContents.getURL();
    p.close(); await sleep(300);
    return CHECK("a popup cannot walk its opener to the new tab, nor to go?q=file:", !one.startsWith("rove:") && !two.startsWith("file:"), { one, two });` },
  { js: `await PRESS(); await PAGE("window.open('rove://ui/newtab.html', 'q', 'width=500,height=400'), 1"); await sleep(1500); const p = POP(); p?.close();
    return CHECK("window.open of our page: nothing opens", !p, !!p);` },
  { js: `await PAGE("document.body.insertAdjacentHTML('beforeend', '<iframe id=f src=\\"rove://ui/newtab.html\\"></iframe>'), 1"); await sleep(1500);
    const urls = R.active.view.webContents.mainFrame.frames.map((f) => f.url);
    return CHECK("a frame of our page: not loaded", !urls.some((u) => u.startsWith("rove:")), urls);` },
  { js: `R.go("rove://ui/newtab.html"); await sleep(1200); await PAGE("document.getElementById('q').value = 'file:///C:/Windows/win.ini', document.getElementById('find').requestSubmit(), 1"); await sleep(1500);
    const url = R.active.view.webContents.getURL(); return CHECK("the new tab's own field: file: is not opened from it", !url.startsWith("file:"), url);` },
];
