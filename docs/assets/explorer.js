// Firm-level map explorer (Leaflet) and flow network (ECharts graph).
// Rebuilds the Shiny app's map, resources and network tabs on the static site.
(() => {
  const R = RIS;
  const { S, D, t, h, sum, groupSum, cssv, num, pct, fmtT, fmtSEK, fmtM, esc,
          kName, naceName, famName, cnName, lowName, lowCode } = R;

  Object.assign(I18N.en, {
    "nav.explorer": "Map explorer", "nav.network": "Flow network",
    "ex.title": "Map explorer",
    "ex.lead": "Every registry firm on the map, and the firm-to-firm exchanges the model finds. Zoom and pan, click a line or a firm for details, and use the filters to focus on a waste, a product, an industry or a distance. Switch to \"Supply and demand\" to see where waste is generated and where inputs are needed.",
    "ex.mode": "View", "ex.mode.flows": "Flows", "ex.mode.res": "Supply and demand",
    "ex.basis": "Firm data", "ex.basis.T": "Top-down", "ex.basis.B": "Bottom-up",
    "ex.dist": "Distance", "ex.size": "Flow size", "ex.size.all": "All", "ex.size.50": "Top 50 %", "ex.size.25": "Top 25 %", "ex.size.10": "Top 10 %",
    "ex.lines": "Lines", "ex.allsites": "All firms", "ex.color": "Colour by", "ex.color.product": "Product", "ex.color.sector": "Sector",
    "ex.res.show": "Show", "ex.res.both": "Both", "ex.res.supply": "Waste generated", "ex.res.demand": "Inputs needed",
    "ex.res.scope": "Firms", "ex.res.practice": "In exchanges", "ex.res.theory": "All with supply or demand",
    "ex.res.left": "Remaining after exchange",
    "ex.k.links": "Links", "ex.k.dist": "Mean distance", "ex.k.firms": "Firms involved",
    "ex.legend.lines": "Line colour: product group · width: tonnes",
    "ex.legend.sites": "Firm colour: sector · size: tonnes",
    "ex.legend.give": "Waste generated", "ex.legend.take": "Inputs needed",
    "ex.giver": "Giving firm", "ex.taker": "Taking firm",
    "ex.precision": "Firm positions are shown on a {p}. Firms are anonymous; worker counts are given as size classes (S < 10, M 10–49, L ≥ 50).",
    "ex.table": "Firm-to-firm exchanges",
    "ex.filterthis": "Filter on this", "ex.firm": "Firm", "ex.size.class": "Size",
    "ex.sent": "Sent", "ex.received": "Received", "ex.generated": "Waste generated", "ex.needed": "Inputs needed",
    "ex.topwaste": "Main wastes", "ex.topinputs": "Main inputs",
    "grp.min": "Minerals & stone", "grp.wood": "Wood, pulp & paper", "grp.fuel": "Fuels", "grp.food": "Food, feed & agriculture",
    "grp.chem": "Chemicals & fertilisers", "grp.metal": "Metals", "grp.other": "Other",
    "nw.title": "Flow network",
    "nw.lead": "The exchanges as a network: who is connected to whom. Nodes are firms, industries in a kommun, industries or kommuner; arrows point from giver to taker. Drag nodes, zoom with the mouse wheel, and click a node to filter the report. The table ranks nodes by how central they are in the network.",
    "nw.level": "Nodes", "nw.level.firm": "Firms", "nw.level.kn": "Industry × kommun", "nw.level.n": "Industries", "nw.level.k": "Kommuner",
    "nw.layout": "Layout", "nw.layout.force": "Network", "nw.layout.geo": "Geographic",
    "nw.min": "Minimum flow",
    "nw.metrics": "Network metrics",
    "nw.metrics.p": "Degree = number of partners; betweenness = how often a node lies on the shortest path between two others (a broker).",
    "col.node": "Node", "col.indeg": "Takes from", "col.outdeg": "Gives to", "col.btw": "Betweenness", "col.km_mean": "km"
  });
  Object.assign(I18N.sv, {
    "nav.explorer": "Kartutforskare", "nav.network": "Flödesnätverk",
    "ex.title": "Kartutforskare",
    "ex.lead": "Alla registerföretag på kartan och de utbyten mellan företag som modellen hittar. Zooma och panorera, klicka på en linje eller ett företag för detaljer, och använd filtren för att fokusera på ett avfall, en produkt, en bransch eller ett avstånd. Byt till \"Tillgång och efterfrågan\" för att se var avfall uppstår och var insatsvaror behövs.",
    "ex.mode": "Vy", "ex.mode.flows": "Flöden", "ex.mode.res": "Tillgång och efterfrågan",
    "ex.basis": "Företagsdata", "ex.basis.T": "Uppifrån", "ex.basis.B": "Nedifrån",
    "ex.dist": "Avstånd", "ex.size": "Flödesstorlek", "ex.size.all": "Alla", "ex.size.50": "Största 50 %", "ex.size.25": "Största 25 %", "ex.size.10": "Största 10 %",
    "ex.lines": "Linjer", "ex.allsites": "Alla företag", "ex.color": "Färg efter", "ex.color.product": "Produkt", "ex.color.sector": "Sektor",
    "ex.res.show": "Visa", "ex.res.both": "Båda", "ex.res.supply": "Avfall som uppstår", "ex.res.demand": "Insatsvaror som behövs",
    "ex.res.scope": "Företag", "ex.res.practice": "I utbyten", "ex.res.theory": "Alla med tillgång eller efterfrågan",
    "ex.res.left": "Kvar efter utbyte",
    "ex.k.links": "Länkar", "ex.k.dist": "Medelavstånd", "ex.k.firms": "Berörda företag",
    "ex.legend.lines": "Linjefärg: produktgrupp · bredd: ton",
    "ex.legend.sites": "Företagsfärg: sektor · storlek: ton",
    "ex.legend.give": "Avfall som uppstår", "ex.legend.take": "Insatsvaror som behövs",
    "ex.giver": "Givande företag", "ex.taker": "Mottagande företag",
    "ex.precision": "Företagens lägen visas på ett {p}. Företagen är anonyma; antal anställda anges som storleksklass (S < 10, M 10–49, L ≥ 50).",
    "ex.table": "Utbyten mellan företag",
    "ex.filterthis": "Filtrera på detta", "ex.firm": "Företag", "ex.size.class": "Storlek",
    "ex.sent": "Skickat", "ex.received": "Mottaget", "ex.generated": "Avfall som uppstår", "ex.needed": "Insatsvaror som behövs",
    "ex.topwaste": "Största avfall", "ex.topinputs": "Största insatsvaror",
    "grp.min": "Mineraler och sten", "grp.wood": "Trä, massa och papper", "grp.fuel": "Bränslen", "grp.food": "Livsmedel, foder och jordbruk",
    "grp.chem": "Kemikalier och gödsel", "grp.metal": "Metaller", "grp.other": "Övrigt",
    "nw.title": "Flödesnätverk",
    "nw.lead": "Utbytena som ett nätverk: vem är kopplad till vem. Noderna är företag, branscher i en kommun, branscher eller kommuner; pilarna går från givare till mottagare. Dra i noderna, zooma med mushjulet och klicka på en nod för att filtrera rapporten. Tabellen rangordnar noderna efter hur centrala de är i nätverket.",
    "nw.level": "Noder", "nw.level.firm": "Företag", "nw.level.kn": "Bransch × kommun", "nw.level.n": "Branscher", "nw.level.k": "Kommuner",
    "nw.layout": "Layout", "nw.layout.force": "Nätverk", "nw.layout.geo": "Geografisk",
    "nw.min": "Minsta flöde",
    "nw.metrics": "Nätverksmått",
    "nw.metrics.p": "Grad = antal partner; mellanliggande centralitet = hur ofta en nod ligger på den kortaste vägen mellan två andra (en mäklare).",
    "col.node": "Nod", "col.indeg": "Tar emot från", "col.outdeg": "Ger till", "col.btw": "Mellanliggande", "col.km_mean": "km"
  });

  // ---------- state of these two pages ----------
  const E = { mode: "flows", basis: "T", dmin: 0, dmax: 200, size: "25", lines: true, allSites: false, color: "product", base: null,
              res: "both", scope: "practice", left: false, view: null,
              level: "kn", layout: "force", min: 1 };
  const setE = patch => { Object.assign(E, patch); R.render(); };
  // deep links: #/explorer?mode=res or #/network?level=k&layout=geo
  (() => {
    const q = new URLSearchParams((location.hash.split("?")[1]) || "");
    for (const k of ["mode", "basis", "res", "scope", "level", "layout", "size", "color"]) if (q.has(k)) E[k] = q.get(k);
    if (q.has("min")) E.min = +q.get("min");
  })();

  // ---------- data ----------
  let SITES = null;
  const LINKS = {};
  async function sites() {
    if (!SITES) {
      const j = await R.load("sites.json");
      const list = R.rows(j.sites);
      list.forEach(s => { s.fam = R.familyOf(s.nace4); });
      SITES = { precision: j.precision, list, byId: new Map(list.map(s => [s.sid, s])),
                waste: R.rows(j.waste), inputs: R.rows(j.inputs) };
    }
    return SITES;
  }
  async function links(sc = S.scenario) {
    if (!LINKS[sc]) {
      const st = await sites();
      LINKS[sc] = R.rows(await R.load(`links_${sc}.json`)).map(l => {
        const a = st.byId.get(l.a), b = st.byId.get(l.b);
        return { ...l, fk: a.kommun, fn: a.nace4, tk: b.kommun, tn: b.nace4, st: a.kommun === b.kommun ? "L" : "X" };
      });
    }
    return LINKS[sc];
  }
  // links passing the global filters and this page's basis, regime and distance
  async function current() {
    const all = await links();
    return all.filter(l => l.sc === E.basis && l.rg === S.regime[0] && l.km >= E.dmin && (E.dmax >= 200 || l.km <= E.dmax) && R.flowPass(l));
  }

  // ---------- product groups (fixed colour per group) ----------
  const GROUPS = ["min", "wood", "fuel", "food", "chem", "metal", "other"];
  const groupOf = cn4 => {
    const n = R.CN_NST[cn4], c2 = +cn4.slice(0, 2);
    if (n === "03a" || n === "03" || n === "09" || [25, 26, 68, 69, 70].includes(c2)) return "min";
    if (n === "06" || [44, 47, 48].includes(c2)) return "wood";
    if (n === "02" || n === "07" || c2 === 27) return "fuel";
    if (n === "01" || n === "04" || c2 <= 24) return "food";
    if (n === "08" || (c2 >= 28 && c2 <= 40)) return "chem";
    if (n === "10" || (c2 >= 72 && c2 <= 83)) return "metal";
    return "other";
  };
  const groupColor = g => g === "other" ? cssv("--other") : R.palette()[GROUPS.indexOf(g)];

  // ---------- controls ----------
  const seg = (label, value, options, on) => h("div", { class: "filter" }, h("span", { text: label }),
    h("div", { class: "seg" }, options.map(([v, txt]) => h("button", { type: "button", "aria-pressed": String(v === value), text: txt, onclick: () => on(v) }))));
  const sel = (label, value, options, on) => h("label", { class: "filter" }, h("span", { text: label }),
    h("select", { onchange: e => on(e.target.value) }, options.map(([v, txt]) => h("option", { value: v, selected: v === value ? true : null, text: txt }))));
  const check = (label, value, on) => h("label", { class: "filter" },
    h("input", { type: "checkbox", checked: value ? true : null, onchange: e => on(e.target.checked) }), h("span", { text: label }));
  function distance() {
    const out = h("span", { class: "muted small", text: `${E.dmin}–${E.dmax >= 200 ? "200+" : E.dmax} km` });
    const mk = (key, v) => h("input", { type: "range", min: 0, max: 200, step: 5, value: v, "aria-label": t("ex.dist") + " " + key,
      style: "width:110px", oninput: e => { E[key] = +e.target.value; if (E.dmin > E.dmax) E[key === "dmin" ? "dmax" : "dmin"] = E[key];
        out.textContent = `${E.dmin}–${E.dmax >= 200 ? "200+" : E.dmax} km`; }, onchange: () => R.render() });
    return h("div", { class: "filter" }, h("span", { text: t("ex.dist") }), mk("dmin", E.dmin), mk("dmax", E.dmax), out);
  }
  const bar = (...kids) => h("div", { class: "filters", style: "margin:4px 0 12px" }, ...kids);

  // ---------- popups ----------
  const row = (k, v) => `<tr><td style="color:${cssv("--text-muted")};padding:1px 10px 1px 0">${esc(k)}</td><td>${v}</td></tr>`;
  function linkPopup(p) {
    const a = SITES.byId.get(p.a), b = SITES.byId.get(p.b);
    const items = p.items.sort((x, y) => y.t - x.t).slice(0, 6).map(i =>
      `<li>${esc(lowName(i.low))} → <b>${esc(cnName(i.cn4))}</b>: ${esc(fmtT(i.t))}</li>`).join("");
    return `<div style="font-size:12.5px;max-width:320px"><b style="font-size:13.5px">${esc(fmtT(p.t))} · ${esc(fmtSEK(p.sek))}</b>
      <table style="margin:6px 0">${row(t("ex.giver"), `${esc(naceName(a.nace4))}, ${esc(kName(a.kommun))}`)}
      ${row(t("ex.taker"), `${esc(naceName(b.nace4))}, ${esc(kName(b.kommun))}`)}${row("km", esc(num(p.km, 1)))}</table>
      <ul style="margin:4px 0 0;padding-left:16px">${items}</ul></div>`;
  }
  function sitePopup(s, info) {
    const list = (m, f) => [...m].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `<li>${esc(f(k))}: ${esc(fmtT(v))}</li>`).join("");
    const div = h("div", { style: "font-size:12.5px;max-width:300px" });
    div.innerHTML = `<b style="font-size:13.5px">${esc(naceName(s.nace4))}</b><div style="color:${cssv("--text-muted")}">${esc(s.nace4)} · ${esc(kName(s.kommun))} · ${esc(t("ex.size.class"))} ${esc(s.size)}</div>
      <table style="margin:6px 0">${info.sent ? row(t("ex.sent"), esc(fmtT(info.sent))) : ""}${info.recv ? row(t("ex.received"), esc(fmtT(info.recv))) : ""}
      ${info.gen ? row(t("ex.generated"), esc(fmtT(info.gen))) : ""}${info.need ? row(t("ex.needed"), esc(fmtT(info.need))) : ""}</table>
      ${info.wastes && info.wastes.size ? `<div>${esc(t("ex.topwaste"))}</div><ul style="margin:2px 0;padding-left:16px">${list(info.wastes, lowName)}</ul>` : ""}
      ${info.ins && info.ins.size ? `<div>${esc(t("ex.topinputs"))}</div><ul style="margin:2px 0;padding-left:16px">${list(info.ins, cnName)}</ul>` : ""}`;
    div.append(h("a", { href: "#", text: t("ex.filterthis") + " →", onclick: e => { e.preventDefault(); R.set({ kommun: s.kommun, nace: s.nace4 }); } }));
    return div;
  }

  // ---------- map explorer ----------
  let map = null;
  R.view("explorer", { group: "sym", prefix: "ex", after: "flows", async render(page) {
    if (map) { E.view = { c: map.getCenter(), z: map.getZoom() }; map.remove(); map = null; }
    R.header(page, "explorer");
    const st = await sites();
    page.append(bar(
      seg(t("ex.mode"), E.mode, [["flows", t("ex.mode.flows")], ["res", t("ex.mode.res")]], v => setE({ mode: v })),
      seg(t("ex.basis"), E.basis, [["T", t("ex.basis.T")], ["B", t("ex.basis.B")]], v => setE({ basis: v })),
      E.mode === "flows" ? distance() : null,
      E.mode === "flows" ? sel(t("ex.size"), E.size, ["all", "50", "25", "10"].map(v => [v, t("ex.size." + v)]), v => setE({ size: v })) : null,
      E.mode === "flows" ? seg(t("ex.color"), E.color, [["product", t("ex.color.product")], ["sector", t("ex.color.sector")]], v => setE({ color: v })) : null,
      E.mode === "flows" ? check(t("ex.lines"), E.lines, v => setE({ lines: v })) : null,
      E.mode === "flows" ? check(t("ex.allsites"), E.allSites, v => setE({ allSites: v })) : null,
      E.mode === "res" ? seg(t("ex.res.show"), E.res, ["both", "supply", "demand"].map(v => [v, t("ex.res." + v)]), v => setE({ res: v })) : null,
      E.mode === "res" ? seg(t("ex.res.scope"), E.scope, [["practice", t("ex.res.practice")], ["theory", t("ex.res.theory")]], v => setE({ scope: v })) : null,
      E.mode === "res" ? check(t("ex.res.left"), E.left, v => setE({ left: v })) : null
    ));
    const L0 = await current();
    // aggregate links per site pair
    const pairs = new Map();
    for (const l of L0) {
      const k = l.a + ">" + l.b;
      const p = pairs.get(k) || { a: l.a, b: l.b, t: 0, sek: 0, km: l.km, items: [], g: new Map() };
      p.t += l.t; p.sek += l.sek; p.items.push(l); p.g.set(groupOf(l.cn4), (p.g.get(groupOf(l.cn4)) || 0) + l.t);
      pairs.set(k, p);
    }
    let P = [...pairs.values()].sort((x, y) => y.t - x.t);
    if (E.size !== "all") P = P.slice(0, Math.max(1, Math.ceil(P.length * +E.size / 100)));
    const Lk = new Set(P.flatMap(p => p.items));
    const kept = L0.filter(l => Lk.has(l));

    const tt = sum(kept, l => l.t), vv = sum(kept, l => l.sek);
    const involved = new Set(kept.flatMap(l => [l.a, l.b]));
    const kpis = page.appendChild(h("div", { class: "grid g4" },
      R.stat(t("ex.k.links"), num(P.length), `${num(kept.length)} ${S.lang === "sv" ? "avfall–produkt-par" : "waste–product pairs"}`),
      R.stat(t("fl.k.t"), fmtT(tt), fmtSEK(vv)),
      R.stat(t("ex.k.dist"), `${num(tt ? sum(kept, l => l.t * l.km) / tt : 0, 1)} km`, S.lang === "sv" ? "viktat med ton" : "tonne-weighted"),
      R.stat(t("ex.k.firms"), num(involved.size), `${pct(tt ? 100 * sum(kept.filter(l => l.st === "L"), l => l.t) / tt : 0, 0)} ${t("exch.L").toLowerCase()}`)));

    const box = h("div", { style: "height:680px;border-radius:10px;border:1px solid var(--border);margin-top:16px;z-index:0;position:relative" });
    page.append(box);
    const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    map = L.map(box, { preferCanvas: true, scrollWheelZoom: true, zoomControl: true });
    // free basemaps: Esri gray canvas (no key) by default, OpenStreetMap as an alternative
    const esri = name => L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${name}/MapServer/tile/{z}/{y}/{x}`,
      { attribution: "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors", maxZoom: 16 });
    const bases = {
      [S.lang === "sv" ? "Grå karta" : "Gray map"]: esri(dark ? "World_Dark_Gray_Base" : "World_Light_Gray_Base"),
      "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 })
    };
    const baseName = E.base && bases[E.base] ? E.base : Object.keys(bases)[0];
    bases[baseName].addTo(map);
    L.control.layers(bases, null, { position: "topright" }).addTo(map);
    map.on("baselayerchange", e => { E.base = e.name; });
    const geo = await R.load("kommuner.geojson");
    const selColor = S.role === "take" ? cssv("--s1") : S.role === "give" ? cssv("--s2") : cssv("--s7");
    const kl = L.geoJSON(geo, { style: f => ({ color: String(f.properties.KnKod) === S.kommun ? selColor : cssv("--axis"),
      weight: String(f.properties.KnKod) === S.kommun ? 3.5 : 1, opacity: 0.9, fill: true, fillOpacity: 0 }),
      onEachFeature: (f, layer) => layer.bindTooltip(kName(String(f.properties.KnKod)), { sticky: true, opacity: 0.85 }) }).addTo(map);
    // keep the user's view, except when the kommun filter changed: then zoom to it (or back out)
    if (E.view && E.lastKommun === S.kommun) map.setView(E.view.c, E.view.z);
    else {
      const selLayer = S.kommun && kl.getLayers().find(x => String(x.feature.properties.KnKod) === S.kommun);
      map.fitBounds((selLayer || kl).getBounds(), { padding: [20, 20] });
    }
    E.lastKommun = S.kommun;

    const surface = cssv("--surface-1");
    if (E.mode === "flows") {
      const sent = groupSum(kept, l => l.a, l => l.t), recv = groupSum(kept, l => l.b, l => l.t);
      if (E.lines) {
        const tmax = Math.max(1, ...P.map(p => p.t));
        for (const p of P.slice().reverse()) {
          const a = st.byId.get(p.a), b = st.byId.get(p.b);
          const g = [...p.g].sort((x, y) => y[1] - x[1])[0][0];
          const ln = L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: E.color === "product" ? groupColor(g) : cssv("--axis"),
            weight: 1 + 9 * Math.sqrt(p.t / tmax), opacity: 0.75 });
          ln.bindPopup(() => linkPopup(p), { maxWidth: 340 });
          ln.on("mouseover", () => ln.setStyle({ opacity: 1 })).on("mouseout", () => ln.setStyle({ opacity: 0.75 }));
          ln.addTo(map);
        }
      }
      if (E.allSites) for (const s of st.list) if (!involved.has(s.sid))
        L.circleMarker([s.lat, s.lon], { radius: 3, color: R.famColor(s.fam), weight: 1, opacity: 0.5, fillOpacity: 0.25 })
          .bindTooltip(`${naceName(s.nace4)} · ${kName(s.kommun)}`).addTo(map);
      const vmax = Math.max(1, ...[...involved].map(i => (sent.get(i) || 0) + (recv.get(i) || 0)));
      for (const i of involved) {
        const s = st.byId.get(i), v = (sent.get(i) || 0) + (recv.get(i) || 0);
        L.circleMarker([s.lat, s.lon], { radius: 4 + 14 * Math.sqrt(v / vmax), color: surface, weight: 1.5,
            fillColor: E.color === "sector" ? R.famColor(s.fam) : cssv("--text-primary"), fillOpacity: 0.9 })
          .bindTooltip(`${naceName(s.nace4)} · ${kName(s.kommun)} · ${fmtT(v)}`)
          .bindPopup(() => sitePopup(s, { sent: sent.get(i), recv: recv.get(i),
            wastes: groupSum(kept.filter(l => l.a === i), l => l.low, l => l.t), ins: groupSum(kept.filter(l => l.b === i), l => l.cn4, l => l.t) }))
          .addTo(map);
      }
      if (E.color === "product")
        legend(map, GROUPS.filter(g => kept.some(l => groupOf(l.cn4) === g)).map(g => [groupColor(g), t("grp." + g), "line"]), [t("ex.legend.lines")]);
      else
        legend(map, R.famOrder.filter(f => [...involved].some(i => st.byId.get(i).fam === f)).map(f => [R.famColor(f), famName(f), "dot"]), [t("ex.legend.sites")]);
    } else {
      // supply and demand per site (top-down firm estimates), filtered like the rest of the report
      const fs = await R.flows();
      const lowsForCn = S.cn4 ? R.compat(fs, "low", S.cn4) : null, cnsForLow = S.low ? R.compat(fs, "cn4", S.low) : null;
      const okSite = s => (!S.kommun || s.kommun === S.kommun) && s.nace4.startsWith(S.nace) && !R.excludedFamilies().includes(s.fam);
      const gen = new Map(), need = new Map(), W = new Map(), I = new Map();
      for (const w of st.waste) { const s = st.byId.get(w.s);
        if (!okSite(s) || !w.low.startsWith(S.low) || (lowsForCn && !lowsForCn.has(w.low))) continue;
        gen.set(w.s, (gen.get(w.s) || 0) + w.t); if (!W.has(w.s)) W.set(w.s, new Map()); W.get(w.s).set(w.low, (W.get(w.s).get(w.low) || 0) + w.t); }
      for (const i of st.inputs) { const s = st.byId.get(i.s);
        if (!okSite(s) || !i.cn4.startsWith(S.cn4) || (cnsForLow && !cnsForLow.has(i.cn4))) continue;
        need.set(i.s, (need.get(i.s) || 0) + i.t); if (!I.has(i.s)) I.set(i.s, new Map()); I.get(i.s).set(i.cn4, (I.get(i.s).get(i.cn4) || 0) + i.t); }
      const sent = groupSum(kept, l => l.a, l => l.t), recv = groupSum(kept, l => l.b, l => l.t);
      if (E.left) { for (const [k, v] of gen) gen.set(k, Math.max(0, v - (sent.get(k) || 0)));
                    for (const [k, v] of need) need.set(k, Math.max(0, v - (recv.get(k) || 0))); }
      const inEx = E.scope === "practice" ? involved : null;
      const draw = (m, color, kind) => {
        const ents = [...m].filter(([k, v]) => v >= 0.1 && (!inEx || inEx.has(k)));
        const vmax = Math.max(1, ...ents.map(e => e[1]));
        for (const [k, v] of ents.sort((x, y) => y[1] - x[1])) {
          const s = st.byId.get(k);
          L.circleMarker([s.lat, s.lon], { radius: 3 + 20 * Math.sqrt(v / vmax), color, weight: 1.5, fillColor: color, fillOpacity: 0.35 })
            .bindTooltip(`${naceName(s.nace4)} · ${kName(s.kommun)} · ${fmtT(v)}`)
            .bindPopup(() => sitePopup(s, { gen: gen.get(k), need: need.get(k), sent: sent.get(k), recv: recv.get(k), wastes: W.get(k), ins: I.get(k) }))
            .addTo(map);
        }
        return ents.length;
      };
      const nG = E.res !== "demand" ? draw(gen, cssv("--s2"), "supply") : 0;
      const nN = E.res !== "supply" ? draw(need, cssv("--s1"), "demand") : 0;
      const tot = m => sum([...m].filter(([k]) => !inEx || inEx.has(k)), e => e[1]);
      kpis.replaceChildren(
        R.stat(E.left ? `${t("ex.generated")} · ${t("ex.res.left").toLowerCase()}` : t("ex.generated"), fmtT(tot(gen)), `${num(nG)} ${t("u.firms")}`),
        R.stat(E.left ? `${t("ex.needed")} · ${t("ex.res.left").toLowerCase()}` : t("ex.needed"), fmtT(tot(need)), `${num(nN)} ${t("u.firms")}`),
        R.stat(t("fl.k.t"), fmtT(tt), fmtSEK(vv)),
        R.stat(t("ex.k.firms"), num(involved.size), t("ex.res." + E.scope)));
      legend(map, [[cssv("--s2"), t("ex.legend.give"), "dot"], [cssv("--s1"), t("ex.legend.take"), "dot"]], []);
      page.append(h("p", { class: "small muted", text: S.lang === "sv"
        ? "Tillgång och efterfrågan per företag bygger på uppifrån-skattningen. Cirkelns yta motsvarar ton."
        : "Supply and demand per firm use the top-down estimate. Circle area represents tonnes." }));
    }
    page.append(h("p", { class: "small muted", text: t("ex.precision", { p: st.precision === "exact"
      ? (S.lang === "sv" ? "exakt läge (intern version)" : "exact position (internal build)")
      : (S.lang === "sv" ? "rutnät med 1 km rutor" : "1 km grid") }) }));

    // table of exchanges
    const c = R.card(t("ex.table"), t("ui.clickhint"));
    c.style.marginTop = "12px"; page.append(c);
    R.table(c.body, [
      { key: "fkn", label: t("col.from"), fmt: (v, r) => kName(r.fk) },
      { key: "fn", label: t("col.giver"), wrap: true, code: r => r.fn, fmt: v => naceName(v) },
      { key: "low", label: t("col.low"), wrap: true, code: r => lowCode(r.low), fmt: v => lowName(v) },
      { key: "tkn", label: t("col.to"), fmt: (v, r) => kName(r.tk) },
      { key: "tn", label: t("col.taker"), wrap: true, code: r => r.tn, fmt: v => naceName(v) },
      { key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) },
      { key: "t", label: t("col.tons"), num: true, bar: true, fmt: v => num(v, v < 10 ? 1 : 0) },
      { key: "msek", label: t("col.msek"), num: true, fmt: v => num(v, 2) },
      { key: "km", label: "km", num: true, fmt: v => num(v, 1) }],
      kept.map(l => ({ ...l, fkn: kName(l.fk), tkn: kName(l.tk), msek: l.sek / 1e6 })),
      { sort: "t", page: 12, filename: `firm_links_${S.scenario}_${E.basis}_${S.regime}`, onRow: r => R.set({ cn4: r.cn4, low: r.low }) });
  } });

  function legend(m, items, titles) {
    const ctl = L.control({ position: "bottomright" });
    ctl.onAdd = () => {
      const d = h("div", { style: `background:${cssv("--surface-1")};color:${cssv("--text-secondary")};padding:8px 10px;border-radius:8px;border:1px solid ${cssv("--border")};font-size:12px;line-height:1.6;max-width:230px` });
      titles.forEach(x => d.append(h("div", { style: `color:${cssv("--text-muted")};font-size:11px`, text: x })));
      for (const [color, label, kind] of items) d.append(h("div", {},
        h("i", { style: kind === "line" ? `display:inline-block;width:14px;height:3px;background:${color};margin-right:6px;vertical-align:3px`
          : `display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px` }), label));
      L.DomEvent.disableClickPropagation(d);
      return d;
    };
    ctl.addTo(m);
  }

  // ---------- network ----------
  function betweenness(nodes, adj) {     // Brandes, undirected, unweighted
    const n = nodes.length, CB = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      const Sst = [], P = Array.from({ length: n }, () => []), sigma = new Array(n).fill(0), d = new Array(n).fill(-1);
      sigma[s] = 1; d[s] = 0; const Q = [s];
      while (Q.length) { const v = Q.shift(); Sst.push(v);
        for (const w of adj[v]) { if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; } if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); } } }
      const delta = new Array(n).fill(0);
      while (Sst.length) { const w = Sst.pop(); for (const v of P[w]) delta[v] += sigma[v] / sigma[w] * (1 + delta[w]); if (w !== s) CB[w] += delta[w]; }
    }
    const norm = n > 2 ? (n - 1) * (n - 2) : 1;
    return CB.map(x => x / norm);     // each pair counted twice in undirected graphs, as is the normaliser
  }

  R.view("network", { group: "sym", prefix: "nw", after: "explorer", async render(page) {
    R.header(page, "network");
    const st = await sites();
    page.append(bar(
      seg(t("nw.level"), E.level, ["firm", "kn", "n", "k"].map(v => [v, t("nw.level." + v)]), v => setE({ level: v, layout: (v === "firm" || v === "k") ? E.layout : "force",
        min: v === "firm" ? Math.max(E.min, 10) : E.min })),
      (E.level === "firm" || E.level === "k") ? seg(t("nw.layout"), E.layout, [["force", t("nw.layout.force")], ["geo", t("nw.layout.geo")]], v => setE({ layout: v })) : null,
      seg(t("ex.basis"), E.basis, [["T", t("ex.basis.T")], ["B", t("ex.basis.B")]], v => setE({ basis: v })),
      sel(t("nw.min"), String(E.min), ["0.1", "1", "10", "100", "1000"].map(v => [v, `≥ ${num(+v, v === "0.1" ? 1 : 0)} t`]), v => setE({ min: +v }))
    ));
    const kept = (await current());
    const keyOf = {
      firm: (sid) => String(sid),
      kn: (sid) => { const s = st.byId.get(sid); return s.kommun + "|" + s.nace4; },
      n: (sid) => st.byId.get(sid).nace4,
      k: (sid) => st.byId.get(sid).kommun
    }[E.level];
    const label = k => {
      if (E.level === "firm") { const s = st.byId.get(+k); return `${naceName(s.nace4)} (${kName(s.kommun)})`; }
      if (E.level === "kn") { const [km, n] = k.split("|"); return `${naceName(n)} · ${kName(km)}`; }
      return E.level === "n" ? naceName(k) : kName(k);
    };
    const famOfKey = k => E.level === "k" ? null : R.familyOf(E.level === "firm" ? st.byId.get(+k).nace4 : E.level === "kn" ? k.split("|")[1] : k);
    const edges = new Map(), thr = new Map(), sent = new Map(), recv = new Map();
    for (const l of kept) {
      const a = keyOf(l.a), b = keyOf(l.b), v = R.measure(l);
      sent.set(a, (sent.get(a) || 0) + l.t); recv.set(b, (recv.get(b) || 0) + l.t);
      thr.set(a, (thr.get(a) || 0) + v); thr.set(b, (thr.get(b) || 0) + v);
      if (a === b) continue;
      const k = a + "→" + b; const e = edges.get(k) || { a, b, v: 0, t: 0, n: 0 }; e.v += v; e.t += l.t; e.n++; edges.set(k, e);
    }
    const E2 = [...edges.values()].filter(e => e.t >= E.min);
    const keys = [...new Set(E2.flatMap(e => [e.a, e.b]))];
    const idx = new Map(keys.map((k, i) => [k, i]));
    const adj = keys.map(() => new Set());
    E2.forEach(e => { adj[idx.get(e.a)].add(idx.get(e.b)); adj[idx.get(e.b)].add(idx.get(e.a)); });
    const btw = keys.length <= 1500 ? betweenness(keys, adj.map(s => [...s])) : keys.map(() => 0);
    const vmax = Math.max(1, ...keys.map(k => thr.get(k) || 0)), emax = Math.max(1, ...E2.map(e => e.v));
    const topLab = new Set(keys.slice().sort((x, y) => (thr.get(y) || 0) - (thr.get(x) || 0)).slice(0, E.level === "k" ? 15 : E.level === "firm" ? 8 : 12));
    const geoPos = k => { if (E.level === "firm") { const s = st.byId.get(+k); return [s.lon, s.lat]; }
      const c = R.rows(D.meta.kommuner).find(x => x.code === k); return [c.lon, c.lat]; };
    const geo = E.layout === "geo" && (E.level === "firm" || E.level === "k");
    const card = R.card(t("nw.title"), `${num(keys.length)} ${S.lang === "sv" ? "noder" : "nodes"} · ${num(E2.length)} ${S.lang === "sv" ? "länkar" : "links"}`);
    page.append(card);
    const box = R.chartBox("xl"); box.style.height = "640px"; card.body.append(box);
    if (!keys.length) { box.replaceWith(R.empty()); }
    else R.chart(box, {
      tooltip: { formatter: p => p.dataType === "edge"
        ? `<b>${esc(fmtM(p.data.value))}</b><br>${esc(label(p.data.source))} → ${esc(label(p.data.target))}`
        : `<b>${esc(fmtM(thr.get(p.data.name) || 0))}</b><br>${esc(label(p.data.name))}<br>${esc(t("ex.sent"))}: ${esc(fmtT(sent.get(p.data.name) || 0))} · ${esc(t("ex.received"))}: ${esc(fmtT(recv.get(p.data.name) || 0))}` },
      series: [{
        type: "graph", layout: geo ? "none" : "force", roam: true, draggable: !geo,
        force: { repulsion: E.level === "firm" ? 60 : 140, edgeLength: [20, 110], gravity: 0.18, friction: 0.15 },
        edgeSymbol: ["none", "arrow"], edgeSymbolSize: 7,
        emphasis: { focus: "adjacency", lineStyle: { width: 4 } },
        label: { show: true, position: "right", fontSize: 11, color: cssv("--text-secondary"),
                 formatter: p => topLab.has(p.data.name) ? R.trunc(label(p.data.name), 30) : "" },
        data: keys.map(k => { const f = famOfKey(k), o = { name: k, value: thr.get(k) || 0,
          symbolSize: 6 + 34 * Math.sqrt((thr.get(k) || 0) / vmax),
          itemStyle: { color: f ? R.famColor(f) : cssv("--s1"), borderColor: cssv("--surface-1"), borderWidth: 1.5 } };
          if (geo) { const [x, y] = geoPos(k); o.x = x * 100; o.y = -y * 190; } return o; }),
        links: E2.map(e => ({ source: e.a, target: e.b, value: e.v,
          lineStyle: { width: 0.6 + 6 * Math.sqrt(e.v / emax), color: "source", opacity: 0.45, curveness: 0.15 } }))
      }]
    }, p => { if (p.dataType !== "node") return; const k = p.data.name;
      if (E.level === "firm") { const s = st.byId.get(+k); R.set({ kommun: s.kommun, nace: s.nace4 }); }
      else if (E.level === "kn") { const [km, n] = k.split("|"); R.set({ kommun: km, nace: n }); }
      else if (E.level === "n") R.toggle("nace", k); else R.toggle("kommun", k); });
    card.body.append(h("div", { class: "legend", style: "margin-top:6px" },
      (E.level === "k" ? [] : R.famOrder.filter(f => keys.some(k => famOfKey(k) === f)))
        .map(f => h("span", {}, h("i", { style: `background:${R.famColor(f)};border-radius:50%` }), famName(f))),
      h("span", { class: "muted", text: S.lang === "sv" ? "Nodstorlek = ton in + ut · pil = från givare till mottagare" : "Node size = tonnes in + out · arrow = giver to taker" })));

    const m = R.card(t("nw.metrics"), t("nw.metrics.p"));
    m.style.marginTop = "16px"; page.append(m);
    const indeg = groupSum(E2, e => e.b, () => 1), outdeg = groupSum(E2, e => e.a, () => 1);
    R.table(m.body, [
      { key: "label", label: t("col.node"), wrap: true },
      { key: "outdeg", label: t("col.outdeg"), num: true, fmt: v => num(v) },
      { key: "indeg", label: t("col.indeg"), num: true, fmt: v => num(v) },
      { key: "sent", label: t("ex.sent") + " (t)", num: true, bar: true, fmt: v => num(v) },
      { key: "recv", label: t("ex.received") + " (t)", num: true, fmt: v => num(v) },
      { key: "btw", label: t("col.btw"), num: true, fmt: v => num(v, 3) }],
      keys.map((k, i) => ({ key: k, label: label(k), outdeg: outdeg.get(k) || 0, indeg: indeg.get(k) || 0,
        sent: sent.get(k) || 0, recv: recv.get(k) || 0, btw: btw[i] })),
      { sort: "btw", page: 15, filename: `network_${E.level}_${S.scenario}`, onRow: r => {
        const k = r.key;
        if (E.level === "firm") { const s = st.byId.get(+k); R.set({ kommun: s.kommun, nace: s.nace4 }); }
        else if (E.level === "kn") { const [km, n] = k.split("|"); R.set({ kommun: km, nace: n }); }
        else if (E.level === "n") R.set({ nace: k }); else R.set({ kommun: k }); } });
  } });
})();
