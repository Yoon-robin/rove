// The top of the window: tabs, the toolbar and the find row. All it knows
// comes from the main process ("rove:state"); all it does is ask it.
const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg class="rk-ico"><use href="icons.svg#rk-i-${name}"/></svg>`;
let state = { tabs: [], active: null, downloads: [] };
let editing = false; // the address bar is being typed in: state does not overwrite it
let sel = 0; // the chosen suggestion
let suggestShown = false;

// ---- tabs ----------------------------------------------------------------------
const tabsEl = $("tabs");
function tabEl(t) {
  let el = tabsEl.querySelector(`[data-id="${t.id}"]`);
  if (!el) {
    el = document.createElement("div");
    el.className = "tab";
    el.dataset.id = t.id;
    el.setAttribute("role", "tab");
    el.innerHTML = `<span class="ic"></span><span class="t"></span><button class="btn snd" type="button" tabindex="-1" hidden></button><button class="btn x" type="button" aria-label="탭 닫기" tabindex="-1">${icon("close")}</button><i class="gl"></i>`;
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); rove.send("rove:close", t.id); return; }
      if (e.button === 0 && !e.target.closest(".x, .snd")) { rove.send("rove:select", t.id); dragFrom(el, e); }
    });
    el.querySelector(".x").addEventListener("click", (e) => { e.stopPropagation(); rove.send("rove:close", t.id); });
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); rove.send("rove:tab-menu", Number(el.dataset.id)); });
    el.querySelector(".snd").addEventListener("click", (e) => { e.stopPropagation(); rove.send("rove:mute", Number(el.dataset.id)); });
  }
  const snd = el.querySelector(".snd");
  snd.hidden = !t.sound;
  if (snd.dataset.k !== (t.sound || "")) {
    snd.dataset.k = t.sound || "";
    snd.innerHTML = t.sound ? icon(t.sound === "muted" ? "mute" : "sound") : "";
    const say = t.sound === "muted" ? "탭 소리 켜기" : "탭 소리 끄기";
    snd.setAttribute("aria-label", say);
    snd.title = say;
  }
  el.classList.toggle("muted", t.sound === "muted");
  el.classList.toggle("shown", !!t.shown);
  el.classList.toggle("asleep", !!t.asleep);
  el.classList.toggle("pinned", !!t.pinned);
  el.classList.toggle("paired", (state.paired || []).includes(t.id));
  const ic = el.querySelector(".ic");
  const want = t.loading ? "spin" : t.favicon ? "img:" + t.favicon : "globe";
  if (ic.dataset.k !== want) {
    ic.dataset.k = want;
    if (t.loading) ic.innerHTML = '<span class="spin"></span>';
    else if (t.favicon) {
      ic.innerHTML = "";
      const img = new Image(16, 16);
      img.alt = "";
      img.src = t.favicon;
      img.onerror = () => { ic.dataset.k = "globe"; ic.innerHTML = icon("globe"); };
      ic.append(img);
    } else ic.innerHTML = icon("globe");
  }
  el.querySelector(".t").textContent = t.title || readable(t.url || "");
  const g = (state.groups || []).find((x) => x.id === t.group);
  el.title = (t.title || readable(t.url || "")) + (t.shown ? ` · ${t.shown}에 보이는 중` : "") + (t.asleep ? " · 자는 중" : "") + (t.pinned ? " · 고정" : "") + (g ? ` · ${g.name || COLORS[g.color]}` : "");
  el.setAttribute("aria-selected", String(t.id === state.active));
  return el;
}
// a tab group's label: a click folds and unfolds it, a right click names and colours it
const COLORS = { grey: "회색", blue: "파랑", apricot: "살구", white: "흰색" };
function groupEl(g, count) {
  let el = tabsEl.querySelector(`.grp[data-g="${g.id}"]`);
  if (!el) {
    el = document.createElement("button");
    el.type = "button";
    el.className = "grp";
    el.dataset.g = g.id;
    el.innerHTML = `<i class="dot"></i><span class="n"></span><small class="c rk-num"></small>${icon("down")}`;
    el.addEventListener("click", () => rove.send("rove:group-fold", Number(el.dataset.g)));
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); editGroup(Number(el.dataset.g)); });
  }
  const name = g.name || COLORS[g.color] || "묶음";
  el.dataset.color = g.color;
  el.classList.toggle("named", !!g.name);
  el.classList.toggle("folded", !!g.collapsed);
  el.querySelector(".n").textContent = state.vertical ? name : g.name;
  el.querySelector(".c").textContent = g.collapsed ? String(count) : "";
  el.setAttribute("aria-expanded", String(!g.collapsed));
  el.setAttribute("aria-label", `묶음 ${name} · 탭 ${count}개`);
  el.title = `${name} · 탭 ${count}개`;
  return el;
}
let editWanted = null; // a group just made: its name is asked for once its label is drawn
function editGroup(id) {
  const el = tabsEl.querySelector(`.grp[data-g="${id}"]`);
  if (!el) { editWanted = id; return; }
  editWanted = null;
  const r = el.getBoundingClientRect();
  rove.send("rove:overlay", state.vertical ? { kind: "group", id, x: Math.round(r.right + 6), y: Math.round(r.top) } : { kind: "group", id, x: Math.round(r.left), y: Math.round(r.bottom + 6) });
}
rove.on("rove:edit-group", (id) => editGroup(id));

// dragging a tab along the strip (down it, when the tabs are at the left):
// past the middle of another, it takes that place. A folded group's tabs are
// where its label is.
let dragging = null; // { id, p, on }
function dragFrom(el, e) {
  const v = !!state.vertical;
  const at = (ev) => (v ? ev.clientY : ev.clientX);
  const mid = (x) => { const r = x.getBoundingClientRect(); return v ? r.top + r.height / 2 : r.left + r.width / 2; };
  dragging = { id: Number(el.dataset.id), p: at(e), on: false };
  const move = (ev) => {
    if (!dragging) return;
    if (!dragging.on && Math.abs(at(ev) - dragging.p) < 5) return;
    dragging.on = true;
    const me = tabsEl.querySelector(`.tab[data-id="${dragging.id}"]`);
    if (!me) return;
    me.classList.add("dragging");
    const others = state.tabs.filter((t) => t.id !== dragging.id).map((t) => {
      const te = tabsEl.querySelector(`.tab[data-id="${t.id}"]`);
      const ref = te && !te.classList.contains("folded") ? te : tabsEl.querySelector(`.grp[data-g="${t.group}"]`) || te;
      return ref ? mid(ref) : -Infinity;
    });
    const to = others.filter((m) => m < at(ev)).length;
    if (to !== state.tabs.findIndex((t) => t.id === dragging.id)) rove.send("rove:move", dragging.id, to);
  };
  const up = (ev) => {
    tabsEl.querySelector(".dragging")?.classList.remove("dragging");
    const d = dragging;
    dragging = null;
    if (d?.on && away(ev)) rove.send("rove:tear", d.id, ev.screenX, ev.screenY);
    removeEventListener("mousemove", move);
    removeEventListener("mouseup", up);
  };
  addEventListener("mousemove", move);
  addEventListener("mouseup", up);
}
// let go well away from the tabs (or out of the window): the tab goes to a window of its own
function away(ev) {
  if (ev.clientX < 0 || ev.clientY < 0 || ev.clientX >= innerWidth || ev.clientY >= innerHeight) return true;
  return state.vertical ? ev.clientX > (state.frame?.left || 240) + 60 : ev.clientY > 84 + 40;
}
let shownActive = null; // the tab the strip last scrolled to
// across: bring the current tab into the strip (it may sit past the edge once tabs are at their 44px least)
function showChosen() {
  const sel = !state.vertical && tabsEl.querySelector('.tab[aria-selected="true"]');
  if (!sel) return;
  const r = sel.getBoundingClientRect(), s = tabsEl.getBoundingClientRect();
  tabsEl.scrollLeft += r.left < s.left ? r.left - s.left : r.right > s.right ? r.right - s.right : 0;
}
function drawTabs() {
  const v = !!state.vertical;
  // a private window says so, at the left of the top row
  const priv = $("priv");
  priv.hidden = !state.private;
  document.body.classList.toggle("private", !!state.private);
  const spot = v ? document.querySelector(".tools") : document.querySelector(".strip");
  if (priv.parentElement !== spot) { if (v) spot.prepend(priv); else document.querySelector(".mark").after(priv); }
  document.body.classList.toggle("vertical", v);
  $("side").hidden = !v;
  $("side").classList.toggle("narrow", v && !!state.narrow);
  const fold = $("sideFold");
  const say = state.narrow ? "탭 이름 보이기" : "탭을 아이콘만";
  fold.setAttribute("aria-label", say);
  fold.title = say;
  // the same list, in the strip or at the left
  const home = v ? $("sidelist") : $("tabs-home");
  if (tabsEl.parentElement !== home) home.append(tabsEl);
  const groups = new Map((state.groups || []).map((g) => [g.id, g]));
  const els = [];
  let last = null;
  state.tabs.forEach((t, i) => {
    const g = groups.get(t.group) || null;
    if (g && t.group !== last) els.push(groupEl(g, state.tabs.filter((x) => x.group === g.id).length));
    last = g ? t.group : null;
    const el = tabEl(t);
    el.classList.toggle("ing", !!g);
    el.classList.toggle("folded", !!g?.collapsed);
    el.classList.toggle("gend", !!g && state.tabs[i + 1]?.group !== t.group);
    if (g) el.dataset.color = g.color; else delete el.dataset.color;
    els.push(el);
  });
  els.forEach((el, i) => { if (tabsEl.children[i] !== el) tabsEl.insertBefore(el, tabsEl.children[i] || null); });
  while (tabsEl.children.length > els.length) tabsEl.lastChild.remove();
  if (editWanted) editGroup(editWanted);
  requestAnimationFrame(() => {
    const first = els.find((el) => el.classList.contains("tab") && !el.classList.contains("pinned") && !el.classList.contains("folded"));
    const narrow = !v && first && first.getBoundingClientRect().width < 96;
    els.forEach((el) => el.classList.toggle("narrow", !!narrow));
    if (v) tabsEl.querySelector('.tab[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    // when it changes, not on every redraw: a strip scrolled by hand stays
    if (state.active !== shownActive) showChosen();
    shownActive = state.active;
  });
}
// and when the strip narrows (the window made smaller)
let stripWidth = 0;
new ResizeObserver(() => { if (tabsEl.clientWidth < stripWidth) showChosen(); stripWidth = tabsEl.clientWidth; }).observe(tabsEl);
// a plain wheel over the strip moves it sideways
tabsEl.addEventListener("wheel", (e) => { if (state.vertical || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; tabsEl.scrollLeft += e.deltaY; e.preventDefault(); }, { passive: false });
$("sideNew").addEventListener("click", () => rove.send("rove:new-tab"));
$("sideFold").addEventListener("click", () => rove.send("rove:narrow", !state.narrow));

// ---- the toolbar --------------------------------------------------------------
const url = $("url");
// %EC%84%9C%EC%9A%B8 reads as 서울; what would change the address when typed
// back (/ ? # & = + % and spaces), controls and invisible or bidi marks stay escaped.
const RESERVED = /[%/?#&=+;:@$,[\]\\^`{|}<>"' ]/;
const HIDDEN = [[0, 0x1f], [0x7f, 0xa0], [0xad, 0xad], [0x61c, 0x61c], [0x115f, 0x1160], [0x180e, 0x180e], [0x2000, 0x200f], [0x2028, 0x202f], [0x205f, 0x206f], [0x3000, 0x3000], [0x3164, 0x3164], [0xfe00, 0xfe0f], [0xfeff, 0xfeff], [0xffa0, 0xffa0], [0xfff0, 0xffff], [0xe0000, 0xe0fff]];
const bytes = new TextEncoder();
const keep = (c) => RESERVED.test(c) || HIDDEN.some(([a, b]) => c.codePointAt(0) >= a && c.codePointAt(0) <= b);
function readable(u) {
  if (!/^(https?|file):\/\//i.test(u)) return u;
  const at = u.indexOf("/", u.indexOf("//") + 2);
  if (at < 0) return u;
  return u.slice(0, at) + u.slice(at).replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
    let text;
    try { text = decodeURIComponent(run); } catch { return run; } // not UTF-8: leave it
    return [...text].map((c) => (keep(c) ? [...bytes.encode(c)].map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("") : c)).join("");
  });
}
const shown = (u) => readable((u || "").replace(/^https:\/\/home\.yoonrobin\.xyz\/?$/, ""));
// copying the whole, untouched address gives the real one
for (const kind of ["copy", "cut"]) url.addEventListener(kind, (e) => {
  const t = state.tabs.find((x) => x.id === state.active);
  if (!t?.url || url.value !== shown(t.url) || url.value === t.url) return;
  if (url.selectionStart !== 0 || url.selectionEnd !== url.value.length) return;
  e.preventDefault();
  e.clipboardData.setData("text/plain", t.url);
  if (kind === "cut") url.value = "";
});
function drawTools() {
  const t = state.tabs.find((x) => x.id === state.active);
  // extensions: the normal windows only; their buttons show what they say for the tab in front
  $("actions").hidden = !!state.private;
  if (state.page != null && $("actions").getAttribute("tab") !== String(state.page)) $("actions").setAttribute("tab", String(state.page));
  $("back").disabled = !state.canBack;
  $("forward").disabled = !state.canForward;
  const loading = !!t?.loading;
  $("reload").innerHTML = icon(loading ? "close" : "refresh");
  $("reload").setAttribute("aria-label", loading ? "멈추기" : "새로 고침");
  $("reload").title = loading ? "멈추기" : "새로 고침";
  if (document.activeElement !== url) editing = false;
  if (!editing) url.value = shown(t?.url);
  const u = t?.url || "";
  const secure = /^https:/.test(u);
  const plain = /^http:/.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u);
  $("lead").innerHTML = icon(secure ? "lock" : "globe");
  $("lead").classList.toggle("plain", plain);
  $("lead").disabled = !/^(https?|file):/.test(u);
  $("star").classList.toggle("on", !!state.starred);
  $("star").setAttribute("aria-pressed", String(!!state.starred));
  $("star").hidden = !/^https?:/.test(t?.url || "");
  $("read").hidden = !(t?.readable || t?.reader);
  $("read").classList.toggle("on", !!t?.reader);
  $("read").setAttribute("aria-pressed", String(!!t?.reader));
  const p = state.pass;
  $("pass").classList.toggle("on", !!p?.count);
  $("pass").title = p?.count ? `RobinPass · ${p.count}` : "RobinPass (Ctrl+Shift+L)";
  const dl = state.downloads || [];
  const going = dl.filter((d) => d.state === "progressing");
  $("downloads").hidden = !dl.length;
  $("downloads").classList.toggle("going", going.length > 0);
  const total = going.reduce((a, d) => a + (d.total || 0), 0);
  const got = going.reduce((a, d) => a + (d.received || 0), 0);
  $("downloads").style.setProperty("--p", total ? `${Math.round((got / total) * 100)}%` : "30%");
  const ready = state.update?.ready;
  $("newver").hidden = !ready;
  if (ready) $("newver").title = `Rove ${ready}`;
  $("find").hidden = !state.findOpen;
  drawAsk();
  drawSplit();
  $("gone").hidden = !t?.crashed;
  const f = state.frame || { top: 84, left: 0 };
  $("gone").style.top = `${f.top}px`;
  $("gone").style.left = `${f.left}px`;
  document.body.style.setProperty("--side", `${f.full ? 0 : f.left}px`);
  document.body.classList.toggle("full", !!state.full);
}

