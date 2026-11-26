// node test/drive.mjs test/spelling.mjs: the spell checker — English (and Korean where Windows has
// it) in normal and private windows; a word Chromium finds wrong gets a right-click menu with up to
// five things it could be above "사전에 추가", and a box with no word wrong gets none of it.
// The menu is fed what Chromium hands Rove: in a hidden window that never has focus Chromium does
// not check words at all (spellcheckEnabled false), so a real right-click on a wrong word needs a
// shown, focused window. "사전에 추가" is not clicked: on Windows it writes the PC's own word list.
// No network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.EDIT = { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: true, canDelete: false, canSelectAll: true };
globalThis.RIGHT = async (p) => {
  R.active.view.webContents.emit("context-menu", { preventDefault() {} }, { x: 10, y: 10, linkURL: "", linkText: "", srcURL: "", mediaType: "none", isEditable: true, selectionText: "", misspelledWord: "", dictionarySuggestions: [], editFlags: EDIT, ...p });
  await sleep(200); return (R.lastMenu || []).map((m) => m.label).filter(Boolean);
};`;
export default [
  { js: H + `const langs = R.session().getSpellCheckerLanguages(); R.createWindow({ priv: true }); await sleep(1200); const p = R.windows.find((w) => w.private && !w.gone);
    const plangs = R.privateSes?.getSpellCheckerLanguages() || []; p.win.close(); await sleep(500); R.use(R.windows[0]);
    return CHECK("English in normal and private windows", langs.includes("en-US") && plangs.includes("en-US"), { langs, plangs });` },
  { js: `const got = await RIGHT({ misspelledWord: "wrold", dictionarySuggestions: ["world", "wold", "word", "would", "rold", "wroldy"] });
    const add = got.indexOf("사전에 추가"), words = got.slice(0, add);
    return CHECK("a word found wrong: up to five it could be, then 사전에 추가, then editing", add > 0 && JSON.stringify(words) === '["world","wold","word","would","rold"]' && got.includes("붙여넣기"), got);` },
  { js: `const got = await RIGHT({});
    return CHECK("a box with no word wrong: just editing", !got.includes("사전에 추가") && got.includes("붙여넣기"), got);` },
];
