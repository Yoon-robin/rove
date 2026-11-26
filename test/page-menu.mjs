// node test/drive.mjs test/page-menu.mjs: the page's right-click menu has what Chrome's has on top
// of ours — a link in a new window, in a private window (not from one: its new window is private
// anyway), the link's words copied, a picture copied, and 다시 실행 in a box you type in. The test
// writes the PC's own clipboard and puts it back at the end. Needs the network (example.com).
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CLIP = process.mainModule.require("electron").clipboard;
globalThis.WAS = await CLIP.read(); // Electron 45: the W3C-like clipboard (read, write, has: promises)
globalThis.EDIT = (redo) => ({ canUndo: false, canRedo: redo, canCut: false, canCopy: false, canPaste: true, canDelete: false, canSelectAll: true });
globalThis.RIGHT = async (p) => {
  R.active.view.webContents.emit("context-menu", { preventDefault() {} }, { x: 10, y: 10, linkURL: "", linkText: "", srcURL: "", mediaType: "none", isEditable: false, selectionText: "", misspelledWord: "", dictionarySuggestions: [], editFlags: EDIT(false), ...p });
  await sleep(200); return R.lastMenu;
};
globalThis.ITEM = (m, label) => (m || []).find((i) => i.label === label);
globalThis.LINK = { linkURL: "https://example.com/?linked", linkText: "다음 쪽으로" };
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `R.go("https://example.com/?start"); await sleep(1200); const m = await RIGHT(LINK); const got = (m || []).map((i) => i.label).filter(Boolean);
    return CHECK("a link: new window, private window, its words", ["새 창에서 링크 열기", "비공개 창에서 링크 열기", "링크 글자 복사"].every((l) => got.includes(l)), got);` },
  { js: `const n = R.windows.length; ITEM(await RIGHT(LINK), "새 창에서 링크 열기").click(); await sleep(1500); const w = R.windows[R.windows.length - 1];
    const got = { windows: R.windows.length, priv: !!w.private, url: w.tabs[0]?.view.webContents.getURL() }; w.win.close(); await sleep(600);
    return CHECK("새 창에서 링크 열기: a new window with the link", got.windows === n + 1 && !got.priv && got.url === LINK.linkURL, got);` },
  { js: `const n = R.windows.length; ITEM(await RIGHT(LINK), "비공개 창에서 링크 열기").click(); await sleep(1500); const w = R.windows[R.windows.length - 1];
    globalThis.PW = w; const got = { windows: R.windows.length, priv: !!w.private, url: w.tabs[0]?.view.webContents.getURL() };
    return CHECK("비공개 창에서 링크 열기: a new private window with the link", got.windows === n + 1 && got.priv && got.url === LINK.linkURL, got);` },
  { js: `R.use(PW); const m = await RIGHT(LINK); const got = (m || []).map((i) => i.label).filter(Boolean); PW.win.close(); await sleep(600); R.use(R.windows[0]);
    return CHECK("from a private window: 새 창 (private), no 비공개 창", got.includes("새 창에서 링크 열기") && !got.includes("비공개 창에서 링크 열기"), got);` },
  { js: `await CLIP.writeText(""); ITEM(await RIGHT(LINK), "링크 글자 복사").click(); await sleep(200); const got = await CLIP.readText();
    return CHECK("링크 글자 복사: the words, not the address", got === LINK.linkText, got);` },
  { js: `await R.active.view.webContents.loadURL("data:text/html,<body style=margin:0><canvas id=c width=60 height=60></canvas><script>const c=document.getElementById('c'),x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,60,60);const i=new Image();i.src=c.toDataURL();i.style.display='block';c.replaceWith(i);</script>"); await sleep(600);
    await CLIP.writeText("x"); const m = await RIGHT({ mediaType: "image", srcURL: "data:image/png;base64,AAAA" }); const item = ITEM(m, "그림 복사"); item?.click(); await sleep(800);
    const got = { item: !!item, image: await CLIP.has("image/png"), text: await CLIP.has("text/plain") };
    return CHECK("그림 복사: the picture on the clipboard", got.item && got.image && !got.text, got);` },
  { js: `const on = ITEM(await RIGHT({ isEditable: true, editFlags: EDIT(true) }), "다시 실행"), off = ITEM(await RIGHT({ isEditable: true, editFlags: EDIT(false) }), "다시 실행");
    const { ClipboardItem } = process.mainModule.require("electron"); // what was read cannot be written back as it is: made again
    if (WAS.length) await CLIP.write(await Promise.all(WAS.map(async (it) => new ClipboardItem(Object.fromEntries(await Promise.all(it.types.map(async (t) => [t, await it.getType(t)]))))))); else CLIP.clear();
    return CHECK("a box you type in: 다시 실행, on when there is something to redo", on?.role === "redo" && on.enabled === true && off?.enabled === false, { on: on && on.enabled, off: off && off.enabled });` },
];
