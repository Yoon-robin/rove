// node test/drive.mjs test/popup-size.mjs: a popup (window.open with a size) opens at the size the
// page asked for, as Chrome (width/height are the page's own area), kept on the screen; one with
// no size of its own gets 520×680. A lecture player laid out for 1024×768 lost its controls in a
// 520×680 one. Needs the network (example.com). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { BrowserWindow, screen } = process.mainModule.require("electron");
globalThis.PRESS = async () => { const wc = R.active.view.webContents; wc.sendInputEvent({ type: "mouseDown", x: 10, y: 600, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 600, button: "left", clickCount: 1 }); await sleep(100); };
globalThis.OPEN = async (features) => {
  const before = new Set(BrowserWindow.getAllWindows());
  await PRESS(); await R.active.view.webContents.executeJavaScript("window.open('https://example.com/', '_blank', '" + features + "'), 1"); await sleep(1500);
  const w = BrowserWindow.getAllWindows().find((x) => !before.has(x)); const got = w ? { content: w.getContentSize(), inner: await w.webContents.executeJavaScript("[innerWidth, innerHeight]") } : null; w?.close(); await sleep(300); return got;
};
globalThis.AREA = () => screen.getPrimaryDisplay().workAreaSize;
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(2500); const g = await OPEN("width=900,height=600");
    return CHECK("asked 900×600: the page's area is 900×600", g && g.content[0] === 900 && g.content[1] === 600 && g.inner[0] === 900 && g.inner[1] === 600, g);` },
  { js: `const g = await OPEN("popup"); return CHECK("no size given: 520×680", g && g.content[0] === 520 && g.content[1] === 680, g);` },
  { js: `const a = AREA(), g = await OPEN("width=6000,height=6000"); return CHECK("bigger than the screen: kept on it", g && g.content[0] <= a.width && g.content[1] <= a.height, { g, a });` },
];
