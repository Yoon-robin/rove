// node test/drive.mjs test/extension-folder-update.mjs: the web store updater leaves a folder one
// alone. A folder copied from Chrome's own Extensions (<id>/<version>_0) has the store's key and
// update_url; the library's updater took it, put the new version beside it and deleted the folder
// (Chrome doesn't update unpacked ones). Rove's own install (Extensions/<id>/<version>_0) is still
// updated. Network: a real store extension (uBlock Origin Lite) and Google's update service.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { session } = process.mainModule.require("electron");
globalThis.fs = process.mainModule.require("node:fs"); globalThis.path = process.mainModule.require("node:path");
globalThis.X = process.mainModule.require("./extensions.cjs");
globalThis.W = process.mainModule.require("node:module").createRequire(path.join(process.mainModule.require("electron").app.getAppPath(), "x.js"))("electron-chrome-web-store");
globalThis.SES = session.fromPartition("persist:rove");
globalThis.SX = SES.extensions || SES;
globalThis.DIR = path.join(process.env.ROVE_HOME, "Extensions");
globalThis.ID = "ddkjiahejlhfcafbddmgiahcphecmpfh";
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
// a store copy made old: <parent>/<id>/0.0.1_0
globalThis.OLDCOPY = async (parent) => {
  const got = await W.downloadExtension(ID, parent);
  const m = JSON.parse(fs.readFileSync(path.join(got, "manifest.json"), "utf8")); m.version = "0.0.1";
  const old = path.join(path.dirname(got), "0.0.1_0"); fs.renameSync(got, old);
  fs.writeFileSync(path.join(old, "manifest.json"), JSON.stringify(m));
  return old;
};
await R.exts.ready;`;
export default [
  { js: H + `const tmp = fs.mkdtempSync(path.join(process.mainModule.require("node:os").tmpdir(), "rove-copied-"));
    globalThis.FOLDER = await OLDCOPY(tmp); const add = await R.exts.addFolder(FOLDER);
    await W.updateExtensions(X.storeOnly(SES, DIR)); await sleep(300);
    const got = { add: add.ok, folder: fs.existsSync(path.join(FOLDER, "manifest.json")), beside: fs.readdirSync(path.dirname(FOLDER)), version: SX.getExtension(ID)?.version, path: SX.getExtension(ID)?.path };
    return CHECK("a folder one with the store's key: not updated, its folder kept, nothing put beside it", got.add && got.folder && got.beside.length === 1 && got.version === "0.0.1" && got.path === FOLDER, got);` },
  { js: `await R.exts.remove(ID); const own = await OLDCOPY(DIR); await SX.loadExtension(own);
    await W.updateExtensions(X.storeOnly(SES, DIR)); await sleep(300);
    const e = SX.getExtension(ID); const got = { version: e?.version, inDir: !!e && e.path.startsWith(DIR), oldGone: !fs.existsSync(own), folderKept: fs.existsSync(path.join(FOLDER, "manifest.json")) };
    return CHECK("Rove's own install: updated from the store, the old version gone", got.version && got.version !== "0.0.1" && got.inDir && got.oldGone && got.folderKept, got);` },
];
