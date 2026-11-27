// node test/drive.mjs test/extension-privacy.mjs: an extension that asks for every site (<all_urls>)
// is still kept out of the files on this PC (file://, as Chrome's "allow access to file URLs" off by
// default) and out of Rove's own pages (rove://, as chrome:// in Chrome) — but it is in a web page.
// A small store-style extension put in this run's Extensions folder, a page on 127.0.0.1: no network.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { session } = process.mainModule.require("electron");
const fs = process.mainModule.require("node:fs"); const path = process.mainModule.require("node:path"); const crypto = process.mainModule.require("node:crypto");
const X = process.mainModule.require("./extensions.cjs");
globalThis.SES = session.fromPartition("persist:rove");
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const der = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "der" });
const id = [...crypto.createHash("sha256").update(der).digest("hex").slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
const dir = path.join(process.env.ROVE_HOME, "Extensions");
const v = path.join(dir, id, "1.0_0"); fs.mkdirSync(v, { recursive: true });
fs.writeFileSync(path.join(v, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "All sites test", version: "1.0", key: der.toString("base64"),
  host_permissions: ["<all_urls>"], content_scripts: [{ matches: ["<all_urls>"], js: ["mark.js"], run_at: "document_start" }] }));
fs.writeFileSync(path.join(v, "mark.js"), "document.documentElement.dataset.ext = 'on';");
globalThis.FILE = process.mainModule.require("node:url").pathToFileURL(path.join(process.env.ROVE_HOME, "local.html")).href;
fs.writeFileSync(path.join(process.env.ROVE_HOME, "local.html"), "<title>local</title><p>a file on this PC");
const srv = process.mainModule.require("node:http").createServer((q, s) => { s.writeHead(200, { "content-type": "text/html" }); s.end("<title>here</title><p>page"); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
globalThis.PAGE = "http://127.0.0.1:" + srv.address().port + "/";
globalThis.MARK = async (url) => { const wc = R.active.view.webContents; await wc.loadURL(url); await sleep(400); return [wc.getURL(), await wc.executeJavaScript("document.documentElement.dataset.ext || ''")]; };
await X.loadInstalled(SES, dir, {});`;
export default [
  { js: H + `const got = await MARK(PAGE); return CHECK("in a web page", got[1] === "on", got);` },
  { js: `const got = await MARK(FILE); return CHECK("not in a file on this PC", got[0].startsWith("file:") && got[1] === "", got);` },
  { js: `const got = await MARK("rove://ui/newtab.html"); return CHECK("not in Rove's own page", got[0] === "rove://ui/newtab.html" && got[1] === "", got);` },
];
