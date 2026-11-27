// ROVE_WELCOME=1 ROVE_AS=RoveWelcomeTest ROVE_IMPORT_ROOT=<a folder with Google\Chrome\User Data\Default\Bookmarks>
// node test/drive.mjs test/welcome.steps.mjs (test/welcome.mjs sets these up): the first run offers what Brave's
// and Chrome's welcome do, once: be the default browser, bring bookmarks from another browser. Its
// 가져오기 opens the bookmarks drawer at the browsers list, × puts it away, and it is never asked again.
// Never presses 기본 브라우저로 (it would write the registry). Parity 39. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.UI = (js) => R.win.webContents.executeJavaScript(js);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `await sleep(1500); const a = R.asks.find((x) => x.kind === "welcome");
    const ui = await UI("({ shown: !document.getElementById('ask').hidden, who: askWho.textContent, what: askWhat.textContent, yes: askYes.hidden ? null : askYes.textContent, no: askNo.hidden ? null : askNo.textContent })");
    return CHECK("first run: one offer, both buttons", !!a && R.settings.welcomed === true && ui.shown && ui.yes === "기본 브라우저로" && ui.no === "가져오기" && /Chrome 2개/.test(ui.what), { a: !!a, ui });` },
  { js: `const wc = R.overlay.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-finish-load", r));
    await UI("askNo.click(), 1"); await sleep(1200);
    const drawer = await wc.executeJavaScript("document.body.innerText.includes('Chrome') && !!document.querySelector('[data-import]')");
    const ui = await UI("({ shown: !document.getElementById('ask').hidden, no: askNo.hidden, yes: askYes.hidden ? null : askYes.textContent })");
    return CHECK("가져오기: the drawer at the browsers, the default button stays", drawer && ui.shown && ui.no === true && ui.yes === "기본 브라우저로", { drawer, ui });` },
  { js: `R.hideOverlay?.(); await UI("askShut.click(), 1"); await sleep(500);
    const shown = await UI("!document.getElementById('ask').hidden");
    return CHECK("×: put away", !shown && !R.asks.some((x) => x.kind === "welcome"), { shown, asks: R.asks.length });` },
];
