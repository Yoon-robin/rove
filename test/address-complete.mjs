// node test/drive.mjs test/address-complete.mjs: typing the start of a site already visited fills the
// rest in the address bar, selected (Chrome's inline autocomplete) — but not after a delete, not
// while Hangul is being put together, and Esc takes the filled part back. Shift+Delete on a history
// row of the suggestions forgets that page. The history is put in directly; the bar is typed into
// with real key events (a hidden window). Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.UI = (js) => R.win.webContents.executeJavaScript(js);
globalThis.BAR = () => UI("({ value: url.value, from: url.selectionStart, to: url.selectionEnd, first: items[0] && items[0].kind + ' ' + items[0].url, shown: suggestShown })");
globalThis.KEY = (keyCode, modifiers = []) => { for (const type of ["keyDown", "keyUp"]) R.win.webContents.sendInputEvent({ type, keyCode, modifiers }); };
globalThis.TYPE = async (text) => { await UI("url.focus(), url.value = '', 1"); R.win.webContents.focus(); for (const ch of text) { R.win.webContents.sendInputEvent({ type: "char", keyCode: ch }); await sleep(120); } await sleep(500); };
const now = Date.now();
R.history.splice(0, R.history.length,
  { url: "https://gitlab.com/", title: "GitLab", at: now - 9000 },
  { url: "https://www.youtube.com/watch?v=x", title: "영상", at: now - 5000 },
  { url: "https://github.com/Yoon-robin/rove", title: "rove 저장소", at: now - 1000 });`;
export default [
  { js: H + `R.go("about:blank"); await sleep(600); await TYPE("git"); const b = await BAR();
    return CHECK("git: github.com (the newest), the filled part selected, Enter goes there", b.value === "github.com" && b.from === 3 && b.to === 10 && ["go https://github.com", "go https://github.com/"].includes(b.first), b);` },
  { js: `await TYPE("you"); const b = await BAR(); return CHECK("you: youtube.com (no www.)", b.value === "youtube.com" && b.from === 3 && b.to === 11, b);` },
  { js: `KEY("Backspace"); await sleep(500); const b = await BAR();
    return CHECK("Backspace: the filled part goes, not filled again", b.value === "you" && b.first?.startsWith("search "), b);` },
  { js: `await TYPE("git"); KEY("Escape"); await sleep(400); const b = await BAR();
    return CHECK("Esc: the filled part taken back", b.value === "git" && !b.shown, b);` },
  { js: `await UI("url.focus(), url.value = 'gi', url.setSelectionRange(2, 2), url.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: 'ㄱ', isComposing: true })), 1"); await sleep(500);
    const b = await BAR(); return CHECK("Hangul being put together: not filled", b.value === "gi", b);` },
  { js: `await TYPE("rove"); KEY("Down"); await sleep(300); const row = await UI("items[sel] && items[sel].kind + ' ' + items[sel].url");
    KEY("Delete", ["shift"]); await sleep(600); const b = await BAR(); const rows = await UI("items.map((i) => i.url)");
    return CHECK("Shift+Delete on a history row: the page forgotten, the row gone", row === "history https://github.com/Yoon-robin/rove" && !R.history.some((h) => h.url.includes("Yoon-robin")) && !rows.some((u) => u.includes("Yoon-robin")), { row, rows, value: b.value });` },
];
