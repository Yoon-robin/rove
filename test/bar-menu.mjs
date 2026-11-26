// node test/drive.mjs test/bar-menu.mjs: right-clicking the address bar or the find box gives the
// editing menu (cut, copy, paste, select all), and the address bar also "붙여넣고 이동" (Edge's
// paste and go: Ctrl+Shift+L there is RobinPass here, so it is the menu only). The test writes the
// PC's own clipboard and puts it back as it was at the end. Needs the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CLIP = process.mainModule.require("electron").clipboard;
globalThis.WAS = await CLIP.readText();
globalThis.EDIT = { canUndo: false, canRedo: false, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true };
globalThis.RIGHT = async (id, editable = true) => {
  await R.win.webContents.executeJavaScript("(() => { const e = document.getElementById(" + JSON.stringify(id) + "); if (e) e.focus(); else document.activeElement?.blur(); return 1; })()");
  R.win.webContents.emit("context-menu", { preventDefault() {} }, { isEditable: editable, editFlags: EDIT, x: 10, y: 10 }); await sleep(300);
  return R.lastMenu;
};
globalThis.LABELS = (m) => (m || []).filter((i) => i.label).map((i) => i.label);
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const m = await RIGHT("url"); const got = LABELS(m);
    return CHECK("address bar: the editing menu and 붙여넣고 이동", ["잘라내기", "복사", "붙여넣기", "모두 선택", "붙여넣고 이동"].every((l) => got.includes(l)), got);` },
  { js: `CLIP.writeText("  https://example.com/?pasted  "); const m = await RIGHT("url"); const go = m.find((i) => i.label === "붙여넣고 이동");
    go.click(); await sleep(1500);
    return CHECK("붙여넣고 이동: the page of what was copied", R.active.view.webContents.getURL() === "https://example.com/?pasted", R.active.view.webContents.getURL());` },
  { js: `CLIP.writeText(""); const m = await RIGHT("url"); const go = m.find((i) => i.label === "붙여넣고 이동");
    return CHECK("nothing copied: 붙여넣고 이동 is off", go && go.enabled === false, go && { enabled: go.enabled });` },
  { js: `R.setFind(true); await sleep(300); const m = await RIGHT("findText"); const got = LABELS(m); R.setFind(false); CLIP.writeText(WAS || "");
    return CHECK("find box: the editing menu, no 붙여넣고 이동", got.includes("붙여넣기") && !got.includes("붙여넣고 이동"), got);` },
];
