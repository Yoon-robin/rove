// The see-through layer over the window: the menu, the address suggestions
// and the drawers. Main shows it only while one of them is open.
const root = document.getElementById("root");
const icon = (name) => `<svg class="rk-ico"><use href="icons.svg#rk-i-${name}"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const host = (u) => { try { return new URL(u).host; } catch { return u; } };
let state = { downloads: [] };
let open = null;
let panel = "history";
let query = "";
let sure = false; // "clear all" asked once

rove.on("rove:state", (s) => {
  const was = state.pass?.state, fetched = state.pass?.synced;
  state = s;
  if (open?.kind === "menu") draw();
  if (open?.kind === "drawer" && panel !== "history") draw();
  if (open?.kind === "pass" && s.pass?.state !== was) { pmsg = ""; draw(); }
  else if (open?.kind === "pass" && s.pass?.synced !== fetched && !pbusy) draw();
  if (open?.kind === "site") drawSite(true);
  if (open?.kind === "tabs") drawTabs();
  if (open?.kind === "group") groupShown();
  if (open?.kind === "peek") drawPeek();
  document.body.classList.toggle("vertical", !!s.vertical);
});
rove.ask("rove:state").then((s) => { if (s) state = s; });
rove.on("rove:overlay", (what) => {
  const was = open?.kind;
  open = what;
  // opened from the keyboard: no motion (ui.css .keyed)
  if (what?.kind !== was) document.body.classList.toggle("keyed", !!what?.keyed);
  if (what?.kind === "drawer") { if ((was !== "drawer" || what.panel) && (what.panel || panel) !== panel) { panel = what.panel; query = ""; } sure = false; }
  if (what?.kind === "pass" && was !== "pass") { pq = ""; pmsg = ""; ppeek = undefined; psecond = null; pagain = null; }
  if (what?.kind !== "pass") stopTick();
  if (what?.kind === "site" && was !== "site") { siteSure = false; siteMsg = null; siteKey = ""; }
  if (what?.kind === "tabs" && was !== "tabs") { tq = ""; tsel = 0; }
  if (what?.kind === "drawer" && was !== "drawer") { importing = null; importMsg = null; renaming = null; }
  if (what?.importing) importing = true; // the first run's 가져오기: straight to the browsers list
  if (what?.kind === "share" && was !== "share") { shareFrom = what.screens.length ? "screens" : "windows"; sharePick = null; shareSound = true; }
  draw();
});
const shut = () => rove.send("rove:overlay", null);

function draw() {
  if (!open) { root.innerHTML = ""; return; }
  if (open.kind === "suggest") return drawSuggest();
  if (open.kind === "menu") return drawMenu();
  if (open.kind === "keys") return drawKeys();
  if (open.kind === "drawer") return drawDrawer();
  if (open.kind === "pass") return drawPass();
  if (open.kind === "site") return drawSite();
  if (open.kind === "share") return drawShare();
  if (open.kind === "tabs") return drawTabs();
  if (open.kind === "splitdrag") return drawSplitDrag();
  if (open.kind === "splitdrop") return drawSplitDrop();
  if (open.kind === "group") return drawGroup();
  if (open.kind === "peek") return drawPeek();
}

// ---- the tabs folded to icons, the pointer on them: the same list unfolded, over the page -----
// (the marks and rows of ui.js's list, so nothing moves under the pointer; no dragging here)
function drawPeek() {
  const was = root.querySelector(".peek .sidelist")?.scrollTop;
  const groups = new Map((state.groups || []).map((g) => [g.id, g]));
  const face = (t) => t.favicon ? `<img alt="" src="${esc(t.favicon)}">` : icon("globe");
  let last = null;
  const rows = state.tabs.map((t, i) => {
    const g = groups.get(t.group) || null;
    const label = g && t.group !== last ? `<button class="grp${g.collapsed ? " folded" : ""}" type="button" data-g="${g.id}" data-color="${esc(g.color)}"><i class="dot"></i><span class="n">${esc(g.name || COLORS[g.color] || "묶음")}</span><small class="c rk-num">${state.tabs.filter((x) => x.group === g.id).length}</small>${icon("down")}</button>` : "";
    last = g ? t.group : null;
    const cls = ["tab", t.pinned && "pinned", t.asleep && "asleep", g && "ing", g?.collapsed && "folded", g && state.tabs[i + 1]?.group !== t.group && "gend"].filter(Boolean).join(" ");
    return `${label}<div class="${cls}" role="tab" aria-selected="${t.id === state.active}" data-id="${t.id}"${g ? ` data-color="${esc(g.color)}"` : ""} title="${esc(t.title || t.url)}"><span class="ic">${face(t)}</span><span class="t">${esc(t.title || host(t.url))}</span><button class="btn x" type="button" aria-label="탭 닫기" tabindex="-1">${icon("close")}</button><i class="gl"></i></div>`;
  }).join("");
  root.innerHTML = `<nav class="side peek" aria-label="탭">
    <button class="sidenew" type="button" title="새 탭 (Ctrl+T)">${icon("plus")}<span>새 탭</span></button>
    <div class="sidelist"><div class="tabs">${rows}</div></div>
    <div class="sidefoot"><button class="btn" type="button" aria-label="탭 이름 보이기" title="탭 이름 보이기">${icon("sidebar")}</button></div></nav>`;
  const list = root.querySelector(".sidelist");
  list.scrollTop = was ?? open.scroll ?? 0;
  root.querySelector(".sidenew").addEventListener("click", () => rove.send("rove:new-tab"));
  root.querySelector(".sidefoot .btn").addEventListener("click", () => rove.send("rove:narrow", false));
  for (const b of root.querySelectorAll(".grp")) b.addEventListener("click", () => rove.send("rove:group-fold", Number(b.dataset.g)));
  for (const el of root.querySelectorAll(".tab")) {
    const id = Number(el.dataset.id);
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); rove.send("rove:close", id); }
      else if (e.button === 0 && !e.target.closest(".x")) rove.send("rove:select", id);
    });
    el.querySelector(".x").addEventListener("click", () => rove.send("rove:close", id));
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); rove.send("rove:tab-menu", id); });
  }
}

// ---- a tab group: its name and colour (its label right-clicked, or just made) ----------
const COLORS = { grey: "회색", blue: "파랑", apricot: "살구", white: "흰색" };
function drawGroup() {
  const g = (state.groups || []).find((x) => x.id === open.id);
  if (!g) { shut(); return; }
  const id = g.id;
  root.innerHTML = `<div class="scrim"></div><div class="pop grpedit rk-menu" role="dialog" aria-label="탭 묶음">
    <div class="gform"><input class="rk-input" id="gname" maxlength="40" placeholder="${esc(COLORS[g.color])}" aria-label="묶음 이름" value="${esc(g.name)}">
    <div class="swatches" role="radiogroup" aria-label="색">${Object.entries(COLORS).map(([c, n]) => `<button type="button" class="sw" data-color="${c}" role="radio" aria-checked="${g.color === c}" aria-label="${n}" title="${n}"></button>`).join("")}</div></div>
    <hr>
    <button class="rk-menu__item" data-do="newtab" role="menuitem">${icon("plus")}묶음에 새 탭</button>
    <button class="rk-menu__item" data-do="ungroup" role="menuitem">${icon("tabs")}묶음 풀기</button>
    <button class="rk-menu__item" data-do="close" role="menuitem">${icon("close")}묶음 닫기</button></div>`;
  const box = root.querySelector(".grpedit");
  box.style.left = `${Math.max(8, Math.min(innerWidth - 256, open.x || 8))}px`;
  box.style.top = `${Math.max(8, Math.min(innerHeight - 220, open.y || 48))}px`;
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  const name = root.querySelector("#gname");
  name.addEventListener("input", () => rove.send("rove:group-set", id, { name: name.value }));
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); shut(); } });
  root.querySelectorAll(".sw").forEach((b) => b.addEventListener("click", () => rove.send("rove:group-set", id, { color: b.dataset.color })));
  root.querySelector('[data-do="newtab"]').addEventListener("click", () => rove.send("rove:group-new-tab", id));
  root.querySelector('[data-do="ungroup"]').addEventListener("click", () => rove.send("rove:group-ungroup", id));
  root.querySelector('[data-do="close"]').addEventListener("click", () => rove.send("rove:group-close", id));
  name.focus();
  name.select();
}
// state came: the colour chosen moves, the name being typed is left alone
function groupShown() {
  const g = (state.groups || []).find((x) => x.id === open.id);
  if (!g) { shut(); return; }
  root.querySelectorAll(".sw").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.color === g.color)));
  const name = root.querySelector("#gname");
  if (name) name.placeholder = COLORS[g.color];
}

// ---- the gap between two tabs side by side, dragged (over everything while it lasts) ----
function drawSplitDrag() {
  root.innerHTML = `<div class="scrim splitdrag"></div>`;
  let raf = 0;
  const move = (e) => {
    if (!(e.buttons & 1)) { end(); return; }
    cancelAnimationFrame(raf);
    const l = state.frame?.left || 0;
    raf = requestAnimationFrame(() => rove.send("rove:split-ratio", (e.clientX - l - 2) / Math.max(1, innerWidth - l - 4)));
  };
  const end = () => { removeEventListener("mousemove", move); removeEventListener("mouseup", end); shut(); };
  addEventListener("mousemove", move);
  addEventListener("mouseup", end);
}

// ---- a tab dragged from the strip, held at the page's edge: the half it would take ----------
// (the strip still holds the pointer and sends the drop; if a release lands here, it is sent here)
function drawSplitDrop() {
  const f = state.frame || { top: 84, left: 0 }, { side, id, was } = open;
  root.innerHTML = `<div class="scrim splitdrop"><div class="half ${side === "left" ? "l" : "r"}"><span>여기에 놓으면 나란히 보기</span></div></div>`;
  Object.assign(root.firstChild.style, { top: `${f.top}px`, left: `${f.left}px` }); // the page's area (no inline style: CSP)
  root.firstChild.addEventListener("mouseup", () => { rove.send("rove:split-drop", id, side, was); shut(); }, { once: true });
}

// ---- open tabs, found by name (Ctrl+Shift+A) ----------------------------------------------
let tq = ""; // what is typed
let tsel = 0; // the chosen row
async function drawTabs() {
  const mine = open;
  const closed = (await rove.ask("rove:closed")) || [];
  if (open !== mine) return;
  const q = tq.trim().toLowerCase();
  const hit = (title, url) => !q || `${title} ${url}`.toLowerCase().includes(q);
  const live = state.tabs.filter((t) => hit(t.title, t.url));
  const gone = closed.filter((u) => hit("", u));
  const rows = [...live.map((t) => ({ kind: "tab", t })), ...gone.map((u) => ({ kind: "closed", u }))];
  tsel = Math.max(0, Math.min(tsel, rows.length - 1));
  const face = (t) => t.favicon ? `<img class="fav" alt="" src="${esc(t.favicon)}">` : icon("globe");
  const row = (r, n) => {
    const on = n === tsel ? " sel" : "";
    if (r.kind === "tab") return `<div class="item${on}${r.t.asleep ? " asleep" : ""}" role="option" aria-selected="${n === tsel}" data-n="${n}">${face(r.t)}<div class="w"><b>${esc(r.t.title || r.t.url)}</b><small>${esc(host(r.t.url))}${r.t.id === state.active ? " · 지금 탭" : ""}</small></div>
      <button class="btn hover" data-close="${r.t.id}" aria-label="탭 닫기" title="탭 닫기">${icon("close")}</button></div>`;
    return `<div class="item${on}" role="option" aria-selected="${n === tsel}" data-n="${n}">${icon("clock")}<div class="w"><b>${esc(host(r.u))}</b><small>${esc(r.u)}</small></div></div>`;
  };
  const keep = document.activeElement?.id === "tq";
  root.innerHTML = `<div class="scrim"></div><div class="pop tabfind rk-menu" role="dialog" aria-label="탭 찾기">
    <div class="search"><input class="rk-input" id="tq" type="search" placeholder="탭 찾기" spellcheck="false" value="${esc(tq)}" role="combobox" aria-expanded="true" aria-controls="tl"></div>
    <div class="list" id="tl" role="listbox">${live.length ? `<div class="rk-label">열린 탭 <span class="rk-num">${live.length}</span></div>${rows.slice(0, live.length).map(row).join("")}` : ""}
    ${gone.length ? `<div class="rk-label">닫은 탭</div>${rows.slice(live.length).map((r, i) => row(r, live.length + i)).join("")}` : ""}
    ${rows.length ? "" : `<div class="rk-empty">${icon("search")}찾은 탭이 없어요</div>`}</div></div>`;
  const go = (n) => { const r = rows[n]; if (!r) return; if (r.kind === "tab") rove.send("rove:select", r.t.id); else rove.send("rove:new-tab", r.u); shut(); };
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  const input = root.querySelector("#tq");
  input.addEventListener("input", () => { tq = input.value; tsel = 0; drawTabs(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); tsel = Math.max(0, Math.min(rows.length - 1, tsel + (e.key === "ArrowDown" ? 1 : -1))); drawTabs(); }
    else if (e.key === "Enter") { e.preventDefault(); go(tsel); }
  });
  root.querySelectorAll(".item[data-n]").forEach((el) => el.addEventListener("click", (e) => { if (!e.target.closest("button")) go(Number(el.dataset.n)); }));
  root.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => rove.send("rove:close", Number(b.dataset.close))));
  // a site icon that does not load: the globe, as in the tab strip
  root.querySelectorAll(".tabfind img.fav").forEach((img) => img.addEventListener("error", () => { img.outerHTML = icon("globe"); }));
  root.querySelector(".item.sel")?.scrollIntoView({ block: "nearest" });
  if (keep || !root.contains(document.activeElement) || document.activeElement === document.body) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}

// ---- this site: under the lock in the address bar ---------------------------------------
const CONN = { secure: ["lock", "보안 연결"], plain: ["globe", "암호화되지 않은 연결"], local: ["globe", "이 PC"], file: ["globe", "파일"], other: ["globe", ""] };
let siteSure = false; // "clear data" asked once
let siteMsg = null; // { text, bad }
let siteKey = ""; // what was drawn last (a state that changes nothing draws nothing)
async function drawSite(fromState) {
  const mine = open;
  const s = await rove.ask("rove:site");
  if (open !== mine) return;
  if (!s) { shut(); return; }
  const key = JSON.stringify([s, siteSure, siteMsg]);
  if (fromState && key === siteKey) return;
  siteKey = key;
  const [ic, conn] = CONN[s.conn] || CONN.other;
  const b = s.block || {};
  const perms = s.grants.map((g) => `<div class="perm">${icon(g.allow ? "check" : "close")}<span>${permName(g.key)}</span>
    <select class="rk-select rk-select--row" data-k="${esc(g.key)}" aria-label="${esc(permName(g.key))}">${[["ask", "묻기"], ["allow", "허용"], ["block", "차단"]].map(([v, t]) => `<option value="${v}"${(g.allow ? "allow" : "block") === v ? " selected" : ""}>${t}</option>`).join("")}</select></div>`).join("");
  const ads = !b.ready ? "" : b.on
    ? `<div class="switchrow">${icon("shield")}<span>광고·추적 막기</span><small class="rk-num">${b.siteOn ? `${b.count}개 막음` : "꺼짐"}</small><button class="rk-switch" role="switch" data-block-site aria-checked="${!!b.siteOn}" aria-label="${esc(b.site)}에서 광고·추적 막기"></button></div>`
    : `<div class="switchrow">${icon("shield")}<span>광고·추적 막기</span><small>모든 사이트 꺼짐</small><button class="rk-switch" role="switch" data-block aria-checked="false" aria-label="광고·추적 막기"></button></div>`;
  const web = s.conn !== "file" && s.conn !== "other";
  const awake = !s.awake ? "" : `<div class="switchrow">${icon("window")}<span>창을 내려도 계속</span><button class="rk-switch" role="switch" data-awake aria-checked="${!!s.awake.on}" aria-label="${esc(s.awake.site)}: 창을 내려도 계속"></button></div>`;
  const clear = !web ? "" : siteSure
    ? `<div class="confirm"><span>쿠키와 저장된 데이터를 지울까요?</span><button class="rk-btn rk-btn--small" data-no>그만두기</button><button class="rk-btn rk-btn--small rk-btn--danger-fill" data-yes>지우기</button></div>`
    : `<button class="rk-menu__item" data-clear role="menuitem">${icon("trash")}사이트 데이터 지우기</button>`;
  root.innerHTML = `<div class="scrim"></div><div class="pop site rk-menu${s.conn === "plain" ? " plain" : ""}" role="dialog" aria-label="사이트 정보">
    <header>${icon(ic)}<div class="w"><b>${esc(s.host)}</b>${conn ? `<small class="${s.conn === "plain" ? "alarm" : ""}">${conn}</small>` : ""}</div></header>
    ${perms ? `<div class="rk-label">권한</div>${perms}` : ""}
    ${ads || awake ? `<hr>${ads}${awake}` : ""}
    <hr>${clear}
    <button class="rk-menu__item" data-all role="menuitem">${icon("lock")}모든 사이트 권한</button>
    ${siteMsg ? `<p class="msg${siteMsg.bad ? " alarm" : ""}" role="status">${esc(siteMsg.text)}</p>` : ""}</div>`;
  const box = root.querySelector(".site");
  box.style.left = `${Math.max(8, Math.min(innerWidth - 328, (open.x || 8) - 8))}px`;
  box.style.top = `${open.y || 84}px`;
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  root.querySelectorAll("select[data-k]").forEach((el) => el.addEventListener("change", () => rove.send("rove:site-set", s.origin, el.dataset.k, el.value)));
  root.querySelector("[data-block-site]")?.addEventListener("click", () => rove.send("rove:block", !b.siteOn, true));
  root.querySelector("[data-block]")?.addEventListener("click", () => rove.send("rove:block", true, false));
  root.querySelector("[data-awake]")?.addEventListener("click", () => rove.send("rove:awake", !s.awake.on));
  root.querySelector("[data-clear]")?.addEventListener("click", () => { siteSure = true; siteMsg = null; drawSite(); });
  root.querySelector("[data-no]")?.addEventListener("click", () => { siteSure = false; drawSite(); });
  root.querySelector("[data-yes]")?.addEventListener("click", async () => {
    siteSure = false;
    const r = await rove.ask("rove:site-clear");
    siteMsg = r?.ok ? { text: `지웠어요 · 쿠키 ${r.cookies}개` } : { text: r?.error || "지우지 못했어요", bad: true };
    drawSite();
  });
  root.querySelector("[data-all]").addEventListener("click", () => rove.send("rove:overlay", { kind: "drawer", panel: "sites" }));
  (root.querySelector("[data-yes]") || root.querySelector("select, .rk-switch, .rk-menu__item"))?.focus();
}

// ---- the screen: a site asks to see it --------------------------------------------------
let shareFrom = "screens"; // which list
let sharePick = null; // { kind, id }
let shareSound = true;
// the picker is drawn again on every click: it comes in once (its first draw),
// and the pictures fade in once (the draw they arrive with)
let shareCame = null; // the id whose picker has come in
let shareWaited = false; // the last draw was still waiting for pictures
function drawShare() {
  const o = open;
  const lists = { screens: o.screens, windows: o.windows, tabs: o.tabs };
  const names = { screens: "화면", windows: "창", tabs: "탭" };
  const kind = { screens: "screen", windows: "window", tabs: "tab" }[shareFrom];
  const enter = shareCame !== o.id ? " enter" : "";
  const arrive = shareWaited && !o.loading ? " arrive" : "";
  shareCame = o.id;
  shareWaited = !!o.loading;
  const picked = (it) => sharePick && sharePick.kind === kind && sharePick.id === it.id;
  const wait = (it) => !it.pic && o.loading && kind !== "tab";
  const face = (it) => it.pic ? `<img alt="" src="${esc(it.pic)}">`
    : kind === "tab" && it.favicon ? `<img class="fav" alt="" src="${esc(it.favicon)}">` : wait(it) ? "" : icon(kind === "tab" ? "globe" : "image");
  const cards = lists[shareFrom].map((it) => `<button class="src" type="button" data-id="${esc(it.id)}" aria-pressed="${picked(it)}">
      <span class="pic${wait(it) ? " wait" : ""}">${face(it)}</span><span class="nm">${esc(it.self ? `이 탭 · ${it.name}` : it.name)}</span>${kind === "tab" && it.host ? `<small>${esc(it.host)}</small>` : ""}</button>`).join("");
  const sound = o.audio && sharePick && sharePick.kind !== "window";
  root.innerHTML = `<div class="scrim dim${enter}"></div><div class="pop share rk-menu${enter}" role="dialog" aria-modal="true" aria-label="화면 공유" aria-busy="${!!o.loading}">
    <header>${icon("image")}<b>${esc(o.host)}</b><small>화면 공유</small></header>
    <div class="from"><div class="rk-tabs" role="tablist">${Object.keys(names).map((k) => `<button class="rk-tab" role="tab" data-from="${k}" aria-selected="${k === shareFrom}">${names[k]} <span class="rk-num">${lists[k].length}</span></button>`).join("")}</div></div>
    <div class="grid${arrive}">${cards || `<div class="rk-empty">${icon("image")}${names[shareFrom]}이 없어요</div>`}</div>
    <footer>${sound ? `<label class="sound"><input class="rk-check" type="checkbox" data-sound${shareSound ? " checked" : ""}>소리도 공유</label>` : ""}
      <button class="rk-btn" type="button" data-cancel>취소</button><button class="rk-btn rk-btn--primary" type="button" data-go${sharePick ? "" : " disabled"}>공유</button></footer></div>`;
  const go = () => { if (sharePick) rove.send("rove:share", o.id, sharePick, shareSound); };
  root.querySelector("[data-cancel]").addEventListener("click", shut);
  root.querySelector("[data-go]").addEventListener("click", go);
  root.querySelector("[data-sound]")?.addEventListener("change", (e) => { shareSound = e.target.checked; });
  root.querySelectorAll("[data-from]").forEach((b) => b.addEventListener("click", () => { shareFrom = b.dataset.from; draw(); }));
  root.querySelectorAll(".src").forEach((b) => {
    const id = kind === "tab" ? Number(b.dataset.id) : b.dataset.id;
    b.addEventListener("click", () => { sharePick = { kind, id }; draw(); root.querySelector(`.src[data-id="${CSS.escape(String(id))}"]`)?.focus(); });
    b.addEventListener("dblclick", () => { sharePick = { kind, id }; go(); });
  });
  if (!root.contains(document.activeElement) || document.activeElement === document.body) root.querySelector('.src[aria-pressed="true"], .src, [data-cancel]')?.focus();
}
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && open?.kind === "share" && sharePick && !e.target.closest?.("button, input")) rove.send("rove:share", open.id, sharePick, shareSound); });

// ---- RobinPass ------------------------------------------------------------------------
let pq = ""; // search
let pmsg = ""; // the last answer: { text, bad }
let ppeek; // what the page has typed (undefined: not looked yet)
let psecond = null; // the second step: { providers, kdf, email, password }
let pbusy = false;
let pagain = null; // a login that asks for the master password again: { id, what: "fill" | "password" | "totp", name }
let pview = "logins"; // or "codes": the 인증 코드 list (kept between openings)
let ptick = 0; // the codes' one-second clock while that list is shown
const say = (text, bad = false) => { pmsg = { text, bad }; };
// 123 456, 1234 5678, 123 4567; Steam's five letters stay one group
const groups = (code) => {
  if (code.length <= 5) return [code];
  if (code.length === 8) return [code.slice(0, 4), code.slice(4)];
  const out = [];
  for (let i = 0; i < code.length; i += 3) out.push(code.slice(i, i + 3));
  if (out.length > 1 && out.at(-1).length === 1) out[out.length - 2] += out.pop();
  return out;
};
const otp = (c) => c.bad ? "—" : groups(c.code).map((g) => `<span>${esc(g)}</span>`).join("");
// the arc: what is left of the period, run down through the coming second (the CSS moves it over that second)
const arc = (c) => String(100 - (Math.max(0, c.left - 1) / c.period) * 100);
const codeLabel = (c) => `${c.name || c.host}${c.username ? `, ${c.username}` : ""}, 코드 ${c.code.split("").join(" ")}, 누르면 복사`;
function stopTick() { clearTimeout(ptick); ptick = 0; }
function startTick() {
  stopTick();
  const go = async () => {
    if (open?.kind !== "pass" || pview !== "codes" || state.pass?.state !== "open") { ptick = 0; return; }
    const list = await rove.ask("rove:pass-codes", pq);
    if (open?.kind !== "pass" || pview !== "codes") { ptick = 0; return; }
    const rows = [...root.querySelectorAll(".code[data-id]")];
    // a different list (synced, locked): draw it again; otherwise only the numbers move
    if (!list || list.length !== rows.length || list.some((c, i) => c.id !== rows[i].dataset.id)) { draw(); return; }
    list.forEach((c, i) => {
      const r = rows[i];
      if (c.bad) return; // a broken key has no code and no ring
      const v = r.querySelector(".v");
      if (v.dataset.code !== c.code) { v.dataset.code = c.code; v.innerHTML = otp(c); v.classList.remove("fresh"); void v.offsetWidth; v.classList.add("fresh"); r.setAttribute("aria-label", codeLabel(c)); }
      r.querySelector(".secs").textContent = c.left;
      r.querySelector(".arc").setAttribute("stroke-dashoffset", arc(c)); // an attribute: the CSP takes no inline style
      r.classList.toggle("soon", c.left <= 7);
    });
    ptick = setTimeout(go, 1000 - (Date.now() % 1000) + 5);
  };
  ptick = setTimeout(go, 1000 - (Date.now() % 1000) + 5);
}
const fetchedLabel = (p) => (p.synced ? `금고 다시 받기 · ${new Date(p.synced).toTimeString().slice(0, 5)}에 받음` : "금고 다시 받기");
async function drawPass() {
  const mine = open;
  const p = state.pass || { state: "none" };
  let items = [];
  let codes = [];
  if (p.state === "open" && pview === "codes") codes = (await rove.ask("rove:pass-codes", pq)) || [];
  else if (p.state === "open") {
    items = (await rove.ask("rove:pass-items", pq)) || [];
    if (ppeek === undefined) ppeek = (await rove.ask("rove:pass-peek")) || null;
  }
  stopTick();
  if (open !== mine) return;
  const keepFocus = document.activeElement?.id;
  const keepCode = document.activeElement?.closest?.(".code")?.dataset.id;
  const msg = pmsg ? `<p class="msg${pmsg.bad ? " alarm" : ""}" role="status">${esc(pmsg.text)}</p>` : "";
  const busy = pbusy ? " disabled" : "";
  let body = "";
  const tabs = `<div class="views"><div class="rk-tabs" role="tablist" aria-label="보기">${[["logins", "로그인"], ["codes", "인증 코드"]].map(([k, n]) => `<button class="rk-tab" role="tab" data-view="${k}" aria-selected="${k === pview}">${n}</button>`).join("")}</div></div>`;
  if (p.state === "none" && psecond) {
    body = `<form class="pf" data-form="second">
      <input class="rk-input rk-num" id="pc" inputmode="numeric" autocomplete="one-time-code" placeholder="${psecond.providers.includes(0) ? "인증 앱 코드" : "메일로 받은 코드"}" spellcheck="false">
      <div class="row"><button class="rk-btn rk-btn--small" type="button" data-back>뒤로</button><button class="rk-btn rk-btn--primary"${busy}>${pbusy ? "확인 중" : "확인"}</button></div>${msg}</form>`;
  } else if (p.state === "none") {
    body = `<form class="pf" data-form="login">
      <input class="rk-input" id="pe" type="email" placeholder="메일" spellcheck="false" autocomplete="off" value="${esc(p.email || "")}">
      <input class="rk-input" id="pp" type="password" placeholder="마스터 비밀번호" autocomplete="off">
      <div class="row"><button class="rk-btn rk-btn--primary"${busy}>${pbusy ? "로그인 중" : "로그인"}</button></div>${msg}</form>`;
  } else if (p.state === "locked") {
    body = `<form class="pf" data-form="unlock">
      <input class="rk-input" id="pp" type="password" placeholder="마스터 비밀번호" autocomplete="off">
      <div class="row"><button class="rk-btn rk-btn--small" type="button" data-logout>로그아웃</button><button class="rk-btn rk-btn--primary"${busy}>${pbusy ? "여는 중" : "잠금 해제"}</button></div>${msg}</form>`;
  } else if (pagain) {
    body = `<form class="pf" data-form="again">
      <p class="who">${icon("lock")}<b>${esc(pagain.name)}</b></p>
      <input class="rk-input" id="pp" type="password" placeholder="마스터 비밀번호" autocomplete="off" aria-label="${esc(pagain.name)} · 마스터 비밀번호">
      <div class="row"><button class="rk-btn rk-btn--small" type="button" data-back>취소</button><button class="rk-btn rk-btn--primary"${busy}>${pbusy ? "확인 중" : pagain.what === "fill" ? "채우기" : "복사"}</button></div>${msg}</form>`;
  } else if (pview === "codes") {
    const row = (c) => `<button type="button" class="code${c.left <= 7 && !c.bad ? " soon" : ""}" data-id="${esc(c.id)}"${c.bad ? " disabled" : ` aria-label="${esc(codeLabel(c))}"`}><div class="w"><b>${esc(c.name || c.host)}</b><small>${esc(c.bad ? "인증 키가 올바르지 않아요" : c.username || c.host)}</small></div>
      <span class="v" data-code="${esc(c.code)}">${c.ask ? icon("lock") : otp(c)}</span>
      ${c.bad ? "" : `<span class="left" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle class="arc" cx="12" cy="12" r="10" pathLength="100" stroke-dashoffset="${arc(c)}"/></svg><i class="secs">${c.left}</i></span>`}</button>`;
    body = `${tabs}<div class="search"><input class="rk-input" id="pq" type="search" placeholder="인증 코드 찾기" spellcheck="false" value="${esc(pq)}"></div>
      <div class="list codes">${codes.length ? codes.map(row).join("") : `<div class="rk-empty">${icon(pq ? "search" : "clock")}${pq ? "찾은 항목이 없어요" : "인증 키가 있는 로그인이 없어요"}</div>`}</div>
      ${msg}`;
  } else {
    const here = items.filter((i) => i.here);
    const other = items.filter((i) => !i.here);
    const row = (i) => `<div class="item${i.here ? " fill" : ""}" data-id="${esc(i.id)}"${i.here ? ' role="button" tabindex="0"' : ""}>${icon(i.here ? "key" : "globe")}<div class="w"><b>${esc(i.name || i.host)}</b><small>${esc(i.username || i.host)}</small></div>
      <button class="btn" data-c="username" aria-label="아이디 복사" title="아이디 복사">${icon("user")}</button>
      <button class="btn" data-c="password" aria-label="비밀번호 복사" title="비밀번호 복사">${icon("copy")}</button>
      ${i.totp ? `<button class="btn" data-c="totp" aria-label="인증 코드 복사" title="인증 코드 복사">${icon("clock")}</button>` : ""}</div>`;
    body = `${tabs}<div class="search"><input class="rk-input" id="pq" type="search" placeholder="금고에서 찾기" spellcheck="false" value="${esc(pq)}"></div>
      <div class="list">${here.length ? `<div class="rk-label">이 사이트</div>${here.map(row).join("")}` : pq ? "" : `<div class="rk-empty">${icon("key")}이 사이트의 로그인이 없어요</div>`}
      ${other.length ? `<div class="rk-label">금고</div>${other.map(row).join("")}` : pq && !here.length ? `<div class="rk-empty">${icon("search")}찾은 항목이 없어요</div>` : ""}</div>
      ${ppeek && !ppeek.known ? `<div class="save">${icon("plus")}<div class="w"><b>${esc(ppeek.host)}</b><small>${esc(ppeek.username || "아이디 없음")}</small></div><button class="rk-btn rk-btn--small rk-btn--primary" data-save${busy}>금고에 저장</button></div>` : ""}
      ${msg}`;
  }
  root.innerHTML = `<div class="scrim"></div><div class="pop pass rk-menu" role="dialog" aria-label="RobinPass">
    <header>${icon("key")}<b>RobinPass</b><small>${esc(p.email || p.server || "")}</small>${p.state === "open" ? `<button class="btn" data-sync aria-label="${fetchedLabel(p)}" title="${fetchedLabel(p)}"${busy}>${icon("refresh")}</button><button class="btn" data-lock aria-label="잠그기" title="잠그기">${icon("lock")}</button>` : ""}</header>
    ${body}</div>`;
  const box = root.querySelector(".pass");
  box.style.left = `${Math.max(8, Math.min(innerWidth - 348, (open.x || innerWidth) - 340))}px`;
  box.style.top = `${open.y || 84}px`;
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  root.querySelector("[data-lock]")?.addEventListener("click", () => rove.send("rove:pass-lock"));
  root.querySelector("[data-sync]")?.addEventListener("click", async () => {
    if (pbusy) return;
    pbusy = true; pmsg = ""; draw();
    let r;
    try { r = await rove.ask("rove:pass-sync"); } finally { pbusy = false; }
    if (r?.error) say(r.error, true); else say(`금고를 다시 받았어요 · ${r?.count ?? 0}개`);
    draw();
  });
  root.querySelector("[data-logout]")?.addEventListener("click", () => rove.send("rove:pass-logout"));
  root.querySelector("[data-back]")?.addEventListener("click", () => { psecond = null; pagain = null; pmsg = ""; draw(); });
  const form = root.querySelector("form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (pbusy) return;
    const kind = form.dataset.form;
    // what was typed, before the busy form is drawn over it
    const pw = root.querySelector("#pp")?.value || "";
    const email = root.querySelector("#pe")?.value || "";
    const code = root.querySelector("#pc")?.value || "";
    let r;
    pbusy = true; pmsg = ""; draw();
    try {
      if (kind === "login") {
        r = await rove.ask("rove:pass-login", email, pw);
        if (r?.second) { psecond = { providers: r.second, kdf: r.kdf, email, password: pw }; r = null; }
      } else if (kind === "second") {
        r = await rove.ask("rove:pass-login", psecond.email, psecond.password, { code, provider: psecond.providers.includes(0) ? 0 : psecond.providers[0], kdf: psecond.kdf });
        if (r?.ok) psecond = null;
      } else if (kind === "again") {
        const { id, what } = pagain;
        r = what === "fill" ? await rove.ask("rove:pass-fill", id, pw) : await rove.ask("rove:pass-copy", id, what, pw);
        if (!r?.error) { pagain = null; if (what !== "fill") r = { said: what === "password" ? "비밀번호를 복사했어요 · 30초 뒤 지워요" : `인증 코드를 복사했어요 · ${r?.left}초 남음` }; }
      } else r = await rove.ask("rove:pass-unlock", pw);
    } finally { pbusy = false; }
    if (r?.error) say(r.error, true);
    else if (r?.said) say(r.said);
    else if (r?.offline) say("금고를 받지 못했어요", true);
    draw();
  });
  const q = root.querySelector("#pq");
  q?.addEventListener("input", () => { pq = q.value; draw(); });
  root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    if (pview === b.dataset.view) return;
    pview = b.dataset.view; pq = ""; pmsg = ""; draw();
  }));
  // the main side said this login wants the master password first: its form comes up
  const again = (r, id, what, el) => { if (!r?.reprompt) return false; pagain = { id, what, name: el.querySelector("b")?.textContent || "" }; pmsg = ""; draw(); return true; };
  root.querySelectorAll(".code[data-id]").forEach((b) => b.addEventListener("click", async () => {
    const r = await rove.ask("rove:pass-copy", b.dataset.id, "totp");
    if (again(r, b.dataset.id, "totp", b)) return;
    say(r?.error || "인증 코드를 복사했어요 · 30초 뒤 지워요", !!r?.error);
    draw();
  }));
  if (p.state === "open" && pview === "codes") startTick();
  root.querySelectorAll(".item[data-id]").forEach((el) => {
    const fill = async () => { const r = await rove.ask("rove:pass-fill", el.dataset.id); if (again(r, el.dataset.id, "fill", el)) return; if (r?.error) { say(r.error, true); draw(); } };
    if (el.classList.contains("fill")) {
      el.addEventListener("click", (e) => { if (!e.target.closest("button")) fill(); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === el) fill(); });
    }
    el.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", async () => {
      const r = await rove.ask("rove:pass-copy", el.dataset.id, b.dataset.c);
      if (again(r, el.dataset.id, b.dataset.c, el)) return;
      say(r?.error || { username: "아이디를 복사했어요", password: "비밀번호를 복사했어요 · 30초 뒤 지워요", totp: `인증 코드를 복사했어요 · ${r?.left}초 남음` }[b.dataset.c], !!r?.error);
      draw();
    }));
  });
  root.querySelector("[data-save]")?.addEventListener("click", async () => {
    pbusy = true; draw();
    const r = await rove.ask("rove:pass-save");
    pbusy = false;
    if (r?.ok) { ppeek = null; say("금고에 저장했어요"); } else say(r?.error || "저장하지 못했어요", true);
    draw();
  });
  const back = keepCode && [...root.querySelectorAll(".code[data-id]")].find((b) => b.dataset.id === keepCode);
  if (back) { back.focus(); return; }
  // an element without an id (a button just pressed, the page body) gives "": "#" alone is no selector and threw
  const focus = (keepFocus && root.querySelector(`#${keepFocus}`)) || root.querySelector("#pc, #pe:placeholder-shown, #pp, #pq");
  if (focus) { focus.focus(); if (focus.id === "pq") focus.setSelectionRange(focus.value.length, focus.value.length); }
}

