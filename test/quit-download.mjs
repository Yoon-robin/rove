// node test/drive.mjs test/quit-download.mjs: a file still coming down when Rove ends stays in the
// downloads list. downloads.json was written only when a download ended, so one cut off by quitting
// was never written and was gone from the list at the next start (no name, no address to get it again);
// in Chrome and Brave it comes back as interrupted, to get again. Here Rove's own before-quit (what
// app.quit runs) is sent while a slow local file is half down; downloads.json must have it then (the
// next start reads a progressing row as interrupted, with 다시 받기).
// A local server in Rove's main process sends it — no network.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.FS = process.mainModule.require("node:fs"); globalThis.PATH = process.mainModule.require("node:path");
globalThis.SRV = process.mainModule.require("node:http").createServer((q, s) => {
  s.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=slow.bin", "content-length": String(1 << 22) });
  const t = setInterval(() => s.write(Buffer.alloc(16384)), 50); s.on("close", () => clearInterval(t));
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);`;
export default [
  { js: H + `{ const wc = R.active.view.webContents; if (wc.isLoading()) await new Promise((r) => wc.once("did-stop-loading", r)); }
    const url = "http://127.0.0.1:" + SRV.address().port + "/slow.bin";
    R.active.view.webContents.downloadURL(url); await sleep(1200);
    const mem = R.downloads.map((d) => d.state);
    process.mainModule.require("electron").app.emit("before-quit", { preventDefault() {} });
    let kept = null; try { kept = JSON.parse(FS.readFileSync(PATH.join(process.env.ROVE_HOME, "downloads.json"), "utf8")); } catch {}
    const got = { mem, kept: kept && kept.map((d) => ({ name: d.name, state: d.state, url: d.url === url })) };
    return CHECK("half down when Rove ends: downloads.json has it, with its address", mem[0] === "progressing" && kept?.length === 1 && kept[0].name === "slow.bin" && kept[0].state === "progressing" && kept[0].url === url, got);` },
];
