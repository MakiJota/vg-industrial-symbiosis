// Core: state, data, filters, routing, formatting, chart and table helpers.
window.RIS = (() => {
  const SCENARIOS = (window.RIS_CONFIG && window.RIS_CONFIG.scenarios) ||
                    ["baseline", "all_sources", "w2rkg_reviewed",
                     "all_sources_no_mining", "no_mining_waste"];
  const DEFAULTS = { scenario: "baseline", regime: "mass", unit: "t", kommun: "", role: "any",
                     exch: "all", nace: "", cn4: "", low: "" };
  const S = Object.assign({ section: "overview", lang: "en" }, DEFAULTS);
  const D = { flows: {} };
  const views = {};
  const order = [];
  let charts = [];

  // ---------- small utilities ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;          // only for our own i18n strings
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false)
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  };
  const rows = obj => {           // {col: [..]} -> [{col: v}]
    if (!obj || Array.isArray(obj)) return obj || [];
    const keys = Object.keys(obj); if (!keys.length) return [];
    const n = obj[keys[0]].length, out = new Array(n);
    for (let i = 0; i < n; i++) { const r = {}; for (const k of keys) r[k] = obj[k][i]; out[i] = r; }
    return out;
  };
  const sum = (arr, f) => arr.reduce((a, r) => a + (+f(r) || 0), 0);
  const groupSum = (arr, keyFn, valFn) => {
    const m = new Map();
    for (const r of arr) { const k = keyFn(r); if (k == null) continue; m.set(k, (m.get(k) || 0) + (+valFn(r) || 0)); }
    return m;
  };
  const cssv = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  // ---------- i18n ----------
  const t = (key, vars) => {
    let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
  const L = pair => pair ? pair[S.lang === "sv" ? 1 : 0] : "";
  const nf = (d = 0) => new Intl.NumberFormat(S.lang === "sv" ? "sv-SE" : "en-GB",
                                              { maximumFractionDigits: d, minimumFractionDigits: d });
  const num = (x, d = 0) => x == null || isNaN(x) ? "–" : nf(d).format(x);
  const fmtT = x => {
    if (x == null || isNaN(x)) return "–";
    const a = Math.abs(x);
    if (a >= 1e6) return num(x / 1e6, 2) + " " + t("u.Mt");
    if (a >= 1e4) return num(x / 1e3, 0) + " " + t("u.kt");
    if (a >= 1e3) return num(x / 1e3, 1) + " " + t("u.kt");
    return num(x, a < 10 ? 1 : 0) + " " + t("u.t");
  };
  const fmtSEK = x => {   // x in SEK
    if (x == null || isNaN(x)) return "–";
    const a = Math.abs(x);
    if (a >= 1e9) return num(x / 1e9, 2) + " " + t("u.bsek");
    if (a >= 1e7) return num(x / 1e6, 0) + " " + t("u.msek");
    if (a >= 1e5) return num(x / 1e6, 1) + " " + t("u.msek");
    return num(x / 1e6, 2) + " " + t("u.msek");
  };
  const pct = (x, d = 1) => x == null || isNaN(x) ? "–" : num(x, d) + " %";
  const fmtM = x => S.unit === "t" ? fmtT(x) : fmtSEK(x);

  // ---------- lookups ----------
  const K = {}, NACE = {}, NACE2 = {}, CN = {}, LOW = {}, CN_NST = {};
  const kName = c => K[c] || c;
  const familyOf = nace => { const f = (NACE[nace] || {}).family || (NACE2[(nace || "").slice(0, 2)] || {}).family;
                             return "ABCDEF".includes(f || "_") ? f : "S"; };
  const naceName = c => {
    if (!c) return "";
    if (c.length <= 2) return (NACE2[c] || {}).en || c;
    const n = NACE[c]; if (!n) return c;
    return (S.lang === "sv" && n.sv) ? n.sv : (n.en || n.sv || c);
  };
  const famName = f => L(GROUPS.family[f]);
  const cnName = c => c && c.length === 2 ? `CN ${c}` : (L(GROUPS.cn[c]) || (CN[c] || {}).short || c);
  const cnFull = c => (CN[c] || {}).name || c;
  const lowName = c => {
    if (!c) return "";
    if (c.length === 2) return L(GROUPS.lowch[c]) || c;
    return LOW[c] || c;
  };
  const lowCode = c => c && c.length === 6 ? `${c.slice(0, 2)} ${c.slice(2, 4)} ${c.slice(4)}` : c;
  const nstName = c => L(GROUPS.nst[c]) || c;

  // ---------- data ----------
  const load = async name => {
    const r = await fetch(`data/${name}`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return name.endsWith(".md") ? r.text() : r.json();
  };
  async function loadBase() {
    const [meta, region, metab, kpis, firms] = await Promise.all(
      ["meta.json", "region.json", "metabolism.json", "kpis.json", "firms.json"].map(load));
    let directory = [];
    try { directory = rows(await load("directory.json")); } catch {}
    D.meta = meta;
    rows(meta.kommuner).forEach(k => { K[k.code] = k.name; });
    D.kommuner = rows(meta.kommuner).sort((a, b) => a.name.localeCompare(b.name, "sv"));
    rows(meta.nace).forEach(n => { NACE[n.nace4] = n; });
    rows(meta.nace2).forEach(n => { NACE2[n.nace2] = n; });
    rows(meta.cn4).forEach(c => { CN[c.cn4] = c; });
    rows(meta.low).forEach(l => { LOW[l.low] = l.low_name; });
    D.scenarioMeta = Object.fromEntries(rows(meta.scenarios).map(s => [s.id, s]));
    D.region = Object.fromEntries(Object.entries(region).map(([k, v]) => [k, rows(v)]));
    D.region.balance_cn4.forEach(r => { CN_NST[r.cn4] = r.nst; });
    D.waste = rows(metab.waste); D.inputs = rows(metab.inputs);
    D.waste.forEach(w => { w.fam = familyOf(w.nace4); });
    D.inputs.forEach(i => { i.fam = familyOf(i.nace4); });
    D.region.workers.forEach(w => { w.fam = familyOf(w.nace4); });
    D.kpis = Object.fromEntries(Object.entries(kpis).map(([k, v]) => [k, rows(v)]));
    D.firms = rows(firms);
    D.directory = directory;
  }
  async function flows(sc = S.scenario) {
    if (!D.flows[sc]) {
      const j = await load(`flows_${sc}.json`);
      const out = { mass: rows(j.flows.mass), value: rows(j.flows.value),
                    regionMass: rows(j.region.mass), regionValue: rows(j.region.value),
                    matches: rows(j.matches) };
      out.byLow = new Map(); out.byCn = new Map();
      for (const m of out.matches) {
        if (!out.byLow.has(m.low)) out.byLow.set(m.low, new Set()); out.byLow.get(m.low).add(m.cn4);
        if (!out.byCn.has(m.cn4)) out.byCn.set(m.cn4, new Set()); out.byCn.get(m.cn4).add(m.low);
      }
      D.flows[sc] = out;
    }
    return D.flows[sc];
  }
  const curFlows = async () => (await flows())[S.regime];
  const excludedFamilies = () => (D.scenarioMeta[S.scenario] || {}).exclude_families || [];

  // ---------- filters ----------
  const pre = (v, sel) => !sel || (v || "").startsWith(sel);
  const roleMatch = (a, b, sel, test) => {
    if (!sel) return true;
    if (S.role === "give") return test(a, sel);
    if (S.role === "take") return test(b, sel);
    return test(a, sel) || test(b, sel);
  };
  const flowPass = (f, skip = {}) =>
    (skip.kommun || roleMatch(f.fk, f.tk, S.kommun, (x, s) => x === s)) &&
    (skip.nace || roleMatch(f.fn, f.tn, S.nace, pre)) &&
    (skip.cn4 || pre(f.cn4, S.cn4)) && (skip.low || pre(f.low, S.low)) &&
    (skip.exch || S.exch === "all" || f.st === S.exch);
  // compatible-code sets for cross filtering waste <-> products
  const compat = (fl, kind, sel) => {
    if (!sel) return null;
    const out = new Set();
    const src = kind === "low" ? fl.byCn : fl.byLow;          // cn4 -> lows, or low -> cn4s
    for (const [code, set] of src) if (code.startsWith(sel)) set.forEach(x => out.add(x));
    return out;
  };
  const wastePass = (w, fl, skip = {}) => {
    if (excludedFamilies().includes(w.fam)) return false;
    if (!skip.kommun && S.kommun && w.kommun !== S.kommun) return false;
    if (!skip.nace && !pre(w.nace4, S.nace)) return false;
    if (!skip.low && !pre(w.low, S.low)) return false;
    if (!skip.cn4 && S.cn4) { const c = fl._lowsForCn || (fl._lowsForCn = compat(fl, "low", S.cn4)); if (!c.has(w.low)) return false; }
    return true;
  };
  const inputPass = (i, fl, skip = {}) => {
    if (!skip.kommun && S.kommun && i.kommun !== S.kommun) return false;
    if (!skip.nace && !pre(i.nace4, S.nace)) return false;
    if (!skip.cn4 && !pre(i.cn4, S.cn4)) return false;
    if (!skip.low && S.low) { const c = fl._cnsForLow || (fl._cnsForLow = compat(fl, "cn4", S.low)); if (!c.has(i.cn4)) return false; }
    return true;
  };
  const basicPass = (r, skip = {}) =>
    (skip.kommun || !S.kommun || r.kommun === S.kommun) && (skip.nace || pre(r.nace4, S.nace)) &&
    (skip.cn4 || !r.cn4 || pre(r.cn4, S.cn4));
  const measure = f => S.unit === "t" ? f.t : f.sek;

  function set(patch, opts = {}) {
    Object.assign(S, patch);
    for (const sc of Object.keys(D.flows)) { delete D.flows[sc]._lowsForCn; delete D.flows[sc]._cnsForLow; }
    writeHash();
    renderChrome();
    if (!opts.noRender) render();
  }
  const toggle = (key, val) => set({ [key]: S[key] === val ? "" : val });

  // ---------- routing ----------
  function writeHash() {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(DEFAULTS)) if (S[k] !== v) q.set(k, S[k]);
    const hash = `#/${S.section}${q.toString() ? "?" + q : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  function readHash() {
    const m = location.hash.match(/^#\/([\w-]+)(?:\?(.*))?$/);
    if (!m) return;
    if (views[m[1]]) S.section = m[1];
    const q = new URLSearchParams(m[2] || "");
    for (const k of Object.keys(DEFAULTS)) if (q.has(k)) S[k] = q.get(k);
    if (["en", "sv"].includes(q.get("lang"))) S.lang = q.get("lang");   // shareable language, e.g. #/overview?lang=sv
    if (!SCENARIOS.includes(S.scenario)) S.scenario = DEFAULTS.scenario;
  }
  const go = section => { S.section = section; writeHash(); renderChrome(); render(); window.scrollTo(0, 0);
                          $("#nav").classList.remove("open"); $("#main").focus({ preventScroll: true }); };

  // ---------- chrome: nav, filters, chips ----------
  function renderNav() {
    const list = $("#nav-list"); list.textContent = "";
    let group = null, i = 0;
    for (const id of order) {
      const v = views[id];
      if (v.group !== group) { group = v.group; list.append(h("div", { class: "nav-group", text: t(`nav.g.${group}`) })); }
      i++;
      list.append(h("a", { class: "nav-link", href: `#/${id}`, "aria-current": S.section === id ? "page" : null,
        onclick: e => { e.preventDefault(); go(id); } }, h("span", { class: "num", text: String(i) }), t(`nav.${id}`)));
    }
  }
  function select(label, value, options, onchange, attrs = {}) {
    const sel = h("select", Object.assign({ "aria-label": label, onchange: e => onchange(e.target.value) }, attrs),
      options.map(([v, txt]) => h("option", { value: v, selected: v === value ? true : null, text: txt })));
    return h("label", { class: "filter" }, h("span", { text: label }), sel);
  }
  function seg(label, value, options, onchange) {
    return h("div", { class: "filter" }, h("span", { text: label }),
      h("div", { class: "seg", role: "group", "aria-label": label },
        options.map(([v, txt]) => h("button", { type: "button", "aria-pressed": String(v === value), text: txt,
          onclick: () => onchange(v) }))));
  }
  function finder() {
    const id = "finder-list";
    const input = h("input", { type: "search", list: id, placeholder: S.lang === "sv" ? "Sök bransch, produkt eller avfall…" : "Find industry, product or waste…",
      "aria-label": "Find", style: "border:1px solid var(--border);border-radius:8px;padding:5px 9px;font-size:13px;min-width:230px;background:var(--surface-1)" });
    const dl = h("datalist", { id });
    const opts = [];
    const seenN = new Set(D.region.workers.map(w => w.nace4).concat(D.waste.map(w => w.nace4)));
    for (const c of seenN) opts.push(`SNI ${c} · ${naceName(c)}`);
    for (const c of Object.keys(CN)) opts.push(`CN ${c} · ${cnName(c)}`);
    for (const c of Object.keys(LOW)) opts.push(`LoW ${c} · ${lowName(c)}`);
    opts.sort().forEach(o => dl.append(h("option", { value: o })));
    input.addEventListener("change", () => {
      const m = input.value.match(/^(SNI|CN|LoW) (\d+)/);
      if (!m) return;
      const key = m[1] === "SNI" ? "nace" : m[1] === "CN" ? "cn4" : "low";
      input.value = ""; set({ [key]: m[2] });
    });
    return h("div", { class: "filter" }, input, dl);
  }
  function renderChrome() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === S.lang)));
    renderNav();
    const f = $("#filters"); f.textContent = "";
    f.append(...[
      select(t("f.scenario"), S.scenario, SCENARIOS.map(s => [s, t(`sc.${s}`)]), v => set({ scenario: v })),
      seg(t("f.regime"), S.regime, [["mass", t("regime.mass")], ["value", t("regime.value")]], v => set({ regime: v })),
      seg(t("f.unit"), S.unit, [["t", t("unit.t")], ["sek", t("unit.sek")]], v => set({ unit: v })),
      select(t("f.kommun"), S.kommun, [["", t("ui.all")], ...D.kommuner.map(k => [k.code, k.name])], v => set({ kommun: v })),
      (S.kommun || S.nace) ? select(t("f.role"), S.role, ["any", "give", "take"].map(r => [r, t(`role.${r}`)]), v => set({ role: v })) : null,
      select(t("f.exch"), S.exch, ["all", "L", "X"].map(r => [r, t(`exch.${r}`)]), v => set({ exch: v })),
      finder()
    ].filter(Boolean));
    const c = $("#chips"); c.textContent = "";
    const chip = (key, label, val) => c.append(h("span", { class: "chip" }, `${label}: `, h("b", { text: val }),
      h("button", { type: "button", "aria-label": "Remove", onclick: () => set({ [key]: "" }), text: "×" })));
    if (S.kommun) chip("kommun", t("chip.kommun"), kName(S.kommun));
    if (S.nace) chip("nace", t("chip.nace"), `${S.nace} ${naceName(S.nace)}`);
    if (S.cn4) chip("cn4", t("chip.cn4"), `${S.cn4} ${cnName(S.cn4)}`);
    if (S.low) chip("low", t("chip.low"), `${S.low.length === 6 ? lowCode(S.low) : S.low} ${lowName(S.low)}`);
    if (S.kommun || S.nace || S.cn4 || S.low || S.exch !== "all")
      c.append(h("button", { type: "button", class: "chip clear", text: t("ui.clear"),
        onclick: () => set({ kommun: "", nace: "", cn4: "", low: "", exch: "all", role: "any" }) }));
    $("#foot").textContent = t("foot.text");
  }

  // ---------- charts ----------
  const palette = () => ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"].map(cssv);
  const famColor = f => f === "S" ? cssv("--other") : palette()["ABCDEF".indexOf(f)] || cssv("--other");
  const famOrder = ["A", "B", "C", "D", "E", "F", "S"];
  function base() {
    const ink = cssv("--text-primary"), ink2 = cssv("--text-secondary"), muted = cssv("--axis");
    return {
      textStyle: { fontFamily: cssv("--font"), color: ink2 },
      animationDuration: 300,
      tooltip: { backgroundColor: cssv("--surface-1"), borderColor: cssv("--border"), borderWidth: 1,
                 textStyle: { color: ink, fontSize: 12.5 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,.12);border-radius:8px;" },
      _axis: { axisLine: { lineStyle: { color: cssv("--baseline") } }, axisTick: { show: false },
               axisLabel: { color: muted, fontSize: 11.5 }, splitLine: { lineStyle: { color: cssv("--grid") } } }
    };
  }
  function chart(el, option, onClick) {
    const c = echarts.init(el, null, { renderer: "canvas" });
    const b = base(); delete b._axis;
    c.setOption(Object.assign(b, option));
    if (onClick) c.on("click", onClick);
    charts.push(c);
    return c;
  }
  const axis = extra => Object.assign({}, base()._axis, extra);
  const trunc = (s, n = 34) => s && s.length > n ? s.slice(0, n - 1) + "…" : s;

  // Ranked horizontal bars. items: [{key, label, value, color}]
  function hbar(el, items, { top = 12, fmt = fmtM, onClick, selected, color } = {}) {
    items = items.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    if (!items.length) { el.replaceWith(empty()); return; }
    let shown = items.slice(0, top);
    if (items.length > top) shown.push({ key: null, label: t("ui.other"), value: sum(items.slice(top), d => d.value), other: true });
    shown = shown.reverse();
    const col = color || cssv("--s1");
    el.style.height = Math.max(160, shown.length * 28 + 40) + "px";
    return chart(el, {
      grid: { left: 8, right: 70, top: 6, bottom: 6, containLabel: true },
      xAxis: axis({ type: "value", axisLabel: { show: false }, splitLine: { show: false } }),
      yAxis: axis({ type: "category", data: shown.map(d => trunc(d.label, 40)), axisLabel: { color: cssv("--text-secondary"), fontSize: 12 } }),
      tooltip: { trigger: "item", formatter: p => { const d = shown[p.dataIndex]; return `<b>${fmt(d.value)}</b><br>${esc(d.label)}`; } },
      series: [{ type: "bar", barMaxWidth: 18, data: shown.map(d => ({ value: d.value,
        itemStyle: { color: d.other ? cssv("--other") : (d.color || col), borderRadius: [0, 4, 4, 0],
                     opacity: selected && d.key && d.key !== selected ? 0.45 : 1 } })),
        label: { show: true, position: "right", formatter: p => fmt(shown[p.dataIndex].value), color: cssv("--text-secondary"), fontSize: 11.5 } }]
    }, onClick && (p => { const d = shown[p.dataIndex]; if (d && d.key) onClick(d.key); }));
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let geoReady = null;
  async function ensureGeo() {
    if (!geoReady) geoReady = load("kommuner.geojson").then(g => {
      g.features.forEach(f => { f.properties.name = String(f.properties.KnKod); });
      echarts.registerMap("skaraborg", g);
    });
    return geoReady;
  }
  // Choropleth (+ optional arrows and circles). values: Map(code -> number)
  async function kommunMap(el, values, { fmt = fmtM, onClick, lines = [], circles = [], label = "" } = {}) {
    await ensureGeo();
    const max = Math.max(1, ...values.values());
    const coords = Object.fromEntries(rows(D.meta.kommuner).map(k => [k.code, [k.lon, k.lat]]));
    const lmax = Math.max(1, ...lines.map(l => l.value));
    const cmax = Math.max(1, ...circles.map(c => c.value));
    const seq = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map(cssv);
    const series = [{
      type: "map", map: "skaraborg", roam: false, selectedMode: false, aspectScale: 0.55,
      data: D.kommuner.map(k => ({ name: k.code, value: values.get(k.code) || 0 })),
      label: { show: true, formatter: p => kName(p.name), fontSize: 11, color: cssv("--text-primary"),
               textBorderColor: cssv("--surface-1"), textBorderWidth: 2 },
      itemStyle: { borderColor: cssv("--surface-1"), borderWidth: 1.5 },
      emphasis: { label: { color: cssv("--text-primary") }, itemStyle: { areaColor: cssv("--s4") } },
      geoIndex: 0
    }];
    const opt = {
      geo: { map: "skaraborg", roam: false, aspectScale: 0.55, silent: false, top: 10, bottom: 10, left: 10, right: 10,
             itemStyle: { borderColor: cssv("--surface-1"), borderWidth: 1.5 },
             label: { show: true, formatter: p => kName(p.name), fontSize: 11, color: cssv("--text-primary"),
                      textBorderColor: cssv("--surface-1"), textBorderWidth: 2 },
             emphasis: { label: { show: true, formatter: p => kName(p.name) }, itemStyle: { areaColor: cssv("--s4") } } },
      visualMap: { type: "continuous", min: 0, max, show: true, left: 8, bottom: 8, itemHeight: 90, itemWidth: 10,
                   inRange: { color: seq }, text: [fmt(max), "0"], textStyle: { color: cssv("--text-muted"), fontSize: 11 },
                   seriesIndex: 0, calculable: false },
      tooltip: { trigger: "item", formatter: p => {
        if (p.seriesType === "map") return `<b>${fmt(p.value || 0)}</b><br>${esc(kName(p.name))}${label ? " · " + esc(label) : ""}`;
        if (p.seriesType === "lines") return `<b>${fmt(p.data.value)}</b><br>${esc(kName(p.data.from))} → ${esc(kName(p.data.to))}`;
        return `<b>${fmt(p.data.value[2])}</b><br>${esc(kName(p.data.code))} · ${esc(t("exch.L"))}`;
      } },
      series
    };
    if (lines.length) series.push({
      type: "lines", coordinateSystem: "geo", zlevel: 2,
      data: lines.map(l => ({ coords: [coords[l.from], coords[l.to]], value: l.value, from: l.from, to: l.to,
        lineStyle: { width: 1 + 7 * Math.sqrt(l.value / lmax), color: cssv("--s2"), opacity: 0.85, curveness: 0.2 } })),
      symbol: ["none", "arrow"], symbolSize: 9
    });
    if (circles.length) series.push({
      type: "scatter", coordinateSystem: "geo", zlevel: 3,
      data: circles.map(c => ({ code: c.code, value: [...coords[c.code], c.value] })),
      symbolSize: v => 6 + 30 * Math.sqrt(v[2] / cmax),
      itemStyle: { color: cssv("--s3"), opacity: 0.8, borderColor: cssv("--surface-1"), borderWidth: 2 }
    });
    return chart(el, opt, onClick && (p => {
      if (p.seriesType === "map") onClick(p.name);
      else if (p.seriesType === "scatter") onClick(p.data.code);
    }));
  }

  // Sankey with layered, uniquely keyed nodes. links: [{source, target, value}], labels: {key: text}
  function sankey(el, links, labels, colors, { fmt = fmtM, onClick } = {}) {
    if (!links.length) { el.replaceWith(empty()); return; }
    const keys = new Set(); links.forEach(l => { keys.add(l.source); keys.add(l.target); });
    return chart(el, {
      tooltip: { trigger: "item", formatter: p => p.dataType === "edge"
        ? `<b>${fmt(p.data.value)}</b><br>${esc(labels[p.data.source])} → ${esc(labels[p.data.target])}`
        : `<b>${fmt(p.value)}</b><br>${esc(labels[p.name])}` },
      series: [{ type: "sankey", left: 4, right: 170, top: 8, bottom: 8, nodeGap: 10, nodeWidth: 12, draggable: false,
        layoutIterations: 48, emphasis: { focus: "adjacency" },
        data: [...keys].map(k => ({ name: k, itemStyle: { color: colors[k] || cssv("--s1"), borderWidth: 0 } })),
        links, lineStyle: { color: "gradient", opacity: 0.3, curveness: 0.5 },
        label: { formatter: p => trunc(labels[p.name], 30), fontSize: 11.5, color: cssv("--text-secondary") } }]
    }, onClick && (p => { if (p.dataType === "node") onClick(p.name); }));
  }

  // ---------- table ----------
  // columns: [{key, label, num, fmt(v,row) -> string, code(row) -> string, bar, wrap}]
  function table(container, columns, data, { sort, desc = true, page = 15, onRow, filename = "table", search = true } = {}) {
    let sortKey = sort || (columns.find(c => c.num) || columns[0]).key, sortDesc = desc, n = page, q = "";
    const wrap = h("div");
    const tools = h("div", { class: "tbl-tools" });
    const body = h("div");
    if (search) tools.append(h("input", { type: "search", placeholder: t("ui.search"), "aria-label": t("ui.search"),
      oninput: e => { q = e.target.value.toLowerCase(); n = page; draw(); } }));
    const count = h("span", { class: "muted small" });
    tools.append(count, h("button", { type: "button", class: "ghost", text: "⤓ " + t("ui.download"), onclick: () => csv() }));
    wrap.append(tools, body);
    container.append(wrap);
    const text = (c, r) => c.fmt ? c.fmt(r[c.key], r) : (r[c.key] ?? "");
    const filtered = () => !q ? data : data.filter(r => columns.some(c =>
      String(text(c, r)).toLowerCase().includes(q) || (c.code && String(c.code(r)).toLowerCase().includes(q))));
    function draw() {
      const rowsF = filtered().slice().sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        const r = typeof x === "number" || typeof y === "number" ? (x ?? -Infinity) - (y ?? -Infinity)
                : String(x ?? "").localeCompare(String(y ?? ""), "sv");
        return sortDesc ? -r : r;
      });
      count.textContent = `${num(rowsF.length)} ${t("ui.rows")}`;
      const maxes = {};
      columns.filter(c => c.bar).forEach(c => { maxes[c.key] = Math.max(...rowsF.map(r => Math.abs(r[c.key] || 0)), 1e-9); });
      const tbl = h("table");
      const tr = h("tr");
      for (const c of columns) {
        const th = h("th", { class: [c.num ? "num" : "", c.wrap ? "wrap" : ""].join(" "), scope: "col", tabindex: "0",
          "aria-sort": c.key === sortKey ? (sortDesc ? "descending" : "ascending") : null, text: c.label });
        const act = () => { if (sortKey === c.key) sortDesc = !sortDesc; else { sortKey = c.key; sortDesc = !!c.num; } draw(); };
        th.addEventListener("click", act); th.addEventListener("keydown", e => { if (e.key === "Enter") act(); });
        tr.append(th);
      }
      tbl.append(h("thead", {}, tr));
      const tb = h("tbody");
      if (!rowsF.length) tb.append(h("tr", {}, h("td", { colspan: columns.length, class: "empty", text: t("ui.nodata") })));
      for (const r of rowsF.slice(0, n)) {
        const row = h("tr", { class: onRow ? "clickable" : null, onclick: onRow ? () => onRow(r) : null });
        for (const c of columns) {
          const td = h("td", { class: [c.num ? "num" : "", c.wrap ? "wrap" : "", c.bar ? "bar-cell" : ""].join(" ") });
          if (c.bar) td.append(h("div", { class: "bar", style: `width:${Math.round(100 * Math.abs(r[c.key] || 0) / maxes[c.key])}%` }));
          if (c.code) td.append(h("span", { class: "code", text: c.code(r) }));
          td.append(h("span", { text: text(c, r) }));
          row.append(td);
        }
        tb.append(row);
      }
      tbl.append(tb);
      body.textContent = "";
      body.append(h("div", { class: "tbl-wrap" }, tbl));
      if (rowsF.length > page) body.append(h("div", { class: "tbl-more" },
        h("button", { type: "button", class: "ghost", text: n < rowsF.length ? t("ui.more") : t("ui.less"),
          onclick: () => { n = n < rowsF.length ? n + page * 3 : page; draw(); } })));
    }
    function csv() {
      const lines = [columns.map(c => c.label)];
      for (const r of filtered()) lines.push(columns.map(c => {
        const v = r[c.key]; return typeof v === "number" ? v : `${c.code ? c.code(r) + " " : ""}${text(c, r)}`; }));
      const blob = new Blob(["﻿" + lines.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n")],
                            { type: "text/csv;charset=utf-8" });
      const a = h("a", { href: URL.createObjectURL(blob), download: `${filename}.csv` }); document.body.append(a); a.click(); a.remove();
    }
    draw();
  }

  // ---------- page building blocks ----------
  const empty = () => h("div", { class: "empty", text: t("ui.nodata") });
  function card(title, sub, cls = "") {
    const body = h("div");
    const el = h("section", { class: `card ${cls}` },
      h("div", { class: "card-head" }, h("div", {}, h("h3", { text: title }), sub ? h("p", { text: sub }) : null)), body);
    el.body = body; el.head = el.firstChild;
    return el;
  }
  const chartBox = (cls = "") => h("div", { class: `chart ${cls}` });
  function stat(label, value, sub) {
    return h("div", { class: "card stat" }, h("div", { class: "label", text: label }),
      h("div", { class: "value", text: value }), sub ? h("div", { class: "sub", text: sub }) : null);
  }
  function header(main, id) {
    main.append(h("div", { class: "eyebrow", text: t(`nav.g.${views[id].group}`) }),
      h("h1", { text: t(`${views[id].prefix}.title`) }),
      h("p", { class: "lead", text: t(`${views[id].prefix}.lead`) }));
  }
  const callout = (html, warn) => h("div", { class: `callout ${warn ? "warn" : ""}`, html });

  // ---------- render ----------
  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    charts.forEach(c => c.dispose()); charts = [];
    // Views append their cards to the live page before drawing, so charts get a real width.
    const main = $("#main");
    const y = window.scrollY;
    main.style.minHeight = main.offsetHeight + "px";   // keep the frame while re-rendering
    main.textContent = "";
    const page = h("div"); main.append(page);
    try { await views[S.section].render(page, () => seq !== renderSeq); }
    catch (e) { console.error(e); if (seq === renderSeq) page.append(h("p", { class: "callout warn", text: String(e) })); }
    if (seq !== renderSeq) return;
    main.style.minHeight = "";
    window.scrollTo(0, y);
    requestAnimationFrame(() => charts.forEach(c => c.resize()));
  }
  const view = (id, def) => {          // def.after places the view after another one in the menu
    views[id] = def;
    const i = def.after ? order.indexOf(def.after) : -1;
    if (i >= 0) order.splice(i + 1, 0, id); else order.push(id);
  };

  async function start() {
    S.lang = store.get("ris.lang") || ((navigator.language || "").startsWith("sv") ? "sv" : "en");
    const th = store.get("ris.theme"); if (th) document.documentElement.dataset.theme = th;
    readHash();
    store.set("ris.lang", S.lang);
    try { await loadBase(); await flows(); }
    catch (e) { $("#loading").textContent = "Could not load data: " + e.message; return; }
    $("#loading").hidden = true;
    document.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => {
      store.set("ris.lang", b.dataset.lang); set({ lang: b.dataset.lang });
    }));
    $("#theme-btn").addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "light" : "dark";
      store.set("ris.theme", document.documentElement.dataset.theme); render();
    });
    $("#menu-btn").addEventListener("click", () => $("#nav").classList.toggle("open"));
    window.addEventListener("resize", () => charts.forEach(c => c.resize()));
    window.addEventListener("hashchange", () => { readHash(); renderChrome(); render(); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render());
    renderChrome(); writeHash(); render();
  }

  // A plain-text summary of the current view, for the question assistant
  function describeState() {
    const parts = [`Scenario: ${t("sc." + S.scenario)} (${S.scenario})`, `Allocation priority: ${S.regime}`, `Measure: ${S.unit}`];
    if (S.kommun) parts.push(`Kommun: ${kName(S.kommun)} (${S.kommun}) as ${S.role}`);
    if (S.nace) parts.push(`Industry NACE ${S.nace}: ${naceName(S.nace)}`);
    if (S.cn4) parts.push(`Product CN ${S.cn4}: ${cnFull(S.cn4)}`);
    if (S.low) parts.push(`Waste LoW ${S.low}: ${lowName(S.low)}`);
    if (S.exch !== "all") parts.push(`Exchange: ${S.exch === "L" ? "within kommun" : "between kommuner"}`);
    parts.push(`Page: ${S.section}`);
    return parts.join("\n");
  }

  return { S, D, t, L, h, $, rows, sum, groupSum, cssv, store, num, pct, fmtT, fmtSEK, fmtM, esc, trunc,
           kName, naceName, famName, familyOf, cnName, cnFull, lowName, lowCode, nstName, CN, LOW, NACE, CN_NST,
           load, flows, curFlows, flowPass, wastePass, inputPass, basicPass, measure, excludedFamilies, compat,
           set, toggle, go, view, start, render, describeState,
           chart, axis, hbar, kommunMap, sankey, table, card, chartBox, stat, header, callout, empty,
           palette, famColor, famOrder, SCENARIOS };
})();