// ---- suggestions --------------------------------------------------------------------
function drawSuggest() {
  const kinds = { search: "search", go: "globe", bookmark: "star", history: "clock", tab: "tabs" };
  root.innerHTML = `<div class="pop suggest" role="listbox">${open.items.map((it, i) => `<a role="option" data-i="${i}" class="${i === open.sel ? "sel" : ""}" aria-selected="${i === open.sel}">${it.kind === "history" || it.kind === "tab" ? site(it, kinds[it.kind]) : icon(kinds[it.kind])}<b>${esc(it.title)}</b>${it.kind === "bookmark" || it.kind === "history" ? `<small>${esc(host(it.url))}</small>` : it.kind === "search" ? "<small>검색</small>" : it.kind === "tab" ? "<small>탭으로 전환</small>" : ""}</a>`).join("")}</div>`;
  root.querySelectorAll("a").forEach((a) => a.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const it = open.items[Number(a.dataset.i)];
    rove.send("rove:open", it.url, e.button === 1 || e.ctrlKey, it.tab);
  }));
}

// a download's mark by what the file is, as Chrome shows the file's kind (the kit's own marks, one colour)
const KINDS = [["image", /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|ico|tiff?)$/i], ["film", /\.(mp4|mkv|mov|webm|avi|m4v|wmv)$/i],
  ["music", /\.(mp3|wav|flac|m4a|ogg|opus|aac|wma)$/i], ["read", /\.(pdf|txt|md|docx?|hwpx?|odt|rtf|epub|pptx?|xlsx?|csv)$/i],
  ["window", /\.(exe|msi|msix|appx|bat|cmd)$/i]];
