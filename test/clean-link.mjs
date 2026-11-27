// node test/drive.mjs test/clean-link.mjs: a link's right-click menu has Brave's 깨끗한 링크 복사
// when the link carries a click id (fbclid, gclid ...), and it copies the link without it; a link
// without one has no such line. The PC's clipboard is not touched: writeText is caught for the test.
// No network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.EDIT = { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: false, canDelete: false, canSelectAll: true };
globalThis.RIGHT = async (p) => {
  R.active.view.webContents.emit("context-menu", { preventDefault() {} }, { x: 10, y: 10, linkURL: "", linkText: "", srcURL: "", mediaType: "none", isEditable: false, selectionText: "", misspelledWord: "", dictionarySuggestions: [], editFlags: EDIT, ...p });
  await sleep(200); return R.lastMenu;
};
globalThis.ITEM = (m, label) => (m || []).find((i) => i.label === label);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const clip = process.mainModule.require("electron").clipboard;
globalThis.COPIED = [];
globalThis.REAL = clip.writeText;
clip.writeText = (t) => { COPIED.push(t); };`;
export default [
  { js: H + `const m = await RIGHT({ linkURL: "https://example.com/a?id=7&fbclid=XYZ&gclid=1#top", linkText: "글" }); const item = ITEM(m, "깨끗한 링크 복사");
    item?.click(); await sleep(100);
    return CHECK("a link with fbclid·gclid: 깨끗한 링크 복사 copies it without them", !!item && COPIED.at(-1) === "https://example.com/a?id=7#top", { item: !!item, copied: COPIED.at(-1) });` },
  { js: `const m = await RIGHT({ linkURL: "https://example.com/a?utm_source=x", linkText: "글" });
    return CHECK("a link without a click id: no 깨끗한 링크 복사, 링크 주소 복사 still there", !ITEM(m, "깨끗한 링크 복사") && !!ITEM(m, "링크 주소 복사"), (m || []).map((i) => i.label).filter(Boolean));` },
  { js: `ITEM(await RIGHT({ linkURL: "https://example.com/?fbclid=1", linkText: "" }), "링크 주소 복사").click(); await sleep(100);
    const got = COPIED.at(-1); process.mainModule.require("electron").clipboard.writeText = REAL;
    return CHECK("링크 주소 복사 keeps the link as it is", got === "https://example.com/?fbclid=1", got);` },
];
