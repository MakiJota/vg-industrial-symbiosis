// "Ask the report": free text search over the results report, optional answers
// from Claude with the visitor's own API key, or through the managed service.
(() => {
  const R = RIS, { S, D, t, h, sum, num, fmtT, fmtSEK, kName, naceName, cnName, lowName } = R;
  const CFG = Object.assign({ mode: "free", model: "claude-opus-5-5", maxTokens: 4000 },
                            (window.RIS_CONFIG || {}).chat || {});
  if (CFG.mode === "off") return;

  const KEY_STORE = "ris.anthropicKey";
  const getKey = () => { try { return sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } };
  const setKey = (k, remember) => { try {
    sessionStorage.setItem(KEY_STORE, k); if (remember) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE);
  } catch {} };
  const forgetKey = () => { try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch {} };
  const history = [];   // [{role, content}] sent to the model

  // ---------- report text and search ----------
  let chunks = null, contextText = "";
  async function loadContext() {
    if (chunks) return;
    contextText = await (await fetch("data/context.md")).text();
    chunks = [];
    let heads = [];
    for (const block of contextText.split(/\n(?=#{1,3} )/)) {
      const m = block.match(/^(#{1,3}) (.*)/);
      if (m) heads = heads.slice(0, m[1].length - 1).concat(m[2]);
      const body = m ? block.slice(m[0].length) : block;
      const paras = body.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !p.startsWith("!["));
      let cur = "";
      for (const p of paras) {
        if ((cur + p).length > 1100 && cur) { chunks.push({ head: heads.join(" › "), text: cur }); cur = ""; }
        cur += (cur ? "\n\n" : "") + p;
      }
      if (cur) chunks.push({ head: heads.join(" › "), text: cur });
    }
    const df = new Map();
    for (const c of chunks) { c.tok = tokens(c.head + " " + c.text); new Set(c.tok).forEach(w => df.set(w, (df.get(w) || 0) + 1)); }
    chunks.df = df; chunks.avg = sum(chunks, c => c.tok.length) / chunks.length;
  }
  const STOP = new Set("the a an of and or to in is are be for on by with as at from that this which what how why who where when it its do does can could would should than then there their about into much many more most our we you your i me vs per".split(" ")
    .concat("och i att det som en ett är av för på med till den de har inte om vad hur varför vem var när kan ska bör vilka vilken vilket mer mest än".split(" ")));
  const SV = { avfall: "waste", avfallet: "waste", kommun: "kommun", papper: "paper", returpapper: "recovered paper", sten: "stone", krossten: "crushed stone",
    betong: "concrete", skrot: "scrap", värde: "value", täkt: "quarry", täkter: "quarry", täktavfall: "quarry waste", import: "imports", livsmedel: "food",
    foder: "feed", trä: "wood", flöde: "flow", flöden: "flows", bransch: "industry", branscher: "industry", företag: "firm firms", produkt: "product",
    produkter: "products", osäker: "uncertain", tillförlitlig: "validation overestimated", möjligheter: "potential", största: "largest", lokalt: "local intra",
    kol: "coal", gips: "gypsum", slam: "sludge", aska: "ash", slagg: "slag", kalksten: "limestone", sand: "sand", bränsle: "fuel", utvinning: "extraction",
    anställda: "workers", jobb: "workers", materialbalans: "balance", efterfrågan: "demand", ersätta: "replace substituted", cement: "cement", massa: "pulp" };
  function tokens(s) {
    const out = [];
    for (let w of s.toLowerCase().normalize("NFC").split(/[^a-z0-9åäöéü]+/)) {
      if (!w || w.length < 2 || STOP.has(w)) continue;
      if (SV[w]) { out.push(...SV[w].split(" ")); continue; }
      out.push(w.length > 5 ? w.replace(/(ing|ed|es|s)$/, "") : w);
    }
    return out;
  }
  function search(q, k = 4) {
    const qt = tokens(q), N = chunks.length;
    const scored = chunks.map(c => {
      let s = 0; const tf = new Map(); c.tok.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
      for (const w of new Set(qt)) { const f = tf.get(w); if (!f) continue;
        const idf = Math.log(1 + (N - chunks.df.get(w) + 0.5) / (chunks.df.get(w) + 0.5));
        s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * c.tok.length / chunks.avg)); }
      return { c, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    return scored.slice(0, k).map(x => x.c);
  }

  // ---------- live data snapshot for the question ----------
  async function snapshot() {
    const fl = (await R.curFlows()).filter(f => R.flowPass(f));
    const agg = new Map();
    for (const f of fl) { const key = [f.fk, f.fn, f.low, f.tk, f.tn, f.cn4].join("|");
      const o = agg.get(key) || { ...f, t: 0, sek: 0 }; o.t += f.t; o.sek += f.sek; agg.set(key, o); }
    const top = [...agg.values()].sort((a, b) => b.t - a.t).slice(0, 12).map(f =>
      `- ${kName(f.fk)} NACE ${f.fn} (${naceName(f.fn)}) gives ${lowName(f.low)} [LoW ${f.low}] → ${kName(f.tk)} NACE ${f.tn} (${naceName(f.tn)}) replacing ${cnName(f.cn4)} [CN ${f.cn4}]: ${fmtT(f.t)}, ${fmtSEK(f.sek)}`);
    const dir = D.directory.filter(d => (!S.kommun || d.kommun === S.kommun) && (!S.nace || d.nace4.startsWith(S.nace)))
      .map(d => `- ${d.company} (${kName(d.kommun)}, NACE ${d.nace4}, ${d.role}): ${d.what_en}${d.note_en ? ". " + d.note_en : ""}${d.website ? ". " + d.website : ""}`);
    return `## Current view of the interactive report\n${R.describeState()}\n\n## Flows in the current view (kommun two-stage allocation)\nTotal: ${fmtT(sum(fl, f => f.t))}, ${fmtSEK(sum(fl, f => f.sek))}, ${num(fl.length)} flow records.\nLargest:\n${top.join("\n") || "(none)"}\n\n## Public company directory entries for this view\n${dir.join("\n") || "(none)"}`;
  }

  const SYSTEM = `You answer questions from regional development staff in ${(window.RIS_CONFIG && window.RIS_CONFIG.regionName) || "Skaraborg"}, Sweden, about an interactive report on regional industrial symbiosis (waste from one firm replacing raw materials of another), reference year 2022.
Ground every answer in the report below and the data snapshot in the question. Give numbers with units and say which scenario they come from. When the report says an estimate is uncertain (for example quarry waste, the matching database, imports versus total use), say so briefly. If the report does not contain the answer, say that and suggest which page of the interactive report to look at (Overview, Jobs and industry, Local extraction, Material balance, Waste generated, Imported inputs, Symbiosis flows, Products to target, How sure are we?, Who to reach out to, Company directory, Method and data).
Firm-level model results are anonymised; company names come only from the public directory and are not linked to model records, so present them as companies operating in that industry and kommun, not as confirmed partners.
Answer in the language of the question (Swedish or English). Be concise: a short direct answer first, then up to five bullet points. Use plain markdown (bold, bullets), no tables.

<report>
`;

  // ---------- model call (streaming) ----------
  async function askModel(question, onText) {
    await loadContext();
    const userText = `${await snapshot()}\n\n## Question\n${question}`;
    history.push({ role: "user", content: userText });
    const body = {
      model: CFG.model, max_tokens: CFG.maxTokens, stream: true,
      system: [{ type: "text", text: SYSTEM + contextText + "\n</report>", cache_control: { type: "ephemeral" } }],
      messages: history.slice(-12),
      output_config: { effort: "low" }
    };
    const headers = { "content-type": "application/json" };
    let url;
    if (CFG.mode === "service") {
      url = CFG.serviceUrl; headers["x-client-key"] = CFG.clientKey || "";
    } else {
      url = "https://api.anthropic.com/v1/messages";
      Object.assign(headers, { "x-api-key": getKey(), "anthropic-version": "2023-06-01",
                               "anthropic-dangerous-direct-browser-access": "true" });
      if (/^claude-(opus-5|sonnet-5-5|fable-5)/.test(CFG.model)) {
        headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; body.fallbacks = "default";
      }
    }
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      history.pop();
      let msg = `${res.status}`; try { const j = await res.json(); msg += " " + ((j.error && j.error.message) || JSON.stringify(j)); } catch {}
      throw new Error(msg);
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "", stop = null;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const ev = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = ev.split("\n").find(l => l.startsWith("data: ")); if (!line) continue;
        let j; try { j = JSON.parse(line.slice(6)); } catch { continue; }
        if (j.type === "content_block_delta" && j.delta && j.delta.type === "text_delta") { text += j.delta.text; onText(text); }
        else if (j.type === "message_delta" && j.delta) stop = j.delta.stop_reason || stop;
        else if (j.type === "error") throw new Error(j.error && j.error.message || "stream error");
      }
    }
    if (stop === "refusal" && !text) text = t("ask.refusal");
    history.push({ role: "assistant", content: text || "…" });
    return text;
  }

  // ---------- minimal, safe markdown ----------
  function md(el, src) {
    el.textContent = "";
    const inline = (parent, s) => {
      const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:[^)\s]+)\)/g; let last = 0, m;
      while ((m = re.exec(s))) {
        parent.append(s.slice(last, m.index));
        if (m[1]) parent.append(h("strong", { text: m[1] }));
        else if (m[2]) parent.append(h("code", { text: m[2] }));
        else parent.append(h("a", { href: m[4], target: "_blank", rel: "noopener", text: m[3] }));
        last = re.lastIndex;
      }
      parent.append(s.slice(last));
    };
    let list = null;
    for (const raw of src.split("\n")) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
      if (li) { if (!list) { list = h("ul"); el.append(list); } const item = h("li"); inline(item, li[1]); list.append(item); continue; }
      list = null;
      if (!line.trim()) continue;
      const hd = line.match(/^#{1,4}\s+(.*)/);
      const p = h(hd ? "h3" : "p"); inline(p, hd ? hd[1] : line); el.append(p);
    }
  }

  // ---------- view ----------
  R.view("ask", { group: "more", prefix: "ask", async render(page) {
    R.header(page, "ask");
    const useModel = () => CFG.mode === "service" ? !!CFG.serviceUrl : (CFG.mode === "byok" && !!getKey());
    const box = h("div", { class: "chat" });
    page.append(box);

    // mode panel
    if (CFG.mode === "service") box.append(R.callout(`<b>${t("ask.service.t")}.</b> ${t("ask.service.p")}`));
    else {
      box.append(R.callout(`<b>${t("ask.free.t")}.</b> ${t("ask.free.p")}`));
      if (CFG.mode === "byok") {
        const key = h("input", { type: "password", placeholder: "sk-ant-…", autocomplete: "off", "aria-label": "API key" });
        const remember = h("input", { type: "checkbox", id: "remember-key" });
        const status = h("span", { class: "muted small" });
        const draw = () => { status.textContent = getKey() ? "✓ " + t("ask.key.active") : ""; };
        const details = h("details", { class: "card" }, h("summary", { style: "cursor:pointer;font-weight:600", text: t("ask.key.t") }),
          h("p", { class: "small muted", text: t("ask.key.p") }),
          h("div", { class: "keybox" }, key,
            h("button", { type: "button", class: "btn", text: t("ask.key.save"), onclick: () => { if (key.value.trim()) { setKey(key.value.trim(), remember.checked); key.value = ""; draw(); } } }),
            h("label", {}, remember, " ", t("ask.key.remember")),
            h("button", { type: "button", class: "ghost", text: t("ask.key.forget"), onclick: () => { forgetKey(); draw(); } }), status));
        if (getKey()) details.open = false;
        draw(); box.append(details);
      }
    }

    const log = h("div", { class: "chat-log", "aria-live": "polite" });
    const ta = h("textarea", { placeholder: t("ask.placeholder"), "aria-label": t("ask.title") });
    const send = h("button", { type: "button", class: "btn", text: t("ask.send") });
    const sug = h("div", { class: "suggest" }, ["ask.s1", "ask.s2", "ask.s3", "ask.s4"].map(k =>
      h("button", { type: "button", text: t(k), onclick: () => { ta.value = t(k); go(); } })));
    box.append(log, sug, h("div", { class: "chat-form" }, ta, send));
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) go(); });
    send.addEventListener("click", go);

    async function go() {
      const q = ta.value.trim(); if (!q) return;
      ta.value = ""; send.disabled = true;
      log.append(h("div", { class: "msg user" }, h("div", { class: "who", text: t("ask.you") }), h("div", { text: q })));
      const out = h("div"); const msg = h("div", { class: "msg" }, h("div", { class: "who", text: t("ask.bot") }), out);
      log.append(msg);
      try {
        await loadContext();
        if (useModel()) {
          out.textContent = "…";
          await askModel(q, txt => md(out, txt));
        } else await freeAnswer(q, out);
      } catch (e) { out.textContent = t("ask.error") + e.message; }
      send.disabled = false;
      msg.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    async function freeAnswer(q, out) {
      const hits = search(q);
      out.append(h("p", { html: `<b>${R.esc(t("ask.passages"))}</b>` }));
      if (!hits.length) out.append(h("p", { class: "muted", text: t("ui.nodata") }));
      for (const c of hits) {
        const p = h("div", { class: "passage" }, h("div", { class: "small muted", text: c.head }));
        const body = h("div"); md(body, c.text.length > 900 ? c.text.slice(0, 900) + "…" : c.text); p.append(body);
        out.append(p);
      }
      const prompt = `${SYSTEM.split("<report>")[0]}\n<report excerpts>\n${hits.map(c => `### ${c.head}\n${c.text}`).join("\n\n")}\n</report excerpts>\n\n${await snapshot()}\n\n## Question\n${q}`;
      const short = prompt.length > 6000 ? prompt.slice(0, 6000) : prompt;
      const copy = h("button", { type: "button", class: "ghost", text: "⧉ " + t("ask.copy") });
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(prompt); copy.textContent = "✓ " + t("ask.copied"); } catch {} });
      out.append(h("div", { class: "links", style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:10px" }, copy,
        h("a", { class: "ghost", href: "https://chatgpt.com/?q=" + encodeURIComponent(short), target: "_blank", rel: "noopener", text: t("ask.openchatgpt") + " ↗" }),
        h("a", { class: "ghost", href: "https://claude.ai/new?q=" + encodeURIComponent(short), target: "_blank", rel: "noopener", text: t("ask.openclaude") + " ↗" })));
    }
  } });
})();