const kindOf = (name) => (KINDS.find(([, re]) => re.test(name || "")) || ["download"])[0];

// ---- the menu -----------------------------------------------------------------------
// each row's shortcut on its right, as in Chrome (the keys are main.cjs keyAction's)
const shortcut = (k) => `<small class="key" aria-hidden="true">${k}</small>`;
// the version line, with what the last update check found; "업데이트 확인" checks now, as Brave's About page does
// (u null: not an installed Rove, nothing to check)
function versionLine(version, u) {
  const status = !u || u.ready ? "" : u.downloading ? " · 새 버전 받는 중" : u.checking ? " · 확인하는 중"
    : u.error ? ` · <span class="alarm" title="${esc(u.error)}">확인하지 못했어요</span>` : u.checked ? " · 최신 버전이에요" : "";
  // stays while checking (aria-disabled, a second press does nothing), so a keyboard press keeps its place
  const button = u && !u.ready && !u.downloading ? `<button class="rk-btn rk-btn--small rk-btn--icon check" data-do="update-check" aria-label="업데이트 확인" title="업데이트 확인"${u.checking ? ' aria-disabled="true"' : ""}>${icon("refresh")}</button>` : "";
  return `<div class="fact"><span>Rove ${esc(version || "")}${status}</span>${button}</div>`;
}
function drawMenu() {
  // a redraw (each state change, e.g. a download's progress) keeps the keyboard where it was
  const was = root.querySelector(".pop.menu")?.contains(document.activeElement) && document.activeElement.dataset.do;
  root.innerHTML = `<div class="scrim"></div><div class="pop menu rk-menu" role="menu">
    <button class="rk-menu__item" data-do="new" role="menuitem">${icon("plus")}새 탭${shortcut("Ctrl+T")}</button>
    <button class="rk-menu__item" data-do="window" role="menuitem">${icon("window")}새 창${shortcut("Ctrl+N")}</button>
    <button class="rk-menu__item" data-do="private" role="menuitem">${icon("private")}새 비공개 창${shortcut("Ctrl+Shift+N")}</button>
    <hr>
    <button class="rk-menu__item" data-do="history" role="menuitem">${icon("clock")}방문 기록${shortcut("Ctrl+H")}</button>
    <button class="rk-menu__item" data-do="bookmarks" role="menuitem">${icon("star")}즐겨찾기${shortcut("Ctrl+Shift+O")}</button>
    <button class="rk-menu__item" data-do="downloads" role="menuitem">${icon("download")}내려받기${shortcut("Ctrl+J")}</button>
    <button class="rk-menu__item" data-do="sites" role="menuitem">${icon("lock")}사이트 권한</button>
    ${state.private ? "" : `<button class="rk-menu__item" data-do="extensions" role="menuitem">${icon("spark")}확장 프로그램</button>`}
    <button class="rk-menu__item" data-do="tabs" role="menuitem">${icon("tabs")}탭 찾기${shortcut("Ctrl+Shift+A")}</button>
    <div class="switchrow">${icon("moon")}<span>안 쓰는 탭 재우기</span><button class="rk-switch" role="switch" data-sleep aria-checked="${!!state.sleep}" aria-label="안 쓰는 탭 재우기"></button></div>
    <div class="switchrow">${icon("sidebar")}<span>세로 탭</span><button class="rk-switch" role="switch" data-vertical aria-checked="${!!state.vertical}" aria-label="세로 탭"></button></div>
    ${state.vertical ? `<div class="switchrow site"><span>아이콘으로 접으면 숨기기</span><button class="rk-switch" role="switch" data-hide-folded aria-checked="${!!state.hideFolded}" aria-label="아이콘으로 접으면 숨기기"></button></div>` : ""}
    <button class="rk-menu__item" data-do="engine" role="menuitem">${icon("search")}검색엔진<small class="now">${esc(state.engine || "")}</small></button>
    ${state.private ? "" : `<div class="switchrow">${icon("refresh")}<span>지난 탭으로 시작</span><button class="rk-switch" role="switch" data-start aria-checked="${!!state.startLast}" aria-label="지난 탭으로 시작"></button></div>`}
    <hr>
    ${state.block?.ready ? `<div class="switchrow">${icon("shield")}<span>광고·추적 막기</span><button class="rk-switch" role="switch" data-block aria-checked="${!!state.block.on}" aria-label="광고·추적 막기"></button></div>
    ${state.block.on && state.block.site ? `<div class="switchrow site"><span>${esc(state.block.site)}</span><small class="rk-num">${state.block.siteOn ? `${state.block.count}개 막음` : "꺼짐"}</small><button class="rk-switch" role="switch" data-block-site aria-checked="${!!state.block.siteOn}" aria-label="${esc(state.block.site)}에서 막기"></button></div>` : ""}` : ""}
    ${state.cookies ? `<div class="switchrow">${icon("user")}<span>다른 사이트 쿠키 막기</span><button class="rk-switch" role="switch" data-cookies aria-checked="${!!state.cookies.on}" aria-label="다른 사이트 쿠키 막기"${state.cookies.later ? ' aria-describedby="cookies-later"' : ""}></button></div>
    ${state.cookies.later ? `<div class="switchrow site" id="cookies-later"><span>Rove를 다시 켜면 바뀌어요</span></div>` : ""}` : ""}
    <hr>
    <div class="zoomrow"><span>확대</span>
      <button class="btn" data-do="zoom-out" aria-label="작게" title="작게">${icon("minus")}</button>
      <span class="rk-num">${state.zoom || 100}%</span>
      <button class="btn" data-do="zoom-in" aria-label="크게" title="크게">${icon("plus")}</button>
      <button class="btn full" data-do="full" aria-label="전체 화면 (F11)" title="전체 화면 (F11)">${icon("target")}</button>
    </div>
    <button class="rk-menu__item" data-do="find" role="menuitem">${icon("search")}페이지에서 찾기${shortcut("Ctrl+F")}</button>
    <button class="rk-menu__item" data-do="print" role="menuitem">${icon("print")}인쇄${shortcut("Ctrl+P")}</button>
    <button class="rk-menu__item" data-do="save-page" role="menuitem">${icon("download")}페이지 저장${shortcut("Ctrl+S")}</button>
    <button class="rk-menu__item" data-do="devtools" role="menuitem">${icon("terminal")}개발자 도구${shortcut("F12")}</button>
    <button class="rk-menu__item" data-do="keys" role="menuitem">${icon("keys")}단축키</button>
    <hr>
    ${state.isDefault ? "" : `<button class="rk-menu__item" data-do="default" role="menuitem">${icon("globe")}기본 브라우저로</button>`}
    ${state.update?.ready ? `<button class="rk-menu__item" data-do="relaunch" role="menuitem">${icon("refresh")}다시 켜서 새 버전으로</button>` : ""}
    ${versionLine(state.version, state.update)}
  </div>`;
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  root.querySelector("[data-block]")?.addEventListener("click", () => rove.send("rove:block", !state.block.on, false));
  root.querySelector("[data-block-site]")?.addEventListener("click", () => rove.send("rove:block", !state.block.siteOn, true));
  root.querySelector("[data-sleep]").addEventListener("click", () => rove.send("rove:sleep", !state.sleep));
  root.querySelector("[data-cookies]")?.addEventListener("click", () => rove.send("rove:cookies", !state.cookies.on));
  root.querySelector("[data-vertical]").addEventListener("click", () => rove.send("rove:vertical", !state.vertical));
  root.querySelector("[data-hide-folded]")?.addEventListener("click", () => rove.send("rove:hide-folded", !state.hideFolded));
  root.querySelector("[data-start]")?.addEventListener("click", () => rove.send("rove:start", !state.startLast));
  root.querySelectorAll("[data-do]").forEach((b) => b.addEventListener("click", () => {
    const d = b.dataset.do;
    if (d === "new") rove.send("rove:new-tab");
    else if (d === "engine") rove.send("rove:engine-menu");
    else if (d === "window") rove.send("rove:new-window");
    else if (d === "private") rove.send("rove:new-private");
    else if (d === "history" || d === "bookmarks" || d === "downloads" || d === "sites" || d === "extensions") rove.send("rove:overlay", { kind: "drawer", panel: d });
    else if (d === "default") rove.send("rove:default");
    else if (d === "tabs") rove.send("rove:overlay", { kind: "tabs" });
    else if (d === "keys") rove.send("rove:overlay", { kind: "keys" });
    else if (d === "zoom-in") rove.send("rove:zoom", 1);
    else if (d === "zoom-out") rove.send("rove:zoom", -1);
    else if (d === "find") { shut(); rove.send("rove:find-open", true); }
    else if (d === "print") rove.send("rove:print");
    else if (d === "save-page") rove.send("rove:save-page");
    else if (d === "full") { shut(); rove.send("rove:full"); }
    else if (d === "devtools") { shut(); rove.send("rove:devtools"); }
    else if (d === "relaunch") rove.send("rove:relaunch");
    else if (d === "update-check") rove.send("rove:update-check");
  }));
  (was && root.querySelector(`.pop.menu [data-do="${was}"]`) || root.querySelector(".rk-menu__item"))?.focus();
}

