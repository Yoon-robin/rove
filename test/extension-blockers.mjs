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
  { js: `const p = R.askExtension({ name: "Dark Reader", allSites: true, wontBlock: false, wc: R.active.view.webContents }); await sleep(500);
    const got = await BAR(); R.answer(R.asks[0]?.id, true); const said = await p;
    return CHECK("another extension: as before", got.shown && !got.warn && !/Rove에서 안/.test(got.what) && said === true, { ...got, said });` },
];