// ---- two tabs side by side: which is in front (a line over it), and the gap between ----
const GAP = 4;
function drawSplit() {
  const s = state.split;
  const el = $("split");
  el.hidden = !s || !!state.full;
  if (el.hidden) return;
  const f = state.frame || { top: 84, left: 0 };
  const left = Math.round((innerWidth - f.left - GAP) * s.ratio);
  el.style.top = `${f.top}px`;
  el.style.left = `${f.left}px`;
  el.style.setProperty("--left", `${left}px`);
  el.classList.toggle("right", state.active === s.b);
}
$("gap").addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  // the pages would take the pointer: the overlay holds it while dragging
  rove.send("rove:overlay", { kind: "splitdrag" });
});
$("read").addEventListener("click", () => rove.send("rove:read"));

// ---- the ask bar: a site's question, or a program coming down ----------------------
const WHAT = { camera: "카메라", microphone: "마이크", location: "위치", notifications: "알림", clipboard: "클립보드 읽기", midi: "MIDI 기기" };
const RUNS = { program: "실행 파일", script: "스크립트", disk: "디스크 이미지" };
const once = (a) => (a?.kind === "site" && a.what[0] === "external") || a?.kind === "extension";
let askShown = null;
function drawAsk() {
  const a = state.ask;
  $("ask").hidden = !a;
  if (!a) { askShown = null; return; }
  const key = JSON.stringify(a);
  if (askShown === key) return;
  askShown = key;
  if (a.kind === "extension") {
    // a blocker (declarativeNetRequest) installs but would block nothing: said before it is added
    $("ask").classList.toggle("warn", !!a.wontBlock);
    $("askIcon").innerHTML = `<use href="icons.svg#rk-i-${a.wontBlock ? "alarm" : "plus"}"/>`;
    $("askWho").textContent = a.name;
    // the warning first: a narrow window cuts the end of the line
    $("askWhat").textContent = ["확장 프로그램", a.wontBlock && "광고·요청 막기는 Rove에서 안 돌아요(광고는 Rove가 막아요)", a.allSites && "모든 사이트의 내용을 읽고 바꿀 수 있음"].filter(Boolean).join(" · ");
    $("askNo").textContent = "취소";
    $("askNo").classList.remove("rk-btn--danger");
    $("askYes").textContent = "추가";
    $("askShut").hidden = true;
    return;
  }
  const download = a.kind === "download";
  $("ask").classList.toggle("warn", download);
  $("askIcon").innerHTML = `<use href="icons.svg#rk-i-${download ? "alarm" : once(a) ? "out" : "lock"}"/>`;
  $("askWho").textContent = download ? a.name : a.host;
  $("askWhat").textContent = download ? [a.host, RUNS[a.what[0]]].filter(Boolean).join(" · ")
    : once(a) ? `${a.scheme}: 링크를 다른 앱으로` : a.what.map((k) => WHAT[k] || k).join(" · ");
  $("askNo").textContent = download ? "버리기" : once(a) ? "취소" : "차단";
  $("askNo").classList.toggle("rk-btn--danger", download);
  $("askYes").textContent = download ? "받기" : once(a) ? "열기" : "허용";
  $("askShut").hidden = download || once(a);
}
$("askYes").addEventListener("click", () => state.ask && rove.send("rove:answer", state.ask.id, true, !once(state.ask)));
$("askNo").addEventListener("click", () => state.ask && rove.send("rove:answer", state.ask.id, false, !once(state.ask)));
$("askShut").addEventListener("click", () => state.ask && rove.send("rove:answer", state.ask.id, false, false));

