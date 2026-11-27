// node test/drive.mjs test/quit-save.mjs: a setting changed just before Rove ends is kept. Writes wait
// 0.8 s (a burst of changes is one write) and that timer never fires once the app has quit, so a choice
// made in ≡ and then Alt+F4 at once was gone at the next start. Here the change is made and Rove's own
// before-quit (what app.quit runs) is sent at once; settings.json must have it right then. No network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.FS = process.mainModule.require("node:fs"); globalThis.PATH = process.mainModule.require("node:path");
globalThis.SAVED = () => { try { return JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "settings.json"), "utf8")); } catch { return null; } };
globalThis.MENU = (js) => R.overlay.webContents.executeJavaScript(js);`;
export default [
  { js: H + `R.showOverlay({ kind: "menu" }); await sleep(600); await sleep(1000);
    const before = SAVED()?.start ?? "last";
    await MENU("document.querySelector('[data-start]').click()"); await sleep(50);
    const mem = R.settings.start, early = SAVED()?.start;
    process.mainModule.require("electron").app.emit("before-quit", { preventDefault() {} });
    const got = { before, mem, early, atQuit: SAVED()?.start };
    return CHECK("≡ 지난 탭으로 시작 off, Rove ends 0.05 s later: settings.json has it", got.mem === "home" && got.before !== "home" && got.atQuit === "home", got);` },
];
