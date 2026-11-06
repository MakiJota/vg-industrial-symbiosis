// Report sections. Each view appends its cards to the page, then draws into them.
(() => {
  const R = RIS;
  const { S, D, t, h, sum, groupSum, cssv, num, pct, fmtT, fmtSEK, fmtM, esc,
          kName, naceName, famName, cnName, lowName, lowCode, nstName } = R;
  const grid = (cls, ...kids) => h("div", { class: `grid ${cls}` }, ...kids);
  const add = (page, ...els) => { page.append(...els); return els[0]; };
  const scaleKey = { region: "1b Region - optimum (LP)", intra: "2a Kommun - intra only",
                     kommun: "2b Kommun - intra + inter", firm_bu: "3a Firms - bottom-up", firm_td: "3b Firms - top-down" };
  const kpi = (scenario = S.scenario, scale = "kommun", regime = S.regime) =>
    D.kpis.by_scale.find(r => r.scenario === scenario && r.regime === regime && r.scale === scaleKey[scale]) || {};
  const kommunCode = r => r.kommun;
  const naceCol = (key = "nace4", label = t("col.nace")) =>
    ({ key, label, wrap: true, code: r => r[key], fmt: v => naceName(v) });
  const kommunCol = (key = "kommun", label = t("col.kommun")) => ({ key: key + "_name", label, fmt: (v, r) => kName(r[key]) });
  const withNames = (arr, ...keys) => arr.map(r => { const o = { ...r }; keys.forEach(k => { o[k + "_name"] = kName(r[k]); }); return o; });
  const unitNote = () => S.unit === "sek" ? h("p", { class: "small muted", text: S.lang === "sv"
    ? "Avfall saknar pris och visas i ton." : "Waste has no price and is shown in tonnes." }) : null;

  // ======================= 1. Overview =======================
  R.view("overview", { group: "intro", prefix: "ov", async render(page) {
    add(page, h("div", { class: "eyebrow", text: t("ov.eyebrow") }), h("h1", { text: t("ov.title") }),
        h("p", { class: "lead", text: t("ov.lead") }));
    const k = kpi();
    add(page, grid("g4",
      R.stat(t("ov.k.waste"), fmtT(k.waste_t), t("ov.k.waste.sub")),
      R.stat(t("ov.k.inputs"), fmtT(k.inputs_t), t("ov.k.inputs.sub", { v: fmtSEK(k.inputs_value_msek * 1e6) })),
      R.stat(t("ov.k.alloc"), fmtT(k.allocated_t), t("ov.k.alloc.sub", { p: pct(k.allocation_ratio_pct), s: pct(k.substitution_mass_pct, 0) })),
      R.stat(t("ov.k.value"), fmtSEK(k.replaced_value_msek * 1e6), t("ov.k.value.sub", { p: pct(k.substitution_value_pct) }))));
    add(page, h("p", { class: "small muted", text: `${t("ov.k.note")} ${t("sc." + S.scenario)} · ${t("regime." + S.regime)}` }));

    const fl = (await R.curFlows()).filter(f => R.flowPass(f));
    const mapCard = R.card(t("fl.c1"), t("fl.c1.p"));
    const prodCard = R.card(t("pr.c1"), t("pr.c1.p"));
    add(page, grid("g2", mapCard, prodCard));
    await flowMap(mapCard.body, fl);
    R.hbar(add(prodCard.body, R.chartBox()), [...groupSum(fl, f => f.cn4, R.measure)].map(([k, v]) =>
      ({ key: k, label: cnName(k), value: v })), { top: 10, onClick: c => R.toggle("cn4", c), selected: S.cn4 });

    add(page, h("h2", { text: t("ov.findings") }));
    const links = ["products", "flows", "flows", "flows", "scenarios", "balance"];
    const fs = h("div", { class: "findings" });
    for (let i = 1; i <= 6; i++) fs.append(h("div", { class: "card finding" },
      h("h3", { text: t(`ov.f${i}.t`) }), h("p", { text: t(`ov.f${i}.p`) }),
      h("a", { href: `#/${links[i - 1]}`, text: t("ov.go"), onclick: e => { e.preventDefault(); R.go(links[i - 1]); } })));
    add(page, fs);
    add(page, h("h2", { text: t("ov.how.t") }), R.callout(t("ov.how.p")));
  } });

  // Flow map shared by overview and flows
  async function flowMap(el, fl) {
    const box = add(el, R.chartBox("tall"));
    const sent = groupSum(fl, f => f.fk, R.measure), recv = groupSum(fl, f => f.tk, R.measure);
    const values = new Map();
    const mode = S.role === "take" ? "recv" : S.role === "give" ? "sent" : "both";
    for (const k of D.kommuner) values.set(k.code, mode === "recv" ? recv.get(k.code) || 0 : mode === "sent" ? sent.get(k.code) || 0
      : (sent.get(k.code) || 0) + (recv.get(k.code) || 0));
    const inter = new Map(), intra = new Map();
    for (const f of fl) {
      if (f.fk === f.tk) intra.set(f.fk, (intra.get(f.fk) || 0) + R.measure(f));
      else { const key = f.fk + ">" + f.tk; const o = inter.get(key) || { from: f.fk, to: f.tk, value: 0, t: 0 };
             o.value += R.measure(f); o.t += f.t; inter.set(key, o); }
    }
    const lines = [...inter.values()].filter(l => l.t >= 100);
    const circles = [...intra].map(([code, value]) => ({ code, value })).filter(c => c.value > 0);
    await R.kommunMap(box, values, { lines, circles, onClick: c => R.toggle("kommun", c),
      label: mode === "recv" ? t("fl.mapcolor.recv") : mode === "sent" ? t("fl.mapcolor.sent") : `${t("fl.mapcolor.sent")} + ${t("fl.mapcolor.recv")}` });
    el.append(h("div", { class: "legend" },
      h("span", {}, h("i", { style: `background:${cssv("--seq-4")}` }), t("fl.mapcolor") + (mode === "recv" ? t("fl.mapcolor.recv") : mode === "sent" ? t("fl.mapcolor.sent") : `${t("fl.mapcolor.sent")} + ${t("fl.mapcolor.recv")}`)),
      h("span", {}, h("i", { style: `background:${cssv("--s2")};height:3px` }), t("exch.X")),
      h("span", {}, h("i", { style: `background:${cssv("--s3")};border-radius:50%` }), t("exch.L"))));
  }

  // ======================= 2. Workers =======================
  R.view("workers", { group: "region", prefix: "wk", async render(page) {
    R.header(page, "workers");
    const W = D.region.workers;
    const c1 = R.card(t("wk.c1"), t("wk.c1.p")), c2 = R.card(t("wk.c2"), t("wk.c2.p"));
    add(page, grid("g2", c1, c2));
    const share = D.region.share_of_sweden;
    R.hbar(add(c1.body, R.chartBox("short")), share.map(r => ({ key: r.family, label: famName(r.family), value: r.workers,
      color: R.famColor(r.family) })), { fmt: v => pct(v), top: 8 });
    const tot = D.region.workers_by_family;
    const totRow = tot.find(r => r.family === "Total") || {};
    c1.body.append(h("p", { class: "small muted", text: (S.lang === "sv" ? "Hela ekonomin: " : "Whole economy: ") +
      pct(totRow.region_share_pct ?? totRow.skaraborg_share_pct) +
      ` · ${num(sum(W, w => w.workers))} ${t("u.workers")}` }));

    // stacked by kommun x family
    const Wf = W.filter(w => R.basicPass(w, { kommun: true }));
    const byK = new Map();
    for (const w of Wf) { const m = byK.get(w.kommun) || {}; m[w.fam] = (m[w.fam] || 0) + w.workers; byK.set(w.kommun, m); }
    const ks = [...byK.keys()].sort((a, b) => sum(Object.values(byK.get(a)), x => x) - sum(Object.values(byK.get(b)), x => x));
    const box2 = add(c2.body, R.chartBox("tall"));
    R.chart(box2, {
      legend: { top: 0, textStyle: { color: cssv("--text-secondary"), fontSize: 11.5 }, itemWidth: 10, itemHeight: 10 },
      grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: v => num(v) },
      xAxis: R.axis({ type: "value" }),
      yAxis: R.axis({ type: "category", data: ks.map(kName), axisLabel: { color: cssv("--text-secondary") } }),
      series: R.famOrder.map(f => ({ name: famName(f), type: "bar", stack: "w", barMaxWidth: 18,
        itemStyle: { color: R.famColor(f), borderColor: cssv("--surface-1"), borderWidth: 1 },
        data: ks.map(k => ({ value: byK.get(k)[f] || 0, itemStyle: { opacity: S.kommun && S.kommun !== k ? 0.4 : 1 } })) }))
    }, p => R.toggle("kommun", ks[p.dataIndex]));

    const c3 = R.card(t("wk.c3"), t("wk.c3.p"));
    const c4 = R.card(t("ui.table"), t("ui.clickhint"));
    add(page, grid("g2", c3, c4));
    const Wk = W.filter(w => w.fam !== "S" && R.basicPass(w, { nace: true }));   // production sectors A–F
    R.hbar(add(c3.body, R.chartBox()), [...groupSum(Wk, w => w.nace4, w => w.workers)].map(([k, v]) =>
      ({ key: k, label: naceName(k), value: v, color: R.famColor(R.familyOf(k)) })),
      { top: 14, fmt: v => num(v), onClick: c => R.toggle("nace", c), selected: S.nace });
    const se = Object.fromEntries(D.region.se_nace4.map(r => [r.nace4, r.workers]));
    R.table(c4.body, [kommunCol(), naceCol(),
      { key: "workers", label: t("col.workers"), num: true, bar: true, fmt: v => num(v) },
      { key: "share", label: S.lang === "sv" ? "Andel av Sverige" : "Share of Sweden", num: true, fmt: v => pct(v) }],
      withNames(W.filter(w => R.basicPass(w)), "kommun").map(r => ({ ...r, share: se[r.nace4] ? 100 * r.workers / se[r.nace4] : null })),
      { sort: "workers", page: 12, filename: "workers", onRow: r => R.set({ kommun: r.kommun, nace: r.nace4 }) });
    add(page, R.callout(t("wk.note")));
  } });

  // ======================= 3. Domestic extraction =======================
  R.view("extraction", { group: "region", prefix: "de", async render(page) {
    R.header(page, "extraction");
    const DE = D.region.de;
    const val = r => S.unit === "t" ? r.tons : r.msek * 1e6;
    const all = DE.filter(r => R.basicPass(r));
    add(page, grid("g3",
      R.stat(S.lang === "sv" ? "Utvinning (urval)" : "Extraction (selection)", fmtT(sum(all, r => r.tons))),
      R.stat(S.lang === "sv" ? "Värde" : "Value", fmtSEK(sum(all, r => r.msek * 1e6))),
      R.stat(S.lang === "sv" ? "Sten och grus" : "Stone and gravel", fmtT(sum(all.filter(r => R.CN_NST[r.cn4] === "03a"), r => r.tons)))));
    const c1 = R.card(t("de.c1")), c2 = R.card(t("de.c2"));
    add(page, grid("g2", c1, c2));
    R.hbar(add(c1.body, R.chartBox()), [...groupSum(DE.filter(r => R.basicPass(r, { cn4: true })), r => r.cn4, val)]
      .map(([k, v]) => ({ key: k, label: cnName(k), value: v })), { top: 12, onClick: c => R.toggle("cn4", c), selected: S.cn4 });
    await R.kommunMap(add(c2.body, R.chartBox("tall")), groupSum(DE.filter(r => R.basicPass(r, { kommun: true })), kommunCode, val),
      { onClick: c => R.toggle("kommun", c) });
    const c3 = add(page, R.card(t("de.c3"), t("ui.clickhint")));
    R.table(c3.body, [kommunCol(), { key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) }, naceCol(),
      { key: "tons", label: t("col.tons"), num: true, bar: true, fmt: v => num(v) },
      { key: "msek", label: t("col.msek"), num: true, fmt: v => num(v, 2) }],
      withNames(all, "kommun"), { sort: S.unit === "t" ? "tons" : "msek", filename: "domestic_extraction",
        onRow: r => R.set({ cn4: r.cn4 }) });
    add(page, R.callout(t("de.note")));
  } });

  // ======================= 4. Material balance =======================
  R.view("balance", { group: "region", prefix: "bal", async render(page) {
    R.header(page, "balance");
    const sek = S.unit === "sek";
    const T = Object.fromEntries(D.region.totals.map(r => [r.item, r]));
    const tv = name => { const r = Object.entries(T).find(([k]) => k.toLowerCase().startsWith(name)); return r ? r[1] : {}; };
    const tile = (label, r) => R.stat(label, sek ? fmtSEK((r.MSEK || 0) * 1e6) : fmtT((r.Mt || 0) * 1e6));
    add(page, grid("g4", tile(t("col.de"), tv("domestic")), tile(t("col.imports"), tv("imports")),
      tile(t("col.inflow"), tv("inflow")), tile(t("col.use"), tv("apparent"))));
    add(page, h("p", { class: "small muted", text: S.lang === "sv"
      ? "Materialbalansen gäller hela regionen; kommun- och branschfilter påverkar den inte." : "The balance is for the whole region; kommun and industry filters do not apply." }));

    const B = D.region.balance_nst.filter(r => r.material && r.nst);
    const c1 = add(page, R.card(t("bal.c1"), t("bal.c1.p")));
    const k = sek ? ["de_msek", "imports_msek", "inflow_msek", "outflow_msek", "use_msek"] : ["de", "imports", "inflow", "outflow", "use"];
    const f = sek ? 1e6 : 1;
    const nsts = B.sort((a, b) => (a[k[4]] || 0) - (b[k[4]] || 0));
    const pal = R.palette();
    const box = add(c1.body, R.chartBox("xl"));
    R.chart(box, {
      legend: { top: 0, textStyle: { color: cssv("--text-secondary"), fontSize: 11.5 }, itemWidth: 10, itemHeight: 10 },
      grid: { left: 8, right: 20, top: 40, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: v => fmtM(Math.abs(v) * f) },
      xAxis: R.axis({ type: "value", axisLabel: { formatter: v => fmtM(v * f).replace(/ .*/, "") } }),
      yAxis: R.axis({ type: "category", data: nsts.map(r => nstName(r.nst)), axisLabel: { color: cssv("--text-secondary") } }),
      series: [
        { name: t("col.de"), type: "bar", stack: "in", data: nsts.map(r => r[k[0]] || 0), itemStyle: { color: pal[5] }, barMaxWidth: 16 },
        { name: t("col.imports"), type: "bar", stack: "in", data: nsts.map(r => r[k[1]] || 0), itemStyle: { color: pal[0] } },
        { name: t("col.inflow"), type: "bar", stack: "in", data: nsts.map(r => r[k[2]] || 0), itemStyle: { color: pal[2] } },
        { name: t("col.outflow"), type: "bar", stack: "in", data: nsts.map(r => -(r[k[3]] || 0)), itemStyle: { color: pal[1] } },
        { name: t("col.use"), type: "scatter", symbol: "diamond", symbolSize: 12, data: nsts.map(r => r[k[4]] || 0),
          itemStyle: { color: cssv("--text-primary") }, z: 5 }
      ]
    });
    const c2 = R.card(t("bal.c2"), t("bal.c2.p")), c3 = R.card(t("bal.c3"));
    add(page, grid("g2", c2, c3));
    const P = groupSum(D.region.partners.filter(r => r.flow === "in"), r => r.partner, r => r.tons);
    const O = groupSum(D.region.partners.filter(r => r.flow === "out"), r => r.partner, r => r.tons);
    const partners = [...new Set([...P.keys(), ...O.keys()])].sort((a, b) => ((P.get(a) || 0) + (O.get(a) || 0)) - ((P.get(b) || 0) + (O.get(b) || 0)));
    R.chart(add(c2.body, R.chartBox("tall")), {
      legend: { top: 0, textStyle: { color: cssv("--text-secondary"), fontSize: 11.5 }, itemWidth: 10, itemHeight: 10 },
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: v => fmtT(v) },
      xAxis: R.axis({ type: "value", axisLabel: { formatter: v => num(v / 1e3) + " kt" } }),
      yAxis: R.axis({ type: "category", data: partners, axisLabel: { color: cssv("--text-secondary") } }),
      series: [{ name: S.lang === "sv" ? "In" : "In", type: "bar", data: partners.map(p => P.get(p) || 0), itemStyle: { color: pal[0] }, barMaxWidth: 12 },
               { name: S.lang === "sv" ? "Ut" : "Out", type: "bar", data: partners.map(p => O.get(p) || 0), itemStyle: { color: pal[1] }, barMaxWidth: 12 }]
    });
    const C = D.region.balance_cn4.filter(r => !r.final && R.basicPass(r, { kommun: true, nace: true }));
    R.hbar(add(c3.body, R.chartBox()), C.map(r => ({ key: r.cn4, label: cnName(r.cn4), value: sek ? r.use_msek * 1e6 : r.use })),
      { top: 12, onClick: c => R.toggle("cn4", c), selected: S.cn4 });
    const c4 = add(page, R.card(t("ui.table")));
    R.table(c4.body, [{ key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) },
      { key: "nst_name", label: "NST", fmt: (v, r) => nstName(r.nst) },
      ...["de", "imports", "inflow", "outflow", "use"].map(x => ({ key: x, label: t("col." + x), num: true, fmt: v => num(v) })),
      { key: "use_msek", label: t("col.msek"), num: true, fmt: v => num(v, 1) }],
      C.map(r => ({ ...r, nst_name: nstName(r.nst) })), { sort: sek ? "use_msek" : "use", filename: "material_balance", onRow: r => R.set({ cn4: r.cn4 }) });
    add(page, R.callout(t("bal.note")));
  } });

  // ======================= 5. Waste =======================
  R.view("waste", { group: "metab", prefix: "w", async render(page) {
    R.header(page, "waste");
    add(page, R.callout(t("w.warn"), true));
    const fl = await R.flows();
    const Wd = D.waste.filter(w => R.wastePass(w, fl));
    const used = sum((await R.curFlows()).filter(f => R.flowPass(f)), f => f.t);
    add(page, grid("g3",
      R.stat(t("w.title"), fmtT(sum(Wd, w => w.tons)), `95 % CI ${fmtT(sum(Wd, w => w.lo))} – ${fmtT(sum(Wd, w => w.hi))}`),
      R.stat(S.lang === "sv" ? "Varav utbytt i modellen" : "Of which exchanged in the model", fmtT(used),
        pct(100 * used / Math.max(1, sum(Wd, w => w.tons)))),
      R.stat(S.lang === "sv" ? "Avfallskoder" : "Waste codes", num(new Set(Wd.map(w => w.low)).size))));
    add(page, unitNote());
    const c1 = R.card(t("w.c1"), t("w.c1.p")), c2 = R.card(t("w.c2"));
    add(page, grid("g2", c1, c2));
    R.hbar(add(c1.body, R.chartBox()), [...groupSum(D.waste.filter(w => R.wastePass(w, fl, { low: true })), w => w.low.slice(0, 2), w => w.tons)]
      .map(([k, v]) => ({ key: k, label: `${k} ${lowName(k)}`, value: v })),
      { top: 14, fmt: fmtT, onClick: c => R.toggle("low", c), selected: S.low.slice(0, 2) });
    await R.kommunMap(add(c2.body, R.chartBox("tall")), groupSum(D.waste.filter(w => R.wastePass(w, fl, { kommun: true })), kommunCode, w => w.tons),
      { fmt: fmtT, onClick: c => R.toggle("kommun", c) });
    const c3 = R.card(t("w.c3"), t("ui.clickhint")), c4 = R.card(t("w.c4"));
    add(page, grid("g2", c3, c4));
    R.hbar(add(c3.body, R.chartBox()), [...groupSum(D.waste.filter(w => R.wastePass(w, fl, { nace: true })), w => w.nace4.slice(0, 2), w => w.tons)]
      .map(([k, v]) => ({ key: k, label: `${k} ${naceName(k)}`, value: v, color: R.famColor(R.familyOf(k + "00")) })),
      { top: 14, fmt: fmtT, onClick: c => R.toggle("nace", c), selected: S.nace.slice(0, 2) });
    const agg = new Map();
    for (const w of Wd) { const key = w.low + "|" + w.nace4; const o = agg.get(key) || { low: w.low, nace4: w.nace4, tons: 0, lo: 0, hi: 0, n: new Set() };
      o.tons += w.tons; o.lo += w.lo; o.hi += w.hi; o.n.add(w.kommun); agg.set(key, o); }
    R.table(c4.body, [{ key: "low", label: t("col.low"), wrap: true, code: r => lowCode(r.low), fmt: v => lowName(v) }, naceCol(),
      { key: "tons", label: t("col.tons"), num: true, bar: true, fmt: v => num(v) },
      { key: "lo", label: t("col.lo"), num: true, fmt: v => num(v) }, { key: "hi", label: t("col.hi"), num: true, fmt: v => num(v) },
      { key: "nk", label: S.lang === "sv" ? "Kommuner" : "Kommuner", num: true, fmt: v => num(v) }],
      [...agg.values()].map(o => ({ ...o, nk: o.n.size })), { sort: "tons", page: 10, filename: "waste",
        onRow: r => R.set({ low: r.low }) });
  } });

  // ======================= 6. Inputs =======================
  R.view("inputs", { group: "metab", prefix: "in", async render(page) {
    R.header(page, "inputs");
    const fl = await R.flows();
    const val = i => S.unit === "t" ? i.tons : i.sek;
    const I = D.inputs.filter(i => R.inputPass(i, fl));
    const covered = (await R.curFlows()).filter(f => R.flowPass(f));
    add(page, grid("g3",
      R.stat(t("in.title"), fmtT(sum(I, i => i.tons)), fmtSEK(sum(I, i => i.sek))),
      R.stat(S.lang === "sv" ? "Kan ersättas av lokalt avfall" : "Could be replaced by local waste", fmtT(sum(covered, f => f.t)),
        pct(100 * sum(covered, f => f.t) / Math.max(1, sum(I, i => i.tons)), 0)),
      R.stat(S.lang === "sv" ? "Värde som kan ersättas" : "Value that could be replaced", fmtSEK(sum(covered, f => f.sek)),
        pct(100 * sum(covered, f => f.sek) / Math.max(1, sum(I, i => i.sek)), 0))));
    const c1 = R.card(t("in.c1"), t("in.c1.p")), c2 = R.card(t("in.c2"));
    add(page, grid("g2", c1, c2));
    R.hbar(add(c1.body, R.chartBox()), [...groupSum(D.inputs.filter(i => R.inputPass(i, fl, { cn4: true })), i => i.cn4, val)]
      .map(([k, v]) => ({ key: k, label: cnName(k), value: v })), { top: 14, onClick: c => R.toggle("cn4", c), selected: S.cn4 });
    await R.kommunMap(add(c2.body, R.chartBox("tall")), groupSum(D.inputs.filter(i => R.inputPass(i, fl, { kommun: true })), kommunCode, val),
      { onClick: c => R.toggle("kommun", c) });
    const c3 = R.card(t("in.c3"), t("ui.clickhint")), c4 = R.card(t("ui.table"));
    add(page, grid("g2", c3, c4));
    R.hbar(add(c3.body, R.chartBox()), [...groupSum(D.inputs.filter(i => R.inputPass(i, fl, { nace: true })), i => i.nace4, val)]
      .map(([k, v]) => ({ key: k, label: naceName(k), value: v, color: R.famColor(R.familyOf(k)) })),
      { top: 12, onClick: c => R.toggle("nace", c), selected: S.nace });
    R.table(c4.body, [kommunCol(), naceCol(), { key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) },
      { key: "tons", label: t("col.tons"), num: true, bar: S.unit === "t", fmt: v => num(v) },
      { key: "msek", label: t("col.msek"), num: true, bar: S.unit === "sek", fmt: v => num(v, 2) },
      { key: "sekt", label: t("col.sekt"), num: true, fmt: v => num(v) }],
      withNames(I, "kommun").map(i => ({ ...i, msek: i.sek / 1e6, sekt: i.tons > 0 ? i.sek / i.tons : null })),
      { sort: S.unit === "t" ? "tons" : "msek", page: 10, filename: "imported_inputs", onRow: r => R.set({ cn4: r.cn4 }) });
    add(page, R.callout(t("in.note")));
  } });

  // ======================= 7. Flows =======================
  R.view("flows", { group: "sym", prefix: "fl", async render(page) {
    R.header(page, "flows");
    const all = await R.curFlows();
    const fl = all.filter(f => R.flowPass(f));
    const tt = sum(fl, f => f.t), vv = sum(fl, f => f.sek), loc = sum(fl.filter(f => f.st === "L"), f => f.t);
    add(page, grid("g4", R.stat(t("fl.k.t"), fmtT(tt)), R.stat(t("fl.k.v"), fmtSEK(vv), `${num(tt ? vv / tt : 0)} ${t("col.sekt")}`),
      R.stat(t("fl.k.l"), pct(tt ? 100 * loc / tt : 0, 0), fmtT(loc)), R.stat(t("fl.k.n"), num(fl.length))));
    const c1 = R.card(t("fl.c1"), t("fl.c1.p")), cp = R.card(t("pr.c1"), t("pr.c1.p"));
    add(page, grid("g2", c1, cp));
    await flowMap(c1.body, fl);
    R.hbar(add(cp.body, R.chartBox()), [...groupSum(fl, f => f.cn4, R.measure)].map(([k, v]) => ({ key: k, label: cnName(k), value: v })),
      { top: 12, onClick: c => R.toggle("cn4", c), selected: S.cn4 });
    const c2 = add(page, R.card(t("fl.c2"), t("fl.c2.p")));
    c2.style.marginTop = "16px";
    // Sankey: giving sector -> waste chapter -> product -> taking sector (small groups folded into "Other")
    const top = (key, n) => new Set([...groupSum(fl, key, R.measure)].sort((a, b) => b[1] - a[1]).slice(0, n).map(d => d[0]));
    const topP = top(f => f.cn4, 10), topW = top(f => f.low.slice(0, 2), 8);
    const links = new Map(), labels = {}, colors = {};
    const link = (a, b, v) => { const k = a + "→" + b; links.set(k, (links.get(k) || 0) + v); };
    for (const f of fl) {
      const wc = f.low.slice(0, 2);
      const g = "g:" + R.familyOf(f.fn), w = "w:" + (topW.has(wc) ? wc : "other"), p = "p:" + (topP.has(f.cn4) ? f.cn4 : "other"), r = "r:" + R.familyOf(f.tn);
      const v = R.measure(f); link(g, w, v); link(w, p, v); link(p, r, v);
      labels[g] = famName(g.slice(2)); labels[r] = famName(r.slice(2)) + " ";
      labels[w] = w === "w:other" ? t("ui.other") + " " : lowName(wc); labels[p] = p === "p:other" ? t("ui.other") : cnName(f.cn4);
      colors[g] = R.famColor(g.slice(2)); colors[r] = R.famColor(r.slice(2));
      colors[w] = w === "w:other" ? cssv("--other") : cssv("--s7"); colors[p] = p === "p:other" ? cssv("--other") : cssv("--s1");
    }
    R.sankey(add(c2.body, R.chartBox("xl")), [...links].filter(([, v]) => v > 0).map(([k, v]) => { const [s, tg] = k.split("→"); return { source: s, target: tg, value: v }; }),
      labels, colors, { onClick: n => { if (n.startsWith("w:") && n !== "w:other") R.toggle("low", n.slice(2)); else if (n.startsWith("p:") && n !== "p:other") R.toggle("cn4", n.slice(2)); } });
    c2.body.append(h("p", { class: "small muted", text: S.lang === "sv" ? "Klicka på en avfallstyp eller produkt för att filtrera." : "Click a waste type or product to filter." }));

    const c3 = add(page, R.card(t("fl.c3"), t("ui.clickhint")));
    const agg = new Map();
    for (const f of fl) { const key = [f.fk, f.fn, f.low, f.tk, f.tn, f.cn4, f.st].join("|");
      const o = agg.get(key) || { ...f, t: 0, sek: 0 }; o.t += f.t; o.sek += f.sek; agg.set(key, o); }
    R.table(c3.body, [
      { key: "fk_name", label: t("col.from"), fmt: (v, r) => kName(r.fk) },
      { key: "fn", label: t("col.giver"), wrap: true, code: r => r.fn, fmt: v => naceName(v) },
      { key: "low", label: t("col.low"), wrap: true, code: r => lowCode(r.low), fmt: v => lowName(v) },
      { key: "tk_name", label: t("col.to"), fmt: (v, r) => kName(r.tk) },
      { key: "tn", label: t("col.taker"), wrap: true, code: r => r.tn, fmt: v => naceName(v) },
      { key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) },
      { key: "t", label: t("col.tons"), num: true, bar: S.unit === "t", fmt: v => num(v) },
      { key: "msek", label: t("col.msek"), num: true, bar: S.unit === "sek", fmt: v => num(v, 2) },
      { key: "st", label: t("col.exch"), fmt: v => t("exch." + v) }],
      withNames([...agg.values()].map(o => ({ ...o, msek: o.sek / 1e6 })), "fk", "tk"),
      { sort: S.unit === "t" ? "t" : "msek", page: 15, filename: `flows_${S.scenario}_${S.regime}`,
        onRow: r => R.set({ cn4: r.cn4, low: r.low }) });
  } });

  // ======================= 8. Products =======================
  R.view("products", { group: "sym", prefix: "pr", async render(page) {
    R.header(page, "products");
    const fs = await R.flows();
    const all = await R.curFlows();
    const fl = all.filter(f => R.flowPass(f, { cn4: true }));
    const c1 = R.card(t("pr.c1"), t("pr.c1.p")), c2 = R.card(t("pr.c2"), t("pr.c2.p"));
    add(page, grid("g2", c1, c2));
    R.hbar(add(c1.body, R.chartBox()), [...groupSum(fl, f => f.cn4, R.measure)].map(([k, v]) => ({ key: k, label: cnName(k), value: v })),
      { top: 14, onClick: c => R.toggle("cn4", c), selected: S.cn4 });
    const P = new Map();
    for (const f of fl) { const o = P.get(f.cn4) || { t: 0, sek: 0 }; o.t += f.t; o.sek += f.sek; P.set(f.cn4, o); }
    const pts = [...P].filter(([, o]) => o.t > 1 && o.sek > 0).map(([k, o]) => ({ k, t: o.t, m: o.sek / 1e6, p: o.sek / o.t }));
    const pmax = Math.max(1, ...pts.map(d => d.p));
    const topLab = new Set(pts.slice().sort((a, b) => b.m - a.m).slice(0, 6).map(d => d.k).concat(pts.slice().sort((a, b) => b.t - a.t).slice(0, 3).map(d => d.k)));
    R.chart(add(c2.body, R.chartBox("tall")), {
      grid: { left: 8, right: 110, top: 16, bottom: 30, containLabel: true },
      xAxis: R.axis({ type: "log", name: t("col.tons"), nameLocation: "middle", nameGap: 24, nameTextStyle: { color: cssv("--text-muted") } }),
      yAxis: R.axis({ type: "log", name: t("col.msek"), nameTextStyle: { color: cssv("--text-muted") } }),
      tooltip: { trigger: "item", formatter: p => { const d = pts[p.dataIndex];
        return `<b>${fmtT(d.t)} · ${fmtSEK(d.m * 1e6)}</b><br>${esc(cnName(d.k))}<br>${num(d.p)} ${t("col.sekt")}`; } },
      series: [{ type: "scatter", data: pts.map(d => [d.t, d.m]), symbolSize: (v, p) => 8 + 26 * Math.sqrt(pts[p.dataIndex].p / pmax),
        itemStyle: { color: cssv("--s1"), opacity: 0.75, borderColor: cssv("--surface-1"), borderWidth: 2 },
        label: { show: true, formatter: p => topLab.has(pts[p.dataIndex].k) ? R.trunc(cnName(pts[p.dataIndex].k), 22) : "",
                 position: "right", fontSize: 11, color: cssv("--text-secondary") } }]
    }, p => R.toggle("cn4", pts[p.dataIndex].k));

    // why waste stays unused (region-wide, by waste code)
    const Wd = D.waste.filter(w => R.wastePass(w, fs, { cn4: true }));
    const avail = groupSum(Wd, w => w.low, w => w.tons);
    // waste used, counted on the giving side so it matches the waste filtered above
    const usedL = groupSum(all.filter(f => (!S.kommun || f.fk === S.kommun) && (f.fn || "").startsWith(S.nace) &&
      (f.low || "").startsWith(S.low)), f => f.low, f => f.t);
    const demandC = new Set(D.inputs.map(i => i.cn4));
    const statusRows = [];
    for (const [low, tons] of avail) {
      const rem = tons - (usedL.get(low) || 0); if (rem < 1) continue;
      const cns = [...(fs.byLow.get(low) || [])];
      const status = !cns.length ? "no_match" : cns.some(c => demandC.has(c)) ? "partial" : "no_demand";
      statusRows.push({ low, rem, status, cns: cns.slice(0, 4).map(cnName).join("; ") });
    }
    const c3 = R.card(t("pr.c3"), t("pr.c3.p")), c4 = R.card(t("pr.c4"), t("pr.c4.p"));
    add(page, grid("g2", c3, c4));
    const sc = { partial: R.palette()[0], no_demand: R.palette()[1], no_match: cssv("--other") };
    R.hbar(add(c3.body, R.chartBox("short")), ["partial", "no_demand", "no_match"].map(s => ({ key: s, label: t("pr.status." + s),
      value: sum(statusRows.filter(r => r.status === s), r => r.rem), color: sc[s] })), { fmt: fmtT });
    R.table(c3.body, [{ key: "low", label: t("col.low"), wrap: true, code: r => lowCode(r.low), fmt: v => lowName(v) },
      { key: "rem", label: S.lang === "sv" ? "Oanvänt (t)" : "Unused (t)", num: true, bar: true, fmt: v => num(v) },
      { key: "status", label: t("col.status"), fmt: v => t("pr.status." + v) },
      { key: "cns", label: S.lang === "sv" ? "Kompatibla produkter" : "Compatible products", wrap: true }],
      statusRows, { sort: "rem", page: 8, filename: "unused_waste", onRow: r => R.set({ low: r.low }) });

    // product opportunities: demand, covered, compatible waste
    const I = D.inputs.filter(i => R.inputPass(i, fs, { cn4: true }));
    const dem = new Map();
    for (const i of I) { const o = dem.get(i.cn4) || { cn4: i.cn4, demand: 0, dsek: 0 }; o.demand += i.tons; o.dsek += i.sek; dem.set(i.cn4, o); }
    const cov = groupSum(all.filter(f => R.flowPass(f, { cn4: true })), f => f.cn4, f => f.t);
    const wasteAll = groupSum(D.waste.filter(w => R.wastePass(w, fs, { cn4: true, kommun: true, nace: true })), w => w.low, w => w.tons);
    const opp = [...dem.values()].filter(o => fs.byCn.has(o.cn4)).map(o => {
      const covered = cov.get(o.cn4) || 0;
      const wa = sum([...(fs.byCn.get(o.cn4) || [])], l => wasteAll.get(l) || 0);
      return { ...o, dmsek: o.dsek / 1e6, covered, gap: Math.max(0, o.demand - covered), pctc: o.demand ? 100 * covered / o.demand : 0, wa };
    });
    R.table(c4.body, [{ key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) },
      { key: "demand", label: t("col.demand"), num: true, fmt: v => num(v) },
      { key: "dmsek", label: t("col.msek"), num: true, fmt: v => num(v, 1) },
      { key: "covered", label: t("col.covered"), num: true, bar: true, fmt: v => num(v) },
      { key: "pctc", label: t("col.covered_pct"), num: true, fmt: v => pct(v, 0) },
      { key: "gap", label: t("col.gap"), num: true, fmt: v => num(v) },
      { key: "wa", label: t("col.waste_avail"), num: true, fmt: v => num(v) }],
      opp, { sort: S.unit === "t" ? "covered" : "dmsek", page: 12, filename: "product_opportunities", onRow: r => R.set({ cn4: r.cn4 }) });
    add(page, R.callout(t("pr.note")));
  } });

  // ======================= 9. Scenarios =======================
  R.view("scenarios", { group: "sym", prefix: "sc", async render(page, stale) {
    R.header(page, "scenarios");
    add(page, R.callout(t("sc.rank")));
    const c1 = add(page, R.card(t("sc.c1")));
    const scales = ["region", "intra", "kommun", "firm_bu", "firm_td"];
    const pal = R.palette();
    const SC = R.SCENARIOS;
    R.chart(add(c1.body, R.chartBox("tall")), {
      legend: { top: 0, textStyle: { color: cssv("--text-secondary"), fontSize: 11.5 }, itemWidth: 10, itemHeight: 10 },
      grid: { left: 8, right: 16, top: 56, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: v => S.unit === "t" ? fmtT(v) : fmtSEK(v) },
      xAxis: R.axis({ type: "category", data: scales.map(s => t("scale." + s)), axisLabel: { color: cssv("--text-secondary"), interval: 0, fontSize: 11 } }),
      yAxis: R.axis({ type: "value", axisLabel: { formatter: v => S.unit === "t" ? num(v / 1e3) + " kt" : num(v / 1e6) } }),
      series: SC.map((s, i) => ({ name: t("sc." + s), type: "bar", barMaxWidth: 14,
        itemStyle: { color: pal[i], borderRadius: [3, 3, 0, 0] },
        data: scales.map(sc => { const r = kpi(s, sc); return S.unit === "t" ? r.allocated_t : (r.replaced_value_msek || 0) * 1e6; }) }))
    });
    const c2 = R.card(t("sc.c2")), c4 = R.card(t("sc.c4"));
    add(page, grid("g2", c2, c4));
    R.hbar(add(c2.body, R.chartBox()), SC.map((s, i) => ({ key: s, label: t("sc." + s), value: (kpi(s).replaced_value_msek || 0) * 1e6, color: pal[i] })),
      { fmt: fmtSEK, onClick: s => R.set({ scenario: s }), selected: S.scenario });
    const bs = D.kpis.by_source.filter(r => r.scenario === S.scenario && r.regime === S.regime && r.scale === scaleKey.kommun);
    const srcName = { maestri: "MAESTRI", w2rkg: "W2RKG", "maestri+w2rkg": "MAESTRI + W2RKG" };
    R.hbar(add(c4.body, R.chartBox("short")), bs.map((r, i) => ({ key: r.source, label: srcName[r.source] || r.source,
      value: S.unit === "t" ? r.tons : r.value_msek * 1e6, color: pal[i] })), {});
    c4.body.append(h("p", { class: "small muted", text: t("sc." + S.scenario) }));

    const c3 = add(page, R.card(t("sc.c3")));
    const all = await Promise.all(SC.map(s => R.flows(s)));
    if (stale()) return;
    const byS = SC.map((s, i) => groupSum(all[i][S.regime].filter(f => R.flowPass(f, { cn4: true })), f => f.cn4, R.measure));
    const cns = new Set(); byS.forEach(m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k]) => cns.add(k)));
    R.table(c3.body, [{ key: "cn4", label: t("col.cn4"), wrap: true, code: r => r.cn4, fmt: v => cnName(v) },
      ...SC.map(s => ({ key: s, label: t("sc." + s).split(/[:(]/)[0].trim(), num: true, fmt: v => v ? (S.unit === "t" ? num(v / 1e3, 1) + " kt" : num(v / 1e6, 1)) : "–" }))],
      [...cns].map(c => Object.assign({ cn4: c }, ...SC.map((s, i) => ({ [s]: byS[i].get(c) || 0 })))),
      { sort: S.scenario, page: 15, filename: "products_by_database", onRow: r => R.set({ cn4: r.cn4 }) });

    const c5 = add(page, R.card(S.lang === "sv" ? "Mot regionens totala materialanvändning" : "Against total regional material use",
      t("sc.c5.p")));
    const dbl = { baseline: t("sc.baseline"), w2rkg_reviewed: t("sc.w2rkg_reviewed"), all_sources: t("sc.all_sources") };
    R.table(c5.body, [{ key: "db", label: t("f.scenario") }, { key: "wl", label: S.lang === "sv" ? "Avfall" : "Waste" },
      { key: "allocated_kt", label: "kt", num: true, fmt: v => num(v) },
      { key: "use_substituted_mass_pct", label: S.lang === "sv" ? "Användning ersatt (ton)" : "Use substituted (mass)", num: true, fmt: v => pct(v) },
      { key: "value_msek", label: t("col.msek"), num: true, fmt: v => num(v) }],
      D.kpis.total_use.map(r => ({ ...r, db: dbl[r.database] || r.database,
        wl: r.waste === "all" ? (S.lang === "sv" ? "allt" : "all") : (S.lang === "sv" ? "utan täktavfall" : "without quarry waste") })),
      { sort: "allocated_kt", page: 10, filename: "total_use", search: false });
  } });

  // ======================= Sub-regions (county sites only: RIS_CONFIG.subregions) =======================
  if (window.RIS_CONFIG && window.RIS_CONFIG.subregions) R.view("subregions", { group: "sym", prefix: "sr", after: "scenarios", async render(page) {
    R.header(page, "subregions");
    const sm = (D.kpis.subregions || []).filter(r => r.scenario === S.scenario && r.regime === S.regime);
    const ex = (D.kpis.subregion_exchanges || []).filter(r => r.scenario === S.scenario && r.regime === S.regime &&
                                                             r.scale === scaleKey.kommun);
    if (!sm.length) { add(page, R.callout(t("sr.none"))); return; }
    const pal = R.palette();
    const c1 = add(page, R.card(t("sr.c1"), t("sr.c1.p")));
    const subs = sm.slice().sort((a, b) => a.waste_t - b.waste_t).map(r => r.subregion);
    const by = Object.fromEntries(sm.map(r => [r.subregion, r]));
    R.chart(add(c1.body, R.chartBox()), {
      legend: { top: 0, textStyle: { color: cssv("--text-secondary"), fontSize: 11.5 }, itemWidth: 10, itemHeight: 10 },
      grid: { left: 8, right: 24, top: 40, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: v => pct(v) },
      xAxis: R.axis({ type: "value", axisLabel: { formatter: v => v + " %" } }),
      yAxis: R.axis({ type: "category", data: subs, axisLabel: { color: cssv("--text-secondary") } }),
      series: [["alone_allocation_pct", t("sr.alone")], ["region_allocation_pct", t("sr.county")]].map(([k, nm], i) => ({
        name: nm, type: "bar", barMaxWidth: 16, itemStyle: { color: pal[i === 0 ? 2 : 0], borderRadius: [0, 3, 3, 0] },
        data: subs.map(s => by[s][k]) }))
    });
    const c2 = add(page, R.card(t("sr.c2"), t("sr.c2.p")));
    R.table(c2.body, [{ key: "subregion", label: t("sr.col.sub") },
      { key: "waste_t", label: t("sr.col.waste"), num: true, fmt: v => fmtT(v) },
      { key: "inputs_t", label: t("sr.col.inputs"), num: true, fmt: v => fmtT(v) },
      { key: "alone_t", label: t("sr.alone"), num: true, fmt: v => fmtT(v) },
      { key: "region_within_t", label: t("sr.col.within"), num: true, fmt: v => fmtT(v) },
      { key: "region_exported_t", label: t("sr.col.out"), num: true, fmt: v => fmtT(v) },
      { key: "region_imported_t", label: t("sr.col.in"), num: true, fmt: v => fmtT(v) },
      { key: "region_substitution_mass_pct", label: t("sr.col.subst"), num: true, fmt: v => pct(v) }],
      sm, { sort: "waste_t", page: 10, filename: "subregions", search: false });
    const c3 = add(page, R.card(t("sr.c3"), t("sr.c3.p")));
    R.table(c3.body, [{ key: "from_subregion", label: t("sr.col.from") }, { key: "to_subregion", label: t("sr.col.to") },
      { key: "tons", label: "t", num: true, fmt: v => fmtT(v) },
      { key: "value_msek", label: t("col.msek"), num: true, fmt: v => num(v, 1) }],
      ex, { sort: "tons", page: 16, filename: "subregion_exchanges", search: false });
  } });

  // ======================= 10. Industries =======================
  R.view("industries", { group: "opp", prefix: "ind", async render(page) {
    R.header(page, "industries");
    const fl = (await R.curFlows()).filter(f => R.flowPass(f, { kommun: true, nace: true }));
    const cell = new Map();
    const get = (k, n) => { const key = k + "|" + n; let o = cell.get(key);
      if (!o) { o = { kommun: k, nace4: n, gt: 0, gv: 0, rt: 0, rv: 0 }; cell.set(key, o); } return o; };
    for (const f of fl) { const g = get(f.fk, f.fn); g.gt += f.t; g.gv += f.sek / 1e6; const r = get(f.tk, f.tn); r.rt += f.t; r.rv += f.sek / 1e6; }
    const firms = new Map(D.firms.map(f => [f.kommun + "|" + f.nace4, f]));
    let rowsI = [...cell.values()].map(o => {
      const f = firms.get(o.kommun + "|" + o.nace4) || {};
      const role = o.gt >= 1 && o.rt >= 1 ? "both" : o.gt >= 1 ? "give" : "take";
      return { ...o, role, firms: f.firms || 0, size: f.firms ? `${f.size_small} / ${f.size_mid} / ${f.size_large}` : "–",
               score: S.unit === "t" ? o.gt + o.rt : o.gv + o.rv };
    }).filter(o => o.gt + o.rt >= 1);
    rowsI = rowsI.filter(o => (!S.kommun || o.kommun === S.kommun) && (!S.nace || o.nace4.startsWith(S.nace)) &&
      (S.role === "any" || (S.role === "give" ? o.gt >= 1 : o.rt >= 1)));
    const c1 = add(page, R.card(t("ind.c1"), t("ui.clickhint")));
    R.table(c1.body, [kommunCol(), naceCol(),
      { key: "role", label: t("col.role"), fmt: v => t(`role.${v}.tag`) },
      { key: "gt", label: t("col.given"), num: true, bar: S.unit === "t", fmt: v => num(v) },
      { key: "gv", label: t("col.given_v"), num: true, fmt: v => num(v, 2) },
      { key: "rt", label: t("col.taken"), num: true, bar: S.unit === "t", fmt: v => num(v) },
      { key: "rv", label: t("col.taken_v"), num: true, fmt: v => num(v, 2) },
      { key: "firms", label: t("ind.firms"), num: true, fmt: v => v ? num(v) : "–" },
      { key: "size", label: t("ind.size"), num: true }],
      withNames(rowsI, "kommun"), { sort: "score", page: 20, filename: "industries_to_contact",
        onRow: r => { R.set({ kommun: r.kommun, nace: r.nace4 }); R.go("directory"); } });
    c1.body.append(h("p", { class: "small muted", text: t("ind.privacy") }));

    // heatmap NACE2 x kommun: given (+) / taken (−)
    const c2 = add(page, R.card(t("ind.c2"), t("ind.c2.p")));
    const net = new Map();
    for (const f of fl) { const v = R.measure(f);
      const a = f.fk + "|" + f.fn.slice(0, 2), b = f.tk + "|" + f.tn.slice(0, 2);
      net.set(a, (net.get(a) || 0) + v); net.set(b, (net.get(b) || 0) - v); }
    // rows with real activity only; colour on a square-root scale so smaller cells stay visible
    const rowAbs = groupSum([...net], ([k]) => k.split("|")[1], ([, v]) => Math.abs(v));
    const thr = S.unit === "t" ? 50 : 50000;
    const n2 = [...rowAbs].filter(([, v]) => v >= thr).map(([n]) => n).sort();
    const ks = D.kommuner.map(k => k.code);
    const sq = v => Math.sign(v) * Math.sqrt(Math.abs(v));
    const data = []; let mx = 1;
    for (const [k, v] of net) { const [km, n] = k.split("|"); if (Math.abs(v) < 1 || !n2.includes(n)) continue;
      data.push([ks.indexOf(km), n2.indexOf(n), sq(v), v]); mx = Math.max(mx, Math.abs(sq(v))); }
    const box = add(c2.body, R.chartBox());
    box.style.height = Math.max(300, n2.length * 22 + 90) + "px";
    R.chart(box, {
      grid: { left: 8, right: 16, top: 8, bottom: 60, containLabel: true },
      xAxis: R.axis({ type: "category", data: ks.map(kName), axisLabel: { rotate: 40, color: cssv("--text-secondary"), fontSize: 11 }, splitArea: { show: false } }),
      yAxis: R.axis({ type: "category", data: n2.map(n => R.trunc(`${n} ${naceName(n)}`, 38)), axisLabel: { color: cssv("--text-secondary"), fontSize: 11 } }),
      visualMap: { min: -mx, max: mx, dimension: 2, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 140,
        inRange: { color: [cssv("--s1"), cssv("--div-mid"), cssv("--s8")] },
        text: [S.lang === "sv" ? "ger" : "gives", S.lang === "sv" ? "tar emot" : "takes"], formatter: v => fmtM(Math.sign(v) * v * v), textStyle: { color: cssv("--text-muted"), fontSize: 11 } },
      tooltip: { formatter: p => `<b>${fmtM(Math.abs(p.data[3]))} ${p.data[3] > 0 ? (S.lang === "sv" ? "givet netto" : "given, net") : (S.lang === "sv" ? "mottaget netto" : "taken, net")}</b><br>${esc(kName(ks[p.data[0]]))} · ${esc(n2[p.data[1]])} ${esc(naceName(n2[p.data[1]]))}` },
      series: [{ type: "heatmap", data, itemStyle: { borderColor: cssv("--surface-1"), borderWidth: 2, borderRadius: 3 } }]
    }, p => R.set({ kommun: ks[p.data[0]], nace: n2[p.data[1]] }));
  } });

  // ======================= 11. Directory =======================
  R.view("directory", { group: "opp", prefix: "dir", async render(page) {
    R.header(page, "directory");
    const list = D.directory.filter(d => (!S.kommun || d.kommun === S.kommun) && (!S.nace || d.nace4.startsWith(S.nace)));
    const wrap = add(page, h("div", { class: "dir" }));
    if (!list.length) wrap.append(R.empty());
    for (const d of list) {
      const what = S.lang === "sv" ? d.what_sv : d.what_en, note = S.lang === "sv" ? d.note_sv : d.note_en;
      const statusCls = d.status === "verified" ? "" : "warn";
      wrap.append(h("div", { class: "card" },
        h("h3", { text: d.company }),
        h("div", { class: "meta" }, `${kName(d.kommun)} · ${d.nace4} ${naceName(d.nace4)}`),
        h("div", {}, h("span", { class: `tag ${d.role}`, text: t(`role.${d.role}.tag`) }), " ",
          h("span", { class: `tag ${statusCls}`, text: t("dir.status." + d.status) })),
        what ? h("p", { class: "small", style: "margin:8px 0 0", text: what }) : null,
        note ? h("p", { class: "small muted", style: "margin:6px 0 0", text: note }) : null,
        h("div", { class: "links" },
          d.website ? h("a", { href: d.website, target: "_blank", rel: "noopener", text: t("dir.site") + " ↗" }) : null,
          d.contact_email ? h("a", { href: "mailto:" + d.contact_email, text: d.contact_email }) : null,
          d.contact_page ? h("a", { href: d.contact_page, target: "_blank", rel: "noopener", text: t("dir.contact") + " ↗" }) : null,
          d.source ? h("a", { href: d.source, target: "_blank", rel: "noopener", class: "muted", text: t("dir.src") + " ↗" }) : null,
          h("a", { href: "#/industries", onclick: e => { e.preventDefault(); R.set({ kommun: d.kommun, nace: d.nace4 }, { noRender: true }); R.go("flows"); },
                   text: S.lang === "sv" ? "Se flöden" : "See flows" }))));
    }
    // focus cells without a listed company
    const fl = (await R.curFlows()).filter(f => R.flowPass(f, { kommun: true, nace: true }));
    const score = new Map();
    for (const f of fl) for (const [k, n] of [[f.fk, f.fn], [f.tk, f.tn]]) { const key = k + "|" + n; score.set(key, (score.get(key) || 0) + R.measure(f)); }
    const listed = new Set(D.directory.map(d => d.kommun + "|" + d.nace4));
    const cells = [...score].filter(([k]) => !listed.has(k)).map(([k, v]) => { const [kommun, nace4] = k.split("|"); return { kommun, nace4, v }; })
      .filter(c => (!S.kommun || c.kommun === S.kommun) && (!S.nace || c.nace4.startsWith(S.nace)))
      .sort((a, b) => b.v - a.v).slice(0, 18);
    const c = add(page, R.card(t("dir.cells"), t("dir.cells.p")));
    c.style.marginTop = "16px";
    const firms = new Map(D.firms.map(f => [f.kommun + "|" + f.nace4, f]));
    R.table(c.body, [kommunCol(), naceCol(), { key: "v", label: S.unit === "t" ? t("col.tons") : t("col.msek"), num: true, bar: true,
        fmt: v => S.unit === "t" ? num(v) : num(v / 1e6, 2) },
      { key: "firms", label: t("ind.firms"), num: true, fmt: v => v ? num(v) : "–" },
      { key: "q", label: t("dir.find"), fmt: v => "🔎 " + v }],
      withNames(cells, "kommun").map(c => ({ ...c, firms: (firms.get(c.kommun + "|" + c.nace4) || {}).firms || 0,
        q: `${(R.NACE[c.nace4] || {}).sv || naceName(c.nace4)} ${kName(c.kommun)}` })),
      { sort: "v", page: 18, search: false, filename: "industries_to_research",
        onRow: r => window.open("https://www.google.com/search?q=" + encodeURIComponent(`${r.q} företag`), "_blank", "noopener") });
    add(page, h("p", { class: "small muted", text: t("dir.add") }));
  } });

  // ======================= 12. Method =======================
  R.view("method", { group: "more", prefix: "m", async render(page) {
    R.header(page, "method");
    add(page, h("div", { class: "prose", html: t("m.body") }));
    add(page, h("h2", { text: S.lang === "sv" ? "Ladda ner data" : "Download data" }));
    const files = ["meta.json", "region.json", "metabolism.json", "kpis.json", "firms.json", "directory.json",
      ...R.SCENARIOS.map(s => `flows_${s}.json`),
      ...(window.RIS_CONFIG && window.RIS_CONFIG.public ? [] : ["sites.json", ...R.SCENARIOS.map(s => `links_${s}.json`)]),
      "kommuner.geojson", "context.md"];
    add(page, h("ul", { class: "prose" }, files.map(f => h("li", {}, h("a", { href: "data/" + f, download: f, text: f })))));
    add(page, h("p", { class: "small muted", text: `${S.lang === "sv" ? "Data genererade" : "Data generated"} ${D.meta.generated}` }));
  } });
})();