// ---- the shortcuts (≡ 단축키): every one is main.cjs keyAction's (test/shortcut-list.mjs checks) ----
const KEYS = [
  ["탭과 창", [["새 탭", "Ctrl+T"], ["닫은 탭 다시 열기", "Ctrl+Shift+T"], ["탭 닫기", "Ctrl+W"], ["다음 탭", "Ctrl+Tab"], ["이전 탭", "Ctrl+Shift+Tab"],
    ["1~8번째 탭", "Ctrl+1"], ["마지막 탭", "Ctrl+9"], ["탭 찾기", "Ctrl+Shift+A"], ["새 창", "Ctrl+N"], ["새 비공개 창", "Ctrl+Shift+N"], ["창 닫기", "Ctrl+Shift+W"]]],
  ["페이지", [["뒤로", "Alt+←"], ["앞으로", "Alt+→"], ["새로 고침", "F5"], ["캐시 없이 새로 고침", "Ctrl+Shift+R"], ["홈", "Alt+Home"],
    ["페이지에서 찾기", "Ctrl+F"], ["다음 찾기", "F3"], ["읽기 모드", "F9"], ["확대", "Ctrl+="], ["축소", "Ctrl+-"], ["원래 크기", "Ctrl+0"],
    ["인쇄", "Ctrl+P"], ["페이지 저장", "Ctrl+S"], ["소스 보기", "Ctrl+U"], ["전체 화면", "F11"], ["개발자 도구", "F12"]]],
  ["주소창과 목록", [["주소창", "Ctrl+L"], ["검색", "Ctrl+K"], ["즐겨찾기에 넣기", "Ctrl+D"], ["모든 탭 즐겨찾기", "Ctrl+Shift+D"], ["방문 기록", "Ctrl+H"], ["내려받기", "Ctrl+J"],
    ["즐겨찾기", "Ctrl+Shift+O"], ["파일 열기", "Ctrl+O"], ["RobinPass", "Ctrl+Shift+L"], ["메뉴", "Alt+F"]]],
];
function drawKeys() {
  root.innerHTML = `<div class="scrim"></div><div class="pop menu keys rk-menu" role="dialog" aria-label="단축키" tabindex="-1">
    ${KEYS.map(([group, rows]) => `<div class="rk-label">${group}</div>${rows.map(([name, k]) => `<div class="keyrow"><span>${name}</span><kbd class="key">${k === "Ctrl+1" ? "Ctrl+1~8" : k}</kbd></div>`).join("")}`).join("")}
  </div>`;
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  root.querySelector(".pop").focus();
}

