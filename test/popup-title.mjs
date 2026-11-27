// node test/drive.mjs test/popup-title.mjs: a popup (window.open with a size) has no
// address bar, so its window title must say whose page it is — the host first, as
// punycode, whatever the page calls itself; and it follows the popup to the next page.
// Each line prints ok or FAIL. Needs the network (example.com, example.org).
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { BrowserWindow } = process.mainModule.require("electron");
globalThis.POP = () => BrowserWindow.getAllWindows().find((w) => !R.windows.some((x) => x.win === w) && w.isVisible !== undefined && w.webContents.getURL());
globalThis.PRESS = async () => { const wc = R.active.view.webContents; wc.sendInputEvent({ type: "mouseDown", x: 10, y: 600, button: "left", clickCount: 1 }); wc.sendInputEvent({ type: "mouseUp", x: 10, y: 600, button: "left", clickCount: 1 }); await sleep(100); };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(2500); await PRESS();
    await R.active.view.webContents.executeJavaScript("window.open('https://example.com/', 'login', 'width=400,height=500'), 1", true); await sleep(2500);
    const p = POP(); if (!p) return "FAIL no popup";
    await p.webContents.executeJavaScript("document.title = 'Google 계정 로그인'"); await sleep(400);
    return CHECK("host before the page's title", p.getTitle() === "example.com · Google 계정 로그인", p.getTitle());` },
  { js: `const p = POP(); p.webContents.loadURL("https://example.org/"); await sleep(2500);
    return CHECK("next page: its host", p.getTitle().startsWith("example.org · "), p.getTitle());` },
  { js: `const p = POP(); await p.webContents.executeJavaScript("history.pushState({}, '', '/x'), document.title = 'same site'"); await sleep(400);
    const t = p.getTitle(); p.close(); return CHECK("same page, new title", t === "example.org · same site", t);` },
];
