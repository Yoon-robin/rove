// node test/drive.mjs test/address-lead.mjs: the icon before the address. On an https page it is the
// lock; once other words are typed it shows what Enter will do, as Chrome and Brave — a magnifier for
// a search, a globe for an address — and cannot be pressed (the site's panel is about the page, not
// what was typed). Esc gives the page's lock back. Uses the network (example.com); the bar is typed
// into with real key events (a hidden window). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.UI = (js) => R.win.webContents.executeJavaScript(js);
globalThis.LEAD = () => UI("({ icon: lead.querySelector('use').getAttribute('href').split('#rk-i-')[1], off: lead.disabled, value: url.value })");
globalThis.KEY = (keyCode, modifiers = []) => { for (const type of ["keyDown", "keyUp"]) R.win.webContents.sendInputEvent({ type, keyCode, modifiers }); };
globalThis.TYPE = async (text) => { await UI("url.focus(), url.value = '', 1"); R.win.webContents.focus(); for (const ch of text) { R.win.webContents.sendInputEvent({ type: "char", keyCode: ch }); await sleep(120); } await sleep(600); };`;
export default [
  { js: H + `R.go("https://example.com/"); await sleep(4000); await UI("url.focus(), 1"); await sleep(300); const l = await LEAD();
    return CHECK("an https page, the bar just focused: the lock, pressable", l.icon === "lock" && !l.off && l.value.includes("example.com"), l);` },
  { js: `await TYPE("what is rove"); const l = await LEAD();
    return CHECK("words typed: a magnifier, not the lock, not pressable", l.icon === "search" && l.off, l);` },
  { js: `await TYPE("wikipedia.org"); const l = await LEAD();
    return CHECK("an address typed: a globe", l.icon === "globe" && l.off, l);` },
  { js: `KEY("Escape"); await sleep(300); KEY("Escape"); await sleep(500); const l = await LEAD();
    return CHECK("Esc, Esc: the page's address and its lock back", l.icon === "lock" && !l.off && l.value.includes("example.com"), l);` },
];
