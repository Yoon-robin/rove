// node test/drive.mjs test/pass-reprompt.mjs: a RobinPass login marked "ask for the master
// password again" (Bitwarden's reprompt) gives its password and code only with the master
// password typed for that go — copying, filling, the 인증 코드 list, the one-key fill — and
// the RobinPass popup asks for it. The check is the vault's own (a throwaway pass.json made
// here with the real key derivation); the logins are stand-ins, no server. Prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
const V = process.mainModule.require("./vault.cjs"), { join } = process.mainModule.require("node:path"), fs = process.mainModule.require("node:fs"), os = process.mainModule.require("node:os"), crypto = process.mainModule.require("node:crypto");
globalThis.PW = "test-" + crypto.randomBytes(6).toString("hex"); const email = "rove-reprompt@example.test", kdf = { type: 0, iterations: 600000, memory: 0, parallelism: 0 };
const file = join(fs.mkdtempSync(join(os.tmpdir(), "rove-reprompt-")), "pass.json");
const mk = await V.masterKey(PW, email, kdf);
fs.writeFileSync(file, JSON.stringify({ email, kdf, key: V.encrypt(crypto.randomBytes(64), V.stretch(mk)) }));
globalThis.KEPT = V.vault({ fetch: async () => { throw new Error("no network in this test"); }, file, protect: { seal: (s) => s, open: (s) => s } });
const at = [{ uri: "https://example.com/", match: null }];
globalThis.ITEMS = [{ id: "a", name: "시험 은행", username: "asked", password: "secret-asked", totp: "JBSWY3DPEHPK3PXP", uris: at, reprompt: true },
  { id: "b", name: "보통 사이트", username: "plain", password: "secret-plain", totp: "", uris: at, reprompt: false }];
Object.assign(R.pass, { status: () => ({ state: "open", email, server: "https://pass.test" }), item: (id) => ITEMS.find((i) => i.id === id) || null,
  forPage: () => ITEMS, search: () => ITEMS, withCodes: () => ITEMS.filter((i) => i.totp), code: () => ({ code: "123456", left: 20, period: 30 }), verify: KEPT.verify });
globalThis.CLIP = () => R.clipboard.readText();`;
export default [
  { js: H + `return CHECK("vault: right password", await KEPT.verify(PW), true) + "\\n" + CHECK("vault: wrong password", !(await KEPT.verify(PW + "x")), false) + "\\n" + CHECK("vault: none", !(await KEPT.verify("")), false);` },
  { js: `R.clipboard.writeText("before"); const r = await R.passCopy("a", "password");
    return CHECK("copy, no password: asked", r.reprompt && (await CLIP()) === "before", r);` },
  { js: `const r = await R.passCopy("a", "password", PW + "x"); return CHECK("copy, wrong password: refused", r.reprompt && r.error && (await CLIP()) === "before", r);` },
  { js: `const r = await R.passCopy("a", "totp"); return CHECK("code, no password: asked", r.reprompt && (await CLIP()) === "before", r);` },
  { js: `const r = await R.passCopy("a", "password", PW); return CHECK("copy, right password", r.ok && (await CLIP()) === "secret-asked", r);` },
  { js: `const r = await R.passCopy("a", "username"); return CHECK("user name: not asked", r.ok && (await CLIP()) === "asked", r);` },
  { js: `const r = await R.passCopy("b", "password"); return CHECK("other login: not asked", r.ok && (await CLIP()) === "secret-plain", r);` },
  { js: `const r = await R.passFill("a"); return CHECK("fill, no password: asked", !!r.reprompt, r);` },
  { js: `const r = await R.passFill("a", R.active, PW); return CHECK("fill, right password: past the ask", !r.reprompt, r);` },
  { js: `const c = R.passCodes(""); const a = c.find((x) => x.id === "a"); return CHECK("code list: not shown", a.code === "" && a.ask, a);` },
  // the popup: the copy button brings up the master password form; a wrong one says so; the right one copies
  { js: `R.go("https://example.com/"); await sleep(2500); R.clipboard.writeText("before");
    const d = R.overlay.webContents.debugger; try { d.attach("1.3"); } catch {} await d.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); // a hidden window has no focus otherwise
    R.showOverlay({ kind: "pass" }); await sleep(800);
    await R.overlay.webContents.executeJavaScript('document.querySelector(\\'.item[data-id="a"] [data-c="password"]\\').click(), 1'); await sleep(500);
    const f = await R.overlay.webContents.executeJavaScript('({ form: document.querySelector("form")?.dataset.form, name: document.querySelector(".who b")?.textContent, focus: document.activeElement?.id })');
    return CHECK("popup: asks", f.form === "again" && f.name === "시험 은행" && f.focus === "pp", f);` },
  { js: `const ov = R.overlay.webContents; await ov.executeJavaScript('document.querySelector("#pp").value = ' + JSON.stringify(PW + "x") + '; document.querySelector("form").requestSubmit(), 1'); await sleep(1500);
    const m = await ov.executeJavaScript('({ form: document.querySelector("form")?.dataset.form, msg: document.querySelector(".msg")?.textContent })');
    if (process.env.SHOT) await R.shot(process.env.SHOT); // the form, with what it said
    return CHECK("popup: wrong password", m.form === "again" && /맞지 않아요/.test(m.msg || "") && (await CLIP()) === "before", m);` },
  { js: `const ov = R.overlay.webContents; await ov.executeJavaScript('document.querySelector("#pp").value = ' + JSON.stringify(PW) + '; document.querySelector("form").requestSubmit(), 1'); await sleep(1500);
    const m = await ov.executeJavaScript('({ form: document.querySelector("form")?.dataset.form || "", msg: document.querySelector(".msg")?.textContent })');
    R.hideOverlay(); return CHECK("popup: right password copies", m.form === "" && (await CLIP()) === "secret-asked", m);` },
];
