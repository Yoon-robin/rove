// node test/drive.mjs test/pass-offer.mjs: a login (or sign-up) form sent with a password the vault
// does not have yet: once the next page is there, the ask bar offers to keep it in RobinPass, as
// Chrome's 비밀번호 저장 — not when the vault has it already, not when it is locked; a failed save
// is said and can be tried again. The vault is a stand-in (no server), the site a local one; the
// form is sent by a real Enter or a real press on its button.
// Each line prints ok or FAIL.
const H = `globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.CHECK = (name, ok, got) => (ok ? "ok   " : "FAIL ") + name + ": " + JSON.stringify(got);
globalThis.SRV = process.mainModule.require("http").createServer((q, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  if (q.method === "POST") { q.resume(); q.on("end", () => res.end("<title>들어옴</title>welcome")); return; }
  res.end('<title>로그인</title><form method="post" action="/in"><input name="u" autocomplete="username"><input name="p" type="password"><button>들어가기</button></form>');
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.SITE = "http://127.0.0.1:" + SRV.address().port;
globalThis.V = { state: "open", items: [], added: [], fail: null };
Object.assign(R.pass, { status: () => ({ state: V.state, email: "rove-offer@example.test", server: "https://pass.test" }),
  forPage: () => V.items, search: () => V.items, syncedAt: () => Date.now(),
  add: async (x) => { if (V.fail) return { error: V.fail }; V.added.push(x); V.items.push({ id: "n" + V.added.length, name: x.name, username: x.username, password: x.password, uris: [{ uri: x.uri, match: null }] }); return { ok: true, id: "n" + V.added.length }; } });
// typed in, then sent as a person does: Enter in the password box, or a press on the button (real input events, a hidden window)
globalThis.LOGIN = async (u, p, press = false) => {
  R.go(SITE + "/login"); await sleep(900);
  const wc = R.active.view.webContents;
  const at = await wc.executeJavaScript("document.querySelector('[name=u]').value = " + JSON.stringify(u) + "; const pw = document.querySelector('[name=p]'); pw.value = " + JSON.stringify(p) + "; pw.focus(); const b = document.querySelector('button').getBoundingClientRect(); [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)]");
  wc.focus();
  if (press) for (const type of ["mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: at[0], y: at[1], button: "left", clickCount: 1 });
  else for (const type of ["keyDown", "char", "keyUp"]) wc.sendInputEvent({ type, keyCode: "Return" });
  await sleep(1500);
};
globalThis.OFFER = () => R.asks.find((a) => a.kind === "pass") || null;
globalThis.BAR = () => R.win.webContents.executeJavaScript("({ shown: !document.getElementById('ask').hidden, who: document.getElementById('askWho').textContent, what: document.getElementById('askWhat').textContent, yes: document.getElementById('askYes').textContent, no: document.getElementById('askNo').textContent, leaks: JSON.stringify(state).includes('s3cret') })");`;
export default [
  { js: H + `await LOGIN("robin@test", "s3cret-pw"); const a = OFFER(), bar = await BAR();
    return CHECK("sent, not in the vault: offered on the next page (the password not in the bar's state)", !!a && R.active.title === "들어옴" && bar.shown && bar.yes === "저장" && bar.no === "안 함" && bar.what.includes("robin@test") && !bar.leaks, { asked: !!a, title: R.active.title, bar });` },
  { js: `await R.win.webContents.executeJavaScript("document.getElementById('askYes').click(), 1"); await sleep(500);
    const x = V.added[0];
    return CHECK("저장: kept in the vault for this site", x && x.username === "robin@test" && x.password === "s3cret-pw" && x.uri === SITE + "/" && !OFFER(), { x: x && { ...x, password: x.password === "s3cret-pw" }, left: !!OFFER() });` },
  { js: `await LOGIN("robin@test", "s3cret-pw"); return CHECK("the vault has it already: nothing asked", !OFFER(), { asked: !!OFFER() });` },
  { js: `V.state = "locked"; await LOGIN("other@test", "s3cret-2"); V.state = "open"; return CHECK("locked: nothing asked", !OFFER(), { asked: !!OFFER() });` },
  { js: `await LOGIN("other@test", "s3cret-3", true); const a = OFFER(); await R.win.webContents.executeJavaScript("document.getElementById('askNo').click(), 1"); await sleep(400);
    return CHECK("안 함: nothing kept, the bar gone", !!a && !OFFER() && V.added.length === 1, { asked: !!a, added: V.added.length });` },
  { js: `V.fail = "서버에 닿지 않아요"; await LOGIN("third@test", "s3cret-4"); await R.win.webContents.executeJavaScript("document.getElementById('askYes').click(), 1"); await sleep(500);
    const bar = await BAR(); V.fail = null; await R.win.webContents.executeJavaScript("document.getElementById('askYes').click(), 1"); await sleep(500); SRV.close();
    return CHECK("a failed save: said, 다시 keeps it", bar.shown && bar.what.includes("서버에 닿지 않아요") && bar.yes === "다시" && V.added.some((x) => x.username === "third@test") && !OFFER(), { bar, added: V.added.map((x) => x.username) });` },
];
