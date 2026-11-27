// node test/welcome.mjs runs this after welcome.steps.mjs, in a new first run: 기본 브라우저로 pressed
// first leaves 가져오기 offered (Brave's welcome goes on to its import step), without the default
// button again. defaults.register is swapped for a stand-in, so nothing is written to the registry.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.UI = (js) => R.win.webContents.executeJavaScript(js);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const need = process.mainModule.require("node:module").createRequire(process.mainModule.require("electron").app.getAppPath() + "/main.cjs");
globalThis.DEFAULTS = need("./defaults.cjs"); globalThis.MADE = [];
DEFAULTS.register = async (o) => { MADE.push(o.name); return false; };`;
export default [
  { js: H + `for (let i = 0; i < 40 && !R.asks.some((x) => x.kind === "welcome"); i++) await sleep(250); await sleep(300);
    const before = !!R.asks.find((x) => x.kind === "welcome"); await UI("askYes.click(), 1"); await sleep(800);
    const a = R.asks.find((x) => x.kind === "welcome");
    const ui = await UI("({ shown: !document.getElementById('ask').hidden, what: askWhat.textContent, yes: askYes.hidden, no: askNo.hidden ? null : askNo.textContent })");
    return CHECK("기본 브라우저로 first: 가져오기 stays, not the default button again", before && MADE.length === 1 && !!a && ui.shown && ui.yes === true && ui.no === "가져오기" && !/기본 브라우저 아님/.test(ui.what) && /Chrome 2개/.test(ui.what), { before, made: MADE, ui });` },
  { js: `const wc = R.overlay.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-finish-load", r));
    await UI("askNo.click(), 1"); await sleep(1200);
    const drawer = await wc.executeJavaScript("!!document.querySelector('[data-import]')");
    const shown = await UI("!document.getElementById('ask').hidden");
    return CHECK("then 가져오기: the drawer, nothing left to offer", drawer && !shown && !R.asks.some((x) => x.kind === "welcome"), { drawer, shown });` },
];