rove.on("rove:state", (s) => { state = s; drawTabs(); drawTools(); });
rove.ask("rove:state").then((s) => { if (s) { state = s; drawTabs(); drawTools(); } });

$("new").addEventListener("click", () => rove.send("rove:new-tab"));
$("back").addEventListener("click", () => rove.send("rove:back"));
$("forward").addEventListener("click", () => rove.send("rove:forward"));
$("reload").addEventListener("click", (e) => {
  const t = state.tabs.find((x) => x.id === state.active);
  if (t?.loading) rove.send("rove:stop"); else rove.send("rove:reload", e.shiftKey || e.ctrlKey);
});
$("home").addEventListener("click", () => rove.send("rove:home"));
$("star").addEventListener("click", () => rove.send("rove:star"));
// keyed: opened from the keyboard (Enter or Space on the button: a click with no detail, or the
// shortcut), the overlay is there at once (docs/brand.md V5.1)
const keyed = (e) => e === true || e?.detail === 0;
function openPass(e) { const r = $("pass").getBoundingClientRect(); rove.send("rove:overlay", { kind: "pass", keyed: keyed(e), x: Math.round(r.right), y: Math.round(r.bottom + 6) }); }
$("pass").addEventListener("click", openPass);
rove.on("rove:pass-open", openPass);
$("lead").addEventListener("click", (e) => { const r = $("lead").getBoundingClientRect(); rove.send("rove:overlay", { kind: "site", keyed: keyed(e), x: Math.round(r.left), y: Math.round(r.bottom + 10) }); });
$("menu").addEventListener("click", (e) => rove.send("rove:overlay", { kind: "menu", keyed: keyed(e) }));
$("downloads").addEventListener("click", (e) => rove.send("rove:overlay", { kind: "drawer", panel: "downloads", keyed: keyed(e) }));
$("revive").addEventListener("click", () => rove.send("rove:reload"));
$("newver").addEventListener("click", () => rove.send("rove:relaunch"));

