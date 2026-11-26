// node test/drive.mjs test/open-file.mjs: Ctrl+O opens a file on this PC, as in Chrome — one file in this tab,
// more each in a new tab after it. The open dialog itself is not opened (openPaths is what it calls). Files in a temp folder, no network. Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const fs = process.mainModule.require("node:fs"), path = process.mainModule.require("node:path"), os = process.mainModule.require("node:os");
globalThis.FS = fs; globalThis.DIR = fs.mkdtempSync(path.join(os.tmpdir(), "rove-open-"));
globalThis.F = (n) => path.join(DIR, n);
for (const n of ["하나", "둘", "셋"]) fs.writeFileSync(F(n + ".html"), "<title>" + n + "</title><p>" + n);`;
export default [
  { js: H + `const key = !!R.keyAction({ type: "keyDown", key: "o", control: true, shift: false, alt: false, meta: false });
    const t = R.active, n = R.tabs.length; R.openPaths([F("하나.html")]); await sleep(1000);
    const got = { key, tabs: R.tabs.length - n, title: t.view.webContents.getTitle(), url: t.url };
    return CHECK("Ctrl+O, one file: this tab", key && got.tabs === 0 && got.title === "하나" && /^file:\\/\\/\\//.test(got.url), got);` },
  { js: `const t = R.active, i = R.tabs.indexOf(t); R.openPaths([F("둘.html"), F("셋.html")]); await sleep(1200);
    const got = [t, R.tabs[i + 1]].map((x) => x?.view.webContents.getTitle());
    FS.rmSync(DIR, { recursive: true, force: true });
    return CHECK("two files: this tab, then a new tab right after it", got[0] === "둘" && got[1] === "셋", got);` },
];
