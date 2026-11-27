// node test/drive.mjs test/address-enter.mjs: Enter with a key held in the address bar, as Chrome and
// Brave — Ctrl+Enter puts www. and .com round a bare word (here; words with a space stay a search),
// Alt+Enter opens what was typed in a new tab in front, Shift+Enter in a new window. The bar is typed into
// with real key events; a local server, no network (www.zzqq.com is only asked for). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.UI = (js) => R.win.webContents.executeJavaScript(js);
globalThis.KEY = (keyCode, modifiers = []) => { for (const type of ["keyDown", "keyUp"]) R.win.webContents.sendInputEvent({ type, keyCode, modifiers }); };
globalThis.TYPE = async (text) => { await UI("url.focus(), url.value = '', 1"); R.win.webContents.focus(); for (const ch of text) { R.win.webContents.sendInputEvent({ type: "char", keyCode: ch }); await sleep(60); } await sleep(500); };
globalThis.SEARCH = R.toUrl("zzqq").replace("zzqq", "");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>here</title>"); });
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.AT = "127.0.0.1:" + SRV.address().port;`;
export default [
  { js: H + `R.go("about:blank"); await sleep(600); const t = R.active, n = R.tabs.length;
    await TYPE("zzqq"); KEY("Enter", ["control"]); await sleep(600);
    return CHECK("Ctrl+Enter on a bare word: www. and .com, in this tab", t.url === "https://www.zzqq.com" && R.tabs.length === n, { url: t.url, tabs: R.tabs.length - n });` },
  { js: `R.go("about:blank"); await sleep(600); const t = R.active;
    await TYPE("zzqq two"); KEY("Enter", ["control"]); await sleep(600);
    return CHECK("Ctrl+Enter on words: a search as before", t.url.startsWith(SEARCH), t.url);` },
  { js: `R.go("about:blank"); await sleep(600); const t = R.active, n = R.tabs.length;
    await TYPE(AT + "/alt"); KEY("Enter", ["alt"]); await sleep(1200);
    const got = { tabs: R.tabs.length - n, front: R.active !== t && R.active.url, here: t.url };
    return CHECK("Alt+Enter: a new tab in front, this tab stays", got.tabs === 1 && got.front === "http://" + AT + "/alt" && got.here === "about:blank", got);` },
  { js: `R.closeTab(R.active); await sleep(300); const n = R.windows.length, t = R.active;
    await TYPE(AT + "/win"); KEY("Enter", ["shift"]); await sleep(1500);
    const w = R.windows.at(-1), url = w?.tabs?.[0]?.url;
    const got = { windows: R.windows.length - n, url, here: t.url };
    if (R.windows.length > n) w.win.close();
    return CHECK("Shift+Enter: a new window, this tab stays", got.windows === 1 && url === "http://" + AT + "/win" && got.here === "about:blank", got);` },
  { js: `SRV.close(); await sleep(800); return CHECK("back to one window", R.windows.filter((w) => !w.gone).length === 1, R.windows.length);` },
];