// ---- the address bar ------------------------------------------------------------
let items = [];
function suggest() {
  const r = $("address").getBoundingClientRect();
  sel = 0;
  rove.send("rove:suggest", url.value, { x: r.left, y: r.bottom + 4, width: r.width });
}
url.addEventListener("focus", () => { editing = true; requestAnimationFrame(() => url.select()); });
url.addEventListener("input", () => { editing = true; if (url.value.trim()) suggest(); else close(); });
url.addEventListener("blur", () => { setTimeout(() => { editing = false; close(); drawTools(); }, 150); });
url.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!suggestShown) return;
    e.preventDefault();
    sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
    rove.send("rove:suggest-sel", sel);
  } else if (e.key === "Escape") {
    e.preventDefault();
    if (suggestShown) { close(); return; }
    editing = false;
    drawTools();
    rove.send("rove:focus-page");
  }
});
$("address").addEventListener("submit", (e) => {
  e.preventDefault();
  const pick = suggestShown && items[sel];
  editing = false;
  close();
  if (pick && pick.kind !== "search" && pick.kind !== "go") rove.send("rove:open", pick.url, false);
  else if (url.value.trim()) rove.send("rove:go", url.value);
});
function close() { if (suggestShown) { suggestShown = false; rove.send("rove:overlay", null); } }
rove.on("rove:suggested", (list) => { items = list || []; suggestShown = items.length > 0; });
rove.on("rove:overlay-closed", (kind) => { if (kind === "suggest") suggestShown = false; });
rove.on("rove:focus-address", () => { url.focus(); url.select(); });

// ---- find in page -------------------------------------------------------------------
const findText = $("findText");
rove.on("rove:focus-find", () => { findText.focus(); findText.select(); if (findText.value) rove.send("rove:find", findText.value, true, false); });
findText.addEventListener("input", () => rove.send("rove:find", findText.value, true, false));
findText.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); rove.send("rove:find", findText.value, !e.shiftKey, true); }
  if (e.key === "Escape") { e.preventDefault(); rove.send("rove:find-open", false); rove.send("rove:focus-page"); }
});
$("findNext").addEventListener("click", () => rove.send("rove:find", findText.value, true, true));
$("findPrev").addEventListener("click", () => rove.send("rove:find", findText.value, false, true));
$("findClose").addEventListener("click", () => { rove.send("rove:find-open", false); rove.send("rove:focus-page"); });
rove.on("rove:found", ({ at, of }) => {
  const c = $("findCount");
  c.textContent = findText.value ? `${of ? at : 0}/${of}` : "";
  c.classList.toggle("none", !!findText.value && !of);
});
