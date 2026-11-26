// node test/drive.mjs test/bookmark-edit.mjs: the bookmarks drawer has a find box (by name or
// address, as the history drawer has) and each row can be renamed in place, as in Chrome and Edge —
// hundreds of bookmarks brought from another browser are found and named without leaving the drawer.
// The bookmarks are put in directly (no network); the drawer is opened once the overlay page is loaded. Prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.POP = (js) => R.overlay.webContents.executeJavaScript(js);
globalThis.NAMES = () => POP("[...document.querySelectorAll('.drawer .item b')].map((b) => b.textContent)");
globalThis.TYPE = (sel, text) => POP(\`(() => { const i = document.querySelector(\${JSON.stringify(sel)}); i.focus(); i.value = \${JSON.stringify(text)}; i.dispatchEvent(new Event("input")); return 1; })()\`);
globalThis.ESC = () => { const wc = R.overlay.webContents; wc.focus(); for (const type of ["keyDown", "keyUp"]) wc.sendInputEvent({ type, keyCode: "Escape" }); };
globalThis.KEY = (sel, key) => POP(\`(() => { document.querySelector(\${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent("keydown", { key: \${JSON.stringify(key)}, bubbles: true })); return 1; })()\`);
globalThis.READY = async () => { const wc = R.overlay.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-finish-load", r)); await sleep(300); };
R.bookmarks.splice(0, R.bookmarks.length,
  { url: "https://docs.example.test/rove", title: "Rove 문서", at: 1 },
  { url: "https://weather.example.test/seoul", title: "서울 날씨", at: 2 },
  { url: "https://music.example.test/", title: "음악", at: 3 });`;
export default [
  { js: H + `await READY(); R.showOverlay({ kind: "drawer", panel: "bookmarks" }); await sleep(700);
    const box = await POP("(() => { const q = document.querySelector('.drawer #q'); return q && q.placeholder; })()");
    return CHECK("bookmarks drawer: a find box", box === "즐겨찾기 찾기" && (await NAMES()).length === 3, { box, names: await NAMES() });` },
  { js: `await TYPE("#q", "날씨"); await sleep(400); const byName = await NAMES();
    await TYPE("#q", "MUSIC.example"); await sleep(400); const byAddress = await NAMES();
    const kept = await POP("document.activeElement?.id");
    return CHECK("found by name and by address (any case), the box keeps the caret", byName.join() === "서울 날씨" && byAddress.join() === "음악" && kept === "q", { byName, byAddress, kept });` },
  { js: `await TYPE("#q", ""); await sleep(400);
    const ok = await POP("(() => { const row = [...document.querySelectorAll('.drawer .item')].find((r) => r.textContent.includes('Rove 문서')); const b = row?.querySelector('[data-rename]'); if (!b) return null; b.click(); return b.getAttribute('aria-label'); })()");
    await sleep(400);
    const field = await POP("(() => { const i = document.querySelector('.drawer #bname'); return i && { value: i.value, focused: document.activeElement === i, all: i.selectionStart === 0 && i.selectionEnd === i.value.length }; })()");
    return CHECK("이름 고치기: the name becomes a field, focused and selected", ok === "이름 고치기" && field?.value === "Rove 문서" && field.focused && field.all, { ok, field });` },
  { js: `await TYPE("#bname", "Rove 계획 문서"); await POP("draw(), 1"); await sleep(300);
    const still = await POP("document.querySelector('.drawer #bname')?.value");
    await KEY("#bname", "Enter"); await sleep(400);
    const b = R.bookmarks.find((x) => x.url === "https://docs.example.test/rove");
    return CHECK("Enter: renamed (typing survives a redraw)", still === "Rove 계획 문서" && b.title === "Rove 계획 문서" && (await NAMES()).includes("Rove 계획 문서"), { still, title: b.title, names: await NAMES() });` },
  { js: `await POP("[...document.querySelectorAll('.drawer [data-rename]')][0].click(), 1"); await sleep(300);
    await TYPE("#bname", "버릴 이름"); ESC(); await sleep(400);
    const open = await POP("!!document.querySelector('.drawer')") && !!R.overlayOn, field = await POP("!!document.querySelector('.drawer #bname')");
    ESC(); await sleep(400); const shut = !R.overlayOn; R.showOverlay({ kind: "drawer", panel: "bookmarks" }); await sleep(600);
    return CHECK("Escape (a real key): the rename is dropped, the drawer stays; Escape again shuts it", open && !field && shut && !R.bookmarks.some((x) => x.title === "버릴 이름"), { open, field, shut, titles: R.bookmarks.map((x) => x.title) });` },
  { js: `const url = "https://music.example.test/";
    await POP("[...document.querySelectorAll('.drawer .item')].find((r) => r.textContent.includes('음악')).querySelector('[data-rename]').click(), 1"); await sleep(300);
    await TYPE("#bname", "   "); await POP("document.querySelector('.drawer [data-rename-ok]').click(), 1"); await sleep(400);
    const t = R.bookmarks.find((x) => x.url === url).title; R.hideOverlay();
    return CHECK("✓ with an empty name: the address stands for it", t === url, { t });` },
];
