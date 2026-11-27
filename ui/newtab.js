// Rove's new tab. What it shows comes from main (newtab.json: the search engine's name, the
// sites gone to most, config.cjs's links); what is typed goes to main (go?q=), which turns it into an address or a
// search the same way the address bar does.
const $ = (id) => document.getElementById(id);

$("find").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("q").value.trim();
  if (q) location.href = "go?q=" + encodeURIComponent(q);
});

function tile(s) {
  const a = document.createElement("a");
  a.href = s.url;
  a.title = s.url;
  const t = document.createElement("div");
  t.className = "tile";
  const globe = () => { t.innerHTML = '<svg class="rk-ico" aria-hidden="true"><use href="icons.svg#rk-i-globe"/></svg>'; };
  if (s.icon) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = s.icon;
    img.onerror = globe;
    t.append(img);
  } else globe();
  const name = document.createElement("span");
  name.textContent = s.host;
  a.append(t, name);
  return a;
}

function link([name, url, ic]) {
  const a = document.createElement("a");
  a.href = url;
  a.innerHTML = `<svg class="rk-ico" aria-hidden="true"><use href="icons.svg#rk-i-${/^[a-z]+$/.test(ic) ? ic : "globe"}"/></svg>`;
  a.append(name);
  return a;
}

fetch("newtab.json").then((r) => r.json()).then((d) => {
  $("q").placeholder = `${d.engine} 검색 또는 주소`;
  $("q").setAttribute("aria-label", $("q").placeholder);
  if (d.sites?.length) { $("sites").append(...d.sites.map(tile)); $("sites").hidden = false; }
  if (d.links?.length) { $("links").append(...d.links.map(link)); $("links").hidden = false; }
}).catch(() => {});
