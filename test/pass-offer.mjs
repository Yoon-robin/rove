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
  // pages that empty the password box as they send (the password hashed into a hidden box first):
  // from the button's onclick, and from the box's own Enter
  const PAGES = {
    "/hash": '<title>로그인</title><form method="post" action="/in"><input name="u"><input name="p" type="password"><input type="hidden" name="h"><button type="button" onclick="const f = this.form; f.h.value = f.p.value; f.p.value = String(); f.submit()">들어가기</button></form>',
    "/enter": '<title>로그인</title><form method="post" action="/in"><input name="u"><input name="p" type="password" onkeydown="if (event.keyCode === 13) { event.preventDefault(); const f = this.form; f.h.value = f.p.value; f.p.value = String(); f.submit(); }"><input type="hidden" name="h"><button>들어가기</button></form>',
  };
  res.end(PAGES[q.url] || '<title>로그인</title><form method="post" action="/in"><input name="u" autocomplete="username"><input name="p" type="password"><button>들어가기</button></form>');
});
await new Promise((r) => SRV.listen(0, "127.0.0.1", r));
globalThis.SITE = "http://127.0.0.1:" + SRV.address().port;
globalThis.V = { state: "open", items: [], added: [], fail: null };
Object.assign(R.pass, { status: () => ({ state: V.state, email: "rove-offer@example.test", server: "https://pass.test" }),
  forPage: () => V.items, search: () => V.items, syncedAt: () => Date.now(),
  add: async (x) => { if (V.fail) return { error: V.fail }; V.added.push(x); V.items.push({ id: "n" + V.added.length, name: x.name, username: x.username, password: x.password, uris: [{ uri: x.uri, match: null }] }); return { ok: true, id: "n" + V.added.length }; } });
// typed in, then sent as a person does: Enter in the password box, or a press on the button (real input events, a hidden window)
globalThis.LOGIN = async (u, p, press = false, page = "/login") => {
  R.go(SITE + page); await sleep(900);
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
    const bar = await BAR(); V.fail = null; await R.win.webContents.executeJavaScript("document.getElementById('askYes').click(), 1"); await sleep(500);
    return CHECK("a failed save: said, 다시 keeps it", bar.shown && bar.what.includes("서버에 닿지 않아요") && bar.yes === "다시" && V.added.some((x) => x.username === "third@test") && !OFFER(), { bar, added: V.added.map((x) => x.username) });` },
  { js: `globalThis.NO = () => R.win.webContents.executeJavaScript("document.getElementById('askNo').click(), 1");
    await LOGIN("hash@test", "s3cret-5", true, "/hash"); const a = OFFER(); await NO(); await sleep(300);
    await LOGIN("enter@test", "s3cret-6", false, "/enter"); const b = OFFER(); await NO(); await sleep(300);
    return CHECK("the page empties the box as it sends (button onclick, the box's Enter): still offered", a?.name === "hash@test" && b?.name === "enter@test", { press: a?.name, enter: b?.name });` },
  // typed, then a press that sends nothing: what was read is not kept past an address-bar move, nor past 15 s
  { js: `globalThis.TYPED = async (u, p) => { R.go(SITE + "/login"); await sleep(900); const wc = R.active.view.webContents;
      await wc.executeJavaScript("document.querySelector('[name=u]').value = " + JSON.stringify(u) + "; document.querySelector('[name=p]').value = " + JSON.stringify(p) + "; 1");
      wc.focus(); for (const type of ["mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: 300, y: 300, button: "left", clickCount: 1 }); await sleep(400); return !!R.active.typed; };
    const read = await TYPED("idle@test", "s3cret-7"); R.go(SITE + "/login"); await sleep(1200);
    const moved = { read, kept: !!R.active.typed || !!R.active.sent, asked: !!OFFER() };
    const read2 = await TYPED("idle@test", "s3cret-8"); await sleep(15500);
    const idle = { read: read2, kept: !!R.active.typed || !!R.active.sent };
    return CHECK("read on a press, then forgotten: on an address-bar move and after 15 s", moved.read && !moved.kept && !moved.asked && idle.read && !idle.kept, { moved, idle });` },
  { js: `const has = () => R.active.view.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code: "'__roveTyped' in globalThis" }]);
    // loaded in one state, then pressed while locked (so only the page's own listener can take anything)
    const TRY = async (state) => { V.state = state; R.go(SITE + "/hash"); await sleep(900); V.state = "locked"; const wc = R.active.view.webContents;
      await wc.executeJavaScript("document.querySelector('[name=p]').value = 'x'; 1"); wc.focus();
      for (const type of ["mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: 300, y: 300, button: "left", clickCount: 1 }); await sleep(300); return has(); };
    const locked = await TRY("locked"), open = await TRY("open"); V.state = "open";
    return CHECK("loaded while locked: nothing taken in the page; while open: taken", !locked && open, { locked, open });` },
  { js: `R.createWindow({ priv: true }); await sleep(1500); await LOGIN("private@test", "s3cret-9"); const got = { private: !!R.cur?.private, title: R.active.title, asked: !!OFFER(), read: !!R.active.typed }; SRV.close();
    return CHECK("a private window: nothing read, nothing asked (its logins are saved by hand)", got.private && got.title === "들어옴" && !got.asked && !got.read, got);` },
];
