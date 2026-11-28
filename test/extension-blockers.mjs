// node test/drive.mjs test/extension-blockers.mjs: before an extension that blocks requests is added
// (uBlock Origin Lite and the like use declarativeNetRequest, which Electron does not have), the
// ask bar says it will not block in Rove — instead of an install that silently does nothing.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.X = process.mainModule.require("./extensions.cjs");
globalThis.BAR = () => R.win.webContents.executeJavaScript("({ what: document.getElementById('askWhat').textContent, warn: document.getElementById('ask').classList.contains('warn'), shown: !document.getElementById('ask').hidden })");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `const b = X.blocksRequests;
    const got = typeof b === "function" && [b({ permissions: ["declarativeNetRequest"] }), b({ permissions: ["declarativeNetRequestWithHostAccess"] }), b({ optional_permissions: ["declarativeNetRequest"] }), b({ permissions: ["webRequest", "webRequestBlocking"] }), b({ permissions: ["storage", "tabs"] }), b({})];
    return CHECK("which manifests block requests", JSON.stringify(got) === "[true,true,true,true,false,false]", got);` },
  { js: `R.go("https://example.com/"); await sleep(1200);
    const p = R.askExtension({ name: "uBlock Origin Lite", allSites: true, wontBlock: true, wc: R.active.view.webContents }); await sleep(500);
    const got = await BAR(); R.answer(R.asks[0]?.id, false); const said = await p;
    return CHECK("a blocker: the ask bar says it won't block here", got.shown && got.warn && /Rove에서 안/.test(got.what) && /모든 사이트/.test(got.what) && said === false, { ...got, said });` },
  { js: `// an 800-wide window (half of a laptop screen) cuts the line: the all-sites warning must still show
    const size = R.win.getSize(); R.win.setSize(800, 600); await sleep(400);
    const p = R.askExtension({ name: "uBlock Origin Lite", allSites: true, wontBlock: true, wc: R.active.view.webContents }); await sleep(500);
    const got = await R.win.webContents.executeJavaScript("(() => { const s = document.getElementById('askWhat'); const t = s.firstChild; const i = t.data.indexOf('모든 사이트의 내용을 읽고 바꿀 수 있음'); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 22); return { seen: i >= 0 && r.getBoundingClientRect().right <= s.getBoundingClientRect().right + 0.5, cut: s.scrollWidth > s.clientWidth, title: s.title === s.textContent } })()");
    R.answer(R.asks[0]?.id, false); await p; R.win.setSize(size[0], size[1]);
    return CHECK("a narrow window: the all-sites warning is not cut, the whole line on hover", got.seen && got.cut && got.title, got);` },
  { js: `const p = R.askExtension({ name: "Dark Reader", allSites: true, wontBlock: false, wc: R.active.view.webContents }); await sleep(500);
    const got = await BAR(); R.answer(R.asks[0]?.id, true); const said = await p;
    return CHECK("another extension: as before", got.shown && !got.warn && !/Rove에서 안/.test(got.what) && said === true, { ...got, said });` },
];