// ---- drawers --------------------------------------------------------------------------
const NAMES = { history: "방문 기록", bookmarks: "즐겨찾기", downloads: "내려받기", sites: "사이트 권한", extensions: "확장 프로그램" };
const STORE = "https://chromewebstore.google.com/";
const TAB = { ...NAMES, extensions: "확장" }; // the drawer's tab row (five do not fit in full)
const WHAT = { camera: "카메라", microphone: "마이크", location: "위치", notifications: "알림", clipboard: "클립보드 읽기", midi: "MIDI 기기", popups: "팝업" };
const permName = (k) => WHAT[k] || (k.startsWith("external:") ? `${k.slice(9)}: 링크 열기` : k); // a kept permission, or another program's link kept
function day(at) {
  const d = new Date(at);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const n = Math.round((today - that) / 86400e3);
  if (n === 0) return "오늘";
  if (n === 1) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
const time = (at) => new Date(at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
function size(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

let importing = null; // the browsers to bring bookmarks from (true: to ask, null: not asked)
let dropping = null; // the extension whose 지우기 was pressed once (pressed again: gone)
let extMsg = null; // what 폴더에서 불러오기 did: "<name> 불러왔어요" or why not
let importMsg = null;
let renaming = null, renameText = "", renameNew = false; // the bookmark being renamed, what is typed, just opened (select all)
// a history or bookmark row: the site's own icon once a normal window has shown it, else ours
const site = (x, fallback) => (x.icon ? `<img class="fav" alt="" src="${esc(x.icon)}">` : icon(fallback));
async function drawDrawer() {
  const mine = open;
  let list = [];
  if (panel === "bookmarks" && importing === true) importing = (await rove.ask("rove:import-from")) || [];
  if (panel === "history") list = (await rove.ask("rove:history", query)) || [];
  if (panel === "bookmarks") list = (await rove.ask("rove:bookmarks", query)) || [];
  if (panel === "downloads") list = (state.downloads || []).slice().reverse();
  if (panel === "sites") list = (await rove.ask("rove:sites")) || [];
  if (panel === "extensions") list = (await rove.ask("rove:extensions")) || [];
  if (open !== mine) return;
  const keepFocus = document.activeElement?.id === "q", keepName = document.activeElement?.id === "bname";
  let body = "";
  if (panel === "history") {
    let last = "";
    for (const h of list) {
      const d = day(h.at);
      if (d !== last) { body += `<div class="rk-label">${d}</div>`; last = d; }
      body += `<div class="item" data-url="${esc(h.url)}" role="button" tabindex="0">${site(h, "globe")}<div class="w"><b title="${esc(h.title || h.url)}">${esc(h.title || h.url)}</b><small>${esc(host(h.url))} · ${time(h.at)}</small></div><button class="btn hover" data-forget="${esc(h.url)}" aria-label="기록에서 지우기" title="기록에서 지우기">${icon("close")}</button></div>`;
    }
  } else if (panel === "sites") {
    for (const s of list) {
      if (s.ads === false && !s.origin) { body += `<div class="item">${icon("shield")}<div class="w"><b>${esc(s.host)}</b><small>광고·추적 막기 꺼짐</small></div><button class="btn hover" data-unallow="${esc(s.host)}" aria-label="다시 막기" title="다시 막기">${icon("close")}</button></div>`; continue; }
      const said = [...Object.keys(WHAT), ...Object.keys(s).filter((k) => k.startsWith("external:"))].filter((k) => typeof s[k] === "boolean").map((k) => `${permName(k)} ${s[k] ? "허용" : "차단"}`);
      if (said.length) body += `<div class="item wrap">${icon("lock")}<div class="w"><b title="${esc(s.host)}">${esc(s.host)}</b><small>${said.join(" · ")}</small></div><button class="btn hover" data-site="${esc(s.origin)}" aria-label="잊기" title="잊기">${icon("close")}</button></div>`;
    }
  } else if (panel === "extensions") {
    for (const x of list) {
      const pic = x.icon ? `<img class="ext" src="${esc(x.icon)}" alt="">` : icon("spark");
      const sure = dropping === x.id;
      const turn = `<button class="rk-switch" role="switch" data-ext-on="${esc(x.id)}" aria-checked="${!!x.on}" aria-label="${esc(x.name)} 켜기" title="${x.on ? "끄기 (지우지 않음)" : "켜기"}"></button>`;
      body += `<div class="item${x.on ? "" : " off"}">${pic}<div class="w"><b title="${esc(x.name)}">${esc(x.name)}</b><small class="rk-num">${x.on ? "" : "꺼짐 · "}${x.folder ? "폴더 · " : ""}${esc(x.version)}</small></div>${x.options ? `<button class="btn hover" data-ext-options="${esc(x.id)}" aria-label="옵션" title="옵션">${icon("sliders")}</button>` : ""}${sure ? `<button class="rk-btn rk-btn--small rk-btn--danger-fill" data-ext-drop="${esc(x.id)}">지우기</button>` : `<button class="btn hover" data-ext-drop="${esc(x.id)}" aria-label="지우기" title="${x.folder ? "Rove에서 지우기 (폴더는 그대로)" : "지우기"}">${icon("trash")}</button>`}${turn}</div>`;
    }
  } else if (panel === "bookmarks" && importing) {
    body += `<div class="rk-label">가져오기</div>`;
    for (const s of importing) body += `<div class="item">${icon("download")}<div class="w"><b>${esc(s.name)}</b><small class="rk-num">${s.count}개${s.fresh < s.count ? ` · 새로 ${s.fresh}개` : ""}</small></div><button class="rk-btn rk-btn--small${s.fresh ? " rk-btn--primary" : ""}" data-import="${esc(s.id)}"${s.fresh ? "" : " disabled"}>가져오기</button></div>`;
    if (!importing.length) body += `<div class="rk-empty">${icon("star")}가져올 브라우저가 없어요</div>`;
  } else if (panel === "bookmarks") {
    for (const b of list) body += b.url === renaming
      ? `<div class="item">${site(b, "star")}<div class="w"><input class="rk-input" id="bname" maxlength="300" aria-label="즐겨찾기 이름" spellcheck="false" value="${esc(renameText)}"><small>${esc(host(b.url))}</small></div><button class="btn" data-rename-ok aria-label="저장" title="저장">${icon("check")}</button></div>`
      : `<div class="item" data-url="${esc(b.url)}" role="button" tabindex="0">${site(b, "star")}<div class="w"><b title="${esc(b.title || b.url)}">${esc(b.title || b.url)}</b><small>${esc(host(b.url))}</small></div><button class="btn hover" data-rename="${esc(b.url)}" aria-label="이름 고치기" title="이름 고치기">${icon("edit")}</button><button class="btn hover" data-unstar="${esc(b.url)}" aria-label="즐겨찾기에서 빼기" title="즐겨찾기에서 빼기">${icon("close")}</button></div>`;
  } else {
    for (const d of list) {
      const going = d.state === "progressing";
      const line = d.asking ? "받을지 기다리는 중" : going ? `${size(d.received)}${d.total ? ` / ${size(d.total)}` : ""}`
        : d.gone ? "삭제됨"
        : d.state === "completed" ? `${size(d.received)} · ${time(d.at)}`
        : d.state === "cancelled" ? "취소함"
        : d.resumable ? `멈춤 · ${size(d.received)}${d.total ? ` / ${size(d.total)}` : ""}` : "멈춤";
      const meter = going && d.total && !d.asking ? `<span class="rk-meter"><i data-p="${Math.round((d.received / d.total) * 100)}"></i></span>` : "";
      // only a finished one has a file to show; a cancelled, stopped or deleted one says so by its mark
      // and can come down again (Chrome's 다시 시도)
      const done = d.state === "completed" && !d.gone;
      const mark = going || done ? kindOf(d.name) : d.state === "cancelled" || d.gone ? "close" : "alarm";
      const againLabel = d.resumable ? "이어 받기" : "다시 받기";
      const again = /^https?:/i.test(d.url || "") ? `<button class="btn hover" data-retry="${d.id}" aria-label="${againLabel}" title="${againLabel}">${icon("refresh")}</button>` : "";
      // one waiting for a yes: the same 버리기·받기 as the ask bar, which this drawer covers
      const act = typeof d.asking === "number" ? `<button class="rk-btn rk-btn--small rk-btn--danger" data-keep="${d.asking}" data-yes="0">버리기</button><button class="rk-btn rk-btn--small rk-btn--primary" data-keep="${d.asking}" data-yes="1">받기</button>`
        : going ? `<button class="btn" data-cancel="${d.id}" aria-label="취소" title="취소">${icon("close")}</button>`
        : done ? `<button class="btn hover" data-show="${d.id}" aria-label="폴더에서 보기" title="폴더에서 보기">${icon("out")}</button>` : again;
      // only a finished file opens; the others are not buttons (their 다시 받기 is)
      body += `<div class="item" data-dl="${d.id}"${done ? ' role="button" tabindex="0"' : ""}>${icon(mark)}<div class="w"><b title="${esc(d.name)}">${esc(d.name)}</b><small class="${d.state === "interrupted" ? "alarm" : ""}">${line}</small>${meter}</div>${act}</div>`;
    }
  }
  // a search that found nothing says so (as tab find and RobinPass do), not that there is nothing at all
  const searched = query && (panel === "history" || panel === "bookmarks");
  const empty = searched ? (panel === "history" ? "찾은 기록이 없어요" : "찾은 즐겨찾기가 없어요") : { history: "기록이 없어요", bookmarks: "즐겨찾기가 없어요", downloads: "내려받은 파일이 없어요", sites: "정해 둔 사이트가 없어요", extensions: "확장 프로그램이 없어요" }[panel];
  const foot = panel === "history" && list.length && !query
    ? (sure ? `<footer><span>기록을 전부 지울까요?</span><button class="rk-btn rk-btn--small" data-no>그만두기</button><button class="rk-btn rk-btn--small rk-btn--danger-fill" data-yes>지우기</button></footer>`
      : `<footer><button class="rk-btn rk-btn--small rk-btn--danger" data-all>기록 모두 지우기</button></footer>`)
    // where new files go, and 바꾸기 to pick another folder (Brave's and Chrome's 위치 · 변경)
    : panel === "downloads" ? `<footer><span class="where" title="${esc(state.downloadDir || "")}">받는 곳 <b>${esc((state.downloadDir || "").split(/[\\/]/).filter(Boolean).pop() || "")}</b></span><button class="rk-btn rk-btn--small" data-dir>바꾸기</button><label class="everytime">매번 묻기<button class="rk-switch" role="switch" data-ask-where aria-checked="${!!state.askWhere}" aria-label="받을 때마다 저장할 곳 묻기"></button></label>${list.some((d) => d.state !== "progressing") ? `<button class="rk-btn rk-btn--small" data-clear>목록 비우기</button>` : ""}</footer>`
    : panel === "extensions" ? `<footer>${extMsg ? `<span role="status">${esc(extMsg)}</span>` : ""}<button class="rk-btn rk-btn--small" data-ext-folder>폴더에서 불러오기</button><button class="rk-btn rk-btn--small" data-store>Chrome 웹 스토어</button></footer>`
    : panel === "bookmarks" ? `<footer>${importMsg ? `<span role="status">${esc(importMsg)}</span>` : ""}${importing ? `<button class="rk-btn rk-btn--small" data-import-done>돌아가기</button>` : `<button class="rk-btn rk-btn--small" data-import-ask>다른 브라우저에서 가져오기</button>`}</footer>` : "";
  root.innerHTML = `<div class="scrim"></div><aside class="pop drawer" aria-label="${NAMES[panel]}">
    <header><div class="rk-tabs" role="tablist">${Object.keys(NAMES).map((k) => `<button class="rk-tab" role="tab" data-panel="${k}" aria-selected="${k === panel}"${TAB[k] !== NAMES[k] ? ` aria-label="${NAMES[k]}"` : ""}>${TAB[k]}</button>`).join("")}</div>
      <button class="btn" data-shut aria-label="닫기" title="닫기">${icon("close")}</button></header>
    ${panel === "history" || (panel === "bookmarks" && !importing) ? `<div class="search"><input class="rk-input" id="q" type="search" placeholder="${panel === "history" ? "기록" : "즐겨찾기"} 찾기" value="${esc(query)}" spellcheck="false"></div>` : ""}
    <div class="list">${body || `<div class="rk-empty">${icon(searched ? "search" : panel === "downloads" ? "download" : panel === "bookmarks" ? "star" : panel === "sites" ? "lock" : panel === "extensions" ? "spark" : "clock")}${empty}</div>`}</div>
    ${foot}</aside>`;
  root.querySelectorAll("[data-p]").forEach((i) => { i.style.width = i.dataset.p + "%"; });
  root.querySelector(".scrim").addEventListener("mousedown", shut);
  root.querySelector("[data-shut]").addEventListener("click", shut);
  root.querySelectorAll("[data-panel]").forEach((b) => b.addEventListener("click", () => { panel = b.dataset.panel; query = ""; sure = false; importing = null; importMsg = null; dropping = null; renaming = null; draw(); }));
  const q = root.querySelector("#q");
  if (q) {
    q.addEventListener("input", () => { query = q.value; draw(); });
    if (keepFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  root.querySelectorAll(".item[data-url]").forEach((el) => el.addEventListener("mouseup", (e) => {
    if (e.target.closest("button")) return;
    if (e.button === 0 || e.button === 1) rove.send("rove:open", el.dataset.url, e.button === 1 || e.ctrlKey);
  }));
  root.querySelectorAll(".item[data-dl]").forEach((el) => el.addEventListener("click", (e) => { if (!e.target.closest("button")) rove.send("rove:download-open", Number(el.dataset.dl)); }));
  // Enter or Space on a focused row does what a click does (Ctrl+Enter: a new tab, as Ctrl+click)
  root.querySelectorAll(".item[tabindex='0']").forEach((el) => el.addEventListener("keydown", (e) => {
    if (e.target !== el || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    if (el.dataset.url) rove.send("rove:open", el.dataset.url, e.ctrlKey);
    else el.click();
  }));
  root.querySelectorAll("[data-forget]").forEach((b) => b.addEventListener("click", () => { rove.send("rove:forget", b.dataset.forget); draw(); }));
  root.querySelectorAll("[data-rename]").forEach((b) => b.addEventListener("click", () => { renaming = b.dataset.rename; renameText = list.find((x) => x.url === renaming)?.title || ""; renameNew = true; draw(); }));
  const name = root.querySelector("#bname");
  if (name) {
    const done = () => { const url = renaming; renaming = null; rove.send("rove:bookmark-rename", url, name.value); setTimeout(draw, 50); };
    name.addEventListener("input", () => { renameText = name.value; });
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); done(); }
      if (e.key === "Escape") { e.stopPropagation(); renaming = null; draw(); }
    });
    root.querySelector("[data-rename-ok]").addEventListener("click", done);
    if (renameNew) { name.focus(); name.select(); } else if (keepName) { name.focus(); name.setSelectionRange(name.value.length, name.value.length); }
    renameNew = false;
  }
  root.querySelectorAll("[data-unstar]").forEach((b) => b.addEventListener("click", () => { rove.send("rove:unstar", b.dataset.unstar); setTimeout(draw, 50); }));
  root.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => rove.send("rove:download-cancel", Number(b.dataset.cancel))));
  root.querySelectorAll("[data-keep]").forEach((b) => b.addEventListener("click", () => rove.send("rove:answer", Number(b.dataset.keep), b.dataset.yes === "1")));
  root.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => rove.send("rove:download-show", Number(b.dataset.show))));
  root.querySelectorAll("[data-retry]").forEach((b) => b.addEventListener("click", () => rove.send("rove:download-retry", Number(b.dataset.retry))));
  root.querySelectorAll("[data-site]").forEach((b) => b.addEventListener("click", () => { rove.send("rove:forget-site", b.dataset.site); setTimeout(draw, 50); }));
  root.querySelectorAll("[data-unallow]").forEach((b) => b.addEventListener("click", () => { rove.send("rove:unallow", b.dataset.unallow); setTimeout(draw, 50); }));
  root.querySelector("[data-all]")?.addEventListener("click", () => { sure = true; draw(); });
  root.querySelector("[data-no]")?.addEventListener("click", () => { sure = false; draw(); });
  root.querySelector("[data-yes]")?.addEventListener("click", () => { sure = false; rove.send("rove:forget-all"); setTimeout(draw, 50); });
  root.querySelector("[data-clear]")?.addEventListener("click", () => rove.send("rove:downloads-clear"));
  root.querySelector("[data-dir]")?.addEventListener("click", () => rove.send("rove:download-dir"));
  root.querySelector("[data-ask-where]")?.addEventListener("click", () => rove.send("rove:ask-where", !state.askWhere));
  root.querySelector("[data-store]")?.addEventListener("click", () => rove.send("rove:open", STORE, true));
  root.querySelector("[data-ext-folder]")?.addEventListener("click", async (ev) => {
    ev.currentTarget.disabled = true;
    const r = await rove.ask("rove:extension-folder");
    extMsg = r ? (r.ok ? `${r.name} 불러왔어요` : r.error) : null;
    await draw();
    root.querySelector("[data-ext-folder]")?.focus();
  });
  root.querySelectorAll("[data-ext-options]").forEach((b) => b.addEventListener("click", () => rove.send("rove:extension-options", b.dataset.extOptions)));
  root.querySelectorAll("[data-ext-on]").forEach((b) => b.addEventListener("click", async () => {
    const id = b.dataset.extOn;
    b.disabled = true;
    await rove.ask("rove:extension-on", id, b.getAttribute("aria-checked") !== "true");
    await draw();
    root.querySelector(`[data-ext-on="${CSS.escape(id)}"]`)?.focus();
  }));
  root.querySelectorAll("[data-ext-drop]").forEach((b) => b.addEventListener("click", async () => {
    if (dropping !== b.dataset.extDrop) { dropping = b.dataset.extDrop; draw(); return; }
    dropping = null;
    b.disabled = true;
    await rove.ask("rove:extension-remove", b.dataset.extDrop);
    draw();
  }));
  root.querySelector("[data-import-ask]")?.addEventListener("click", () => { importing = true; importMsg = null; draw(); });
  root.querySelector("[data-import-done]")?.addEventListener("click", () => { importing = null; importMsg = null; draw(); });
  root.querySelectorAll("[data-import]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    const r = await rove.ask("rove:import", b.dataset.import);
    importMsg = r?.ok ? `${r.name}에서 ${r.added}개 가져왔어요` : r?.error || "가져오지 못했어요";
    importing = r?.ok ? null : true;
    draw();
  }));
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
