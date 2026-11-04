// ==========================================
// 📊 PCM — INDICADORES
// Tempos médios de setup, preventiva, corretiva e inspeção da Produção, com filtros
// (período, atividade, tipo de molde, injetora, molde) e exportação para Excel e PDF.
// Só lê prod_lancamentos. Não altera nenhum dado.
// ==========================================
(function () {
  const GRUPOS = ['Troca de molde', 'Outros setups', 'Preventiva', 'Corretiva', 'Inspeção'];
  const CATS = ['Todos', 'Balde', 'Tampa', 'STX', 'PMX', 'Alça', 'Outros'];
  const LIM_EXTREMO = 480;           // 8 h
  let D = [], DMIN = '', DMAX = '', raiz = null, carregando = false;
  const S = { ini: '', fim: '', preset: 'tudo', g: '', s: '', cat: 'Todos', ton: '', cav: '', inj: '', mol: '', par: '', out: false,
              tab: 'cav', sort: { cav: ['k', 1], ton: ['k', 1], inj: ['n', -1], mol: ['n', -1], lan: ['d', -1] }, rows: 12, lim: 50 };

  const q = id => document.getElementById(id);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h-1] + s[h]) / 2; };
  const fmtD = d => d.split('-').reverse().join('/');
  const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const fmtM = m => MESES[+m.slice(5) - 1] + '/' + m.slice(2, 4);
  const hm = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? h + ' h ' + String(r).padStart(2, '0') : r + ' min'; };
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return dataLocal(t); };
  const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5) + 1;

  function tonelagem(inj) { const m = /^(\d{2,3})-/.exec(inj || ''); return m ? m[1] + ' t' : 'Sem tonelagem'; }
  const ordTon = t => parseInt(t, 10) || 99999;

  // Cavidades vêm do cadastro do molde (Admin > Jobs), a mesma usada no controle de peso.
  let cavPorMolde = {};
  const rotCav = n => !n ? 'Não cadastrado' : n + (n === 1 ? ' cavidade' : ' cavidades');
  const ordCav = t => parseInt(t, 10) || 99999;

  function catMolde(m) {
    const u = (m || '').toUpperCase();
    if (/\bPMX\b/.test(u)) return 'PMX';
    if (/\bSTX\b/.test(u)) return 'STX';
    if (/\bBX\b/.test(u)) return 'Balde';
    if (/\b(TX|TCX)\b/.test(u)) return 'Tampa';
    if (/ALÇA/.test(u)) return 'Alça';
    return 'Outros';
  }
  function servico(tipo, at) {
    const a = cap(at), l = at.toLowerCase();
    if (tipo === 'Setup') return { g: l === 'troca de molde' ? 'Troca de molde' : 'Outros setups', s: l === 'sem atividade' ? 'Setup sem atividade' : a };
    if (/Preventiva/.test(tipo)) return { g: 'Preventiva', s: l === 'mensal' ? 'Preventiva mensal' : l === 'semanal' ? 'Preventiva semanal' : l === 'anual' ? 'Preventiva anual' : (l === 'preventiva' || l === 'sem atividade') ? 'Preventiva sem frequência' : 'Preventiva: ' + l };
    if (/Corretiva/.test(tipo)) return { g: 'Corretiva', s: (l === 'corretiva' || l === 'sem atividade') ? 'Corretiva sem detalhe' : a };
    return { g: 'Inspeção', s: 'Inspeção: ' + l.replace(/^inspeção /, '') };
  }

  // ---------- dados ----------
  async function carregar() {
    if (carregando) return;
    carregando = true;
    raiz.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando indicadores...</span></div>';
    try {
      const [rows, jobs] = await Promise.all([
        db._get('prod_lancamentos', 'minutos=gt.0&order=data.asc', 'id,data,injetora,tipo,atividade,minutos,molde,maquina_parada,tecnicos,descricao'),
        db._get('jobs', '', 'nome,num_cavidades')
      ]);
      cavPorMolde = {}; (jobs || []).forEach(j => { if (j.num_cavidades) cavPorMolde[j.nome] = j.num_cavidades; });
      D = (rows || []).map(r => {
        const sv = servico(r.tipo || '', r.atividade || 'Sem atividade');
        return { id: r.id, tec: r.tecnicos || '', desc: r.descricao || '', d: r.data, inj: r.injetora || '—', ton: tonelagem(r.injetora), cav: rotCav(cavPorMolde[r.molde]), tipo: r.tipo || '', min: r.minutos, mol: r.molde || '—', par: r.maquina_parada ? 1 : 0, cat: catMolde(r.molde), g: sv.g, s: sv.s, mes: r.data.slice(0, 7) };
      });
      DMIN = D.length ? D[0].d : hojeLocal(); DMAX = D.length ? D[D.length - 1].d : hojeLocal();
      if (!S.ini) { S.ini = DMIN; S.fim = DMAX; }
      desenharBase();
      render();
    } catch (e) { console.error(e); raiz.innerHTML = '<div class="card">Não foi possível carregar os indicadores. Tente de novo.</div>'; }
    carregando = false;
  }

  function base(ex) {
    ex = ex || [];
    const t = S.mol.trim().toUpperCase();
    return D.filter(x => (ex.includes('p') || (x.d >= S.ini && x.d <= S.fim)) && (!S.g || x.g === S.g) && (!S.s || x.s === S.s) &&
      (ex.includes('cat') || S.cat === 'Todos' || x.cat === S.cat) && (!S.ton || x.ton === S.ton) && (!S.cav || x.cav === S.cav) && (!S.inj || x.inj === S.inj) && (!t || x.mol.toUpperCase().includes(t)) &&
      (S.par === '' || String(x.par) === S.par) && (!S.out || x.min <= LIM_EXTREMO));
  }
  const stats = a => { const v = a.map(x => x.min); return { n: a.length, med: mean(v), mediana: med(v), tot: v.reduce((x, y) => x + y, 0), max: v.length ? Math.max(...v) : 0, min: v.length ? Math.min(...v) : 0 }; };
  function group(rows, key) { const m = {}; rows.forEach(x => (m[x[key]] = m[x[key]] || []).push(x)); return Object.entries(m).map(([k, a]) => { const s = stats(a); return { k, n: s.n, med: s.med, mediana: s.mediana, tot: s.tot / 60, max: s.max, min: s.min, a }; }); }

  // ---------- estrutura ----------
  function desenharBase() {
    raiz.innerHTML = `
    <div class="pi-topo"><div class="pi-sub" id="piFonte"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-secondary" data-pi="xls">⬇ Exportar Excel</button><button class="btn-primary" data-pi="pdf">⬇ Exportar PDF</button></div></div>
    <div class="card pi-filtros">
      <div class="pi-frow">
        <div class="pi-f"><span class="pi-l">Período</span><div class="pi-seg" id="piPresets">
          <button data-p="tudo">Tudo</button><button data-p="mes">Este mês</button><button data-p="30">30 dias</button><button data-p="90">90 dias</button></div></div>
        <div class="pi-f"><label for="piIni">De</label><input type="date" id="piIni"></div>
        <div class="pi-f"><label for="piFim">Até</label><input type="date" id="piFim"></div>
        <div class="pi-f"><label for="piGrupo">Tipo de serviço</label><select id="piGrupo"></select></div>
        <div class="pi-f"><label for="piServ">Atividade</label><select id="piServ"></select></div>
        <div class="pi-f"><span class="pi-l">Molde</span><div class="pi-seg" id="piCat"></div></div>
        <div class="pi-f"><label for="piCav">Cavidades do molde</label><select id="piCav"></select></div>
        <div class="pi-f"><label for="piTon">Tonelagem</label><select id="piTon"></select></div>
        <div class="pi-f"><label for="piInj">Injetora</label><select id="piInj"></select></div>
        <div class="pi-f"><label for="piMol">Buscar molde</label><input type="text" id="piMol" placeholder="ex.: 23088 ou BX 12"></div>
        <div class="pi-f"><label for="piPar">Máquina parada</label><select id="piPar"><option value="">Todas</option><option value="1">Parada</option><option value="0">Rodando</option></select></div>
        <label class="pi-chk"><input type="checkbox" id="piOut"> Ignorar lançamentos acima de 8 h <span class="pi-pill" id="piNOut"></span></label>
      </div>
      <div class="pi-chips" id="piChips"></div>
    </div>
    <div class="pi-kpis" id="piKpis"></div>
    <div class="card"><h3 class="pi-h">Faixa de tempos por atividade</h3>
      <p class="pi-hint">Cada ponto é um lançamento. A linha escura é a média e o losango é a mediana. Quando os dois se afastam, poucos lançamentos longos estão puxando a média. Clique numa atividade para filtrar.</p>
      <div class="pi-legend"><span><i class="pi-ldot"></i>lançamento</span><span><i class="pi-lmean"></i>média</span><span><i class="pi-lmed"></i>mediana</span></div>
      <div id="piStrip"></div><div class="pi-axis"><div></div><div id="piAxis"></div></div>
      <button class="btn-secondary" id="piMore" data-pi="more" style="margin-top:10px" hidden></button></div>
    <div class="pi-two">
      <div class="card"><h3 class="pi-h">Evolução por mês</h3><p class="pi-hint">Tempo médio por lançamento em cada mês, com o número de lançamentos. Não depende do filtro de período.</p><div id="piMensal"></div></div>
      <div class="card"><h3 class="pi-h">Balde, tampa, STX e PMX</h3><p class="pi-hint">Mesmos filtros, separado por tipo de molde.</p><div class="table-wrap" id="piComp"></div></div>
    </div>
    <div class="card"><div class="pi-tabs" id="piTabs">
      <button data-t="cav">Por cavidades</button><button data-t="ton">Por tonelagem</button><button data-t="inj">Por injetora</button><button data-t="mol">Por molde</button><button data-t="lan">Lançamentos</button></div>
      <div class="table-wrap" id="piTab"></div></div>`;
    injetarCss();
    ligarEventos();
  }

  function opt(sel, vals, primeiro, cur) { sel.innerHTML = `<option value="">${primeiro}</option>` + vals.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join(''); }
  function filtros() {
    opt(q('piGrupo'), GRUPOS, 'Todos', S.g);
    const cont = {}; D.filter(x => !S.g || x.g === S.g).forEach(x => cont[x.s] = (cont[x.s] || 0) + 1);
    opt(q('piServ'), Object.keys(cont).sort((a, b) => cont[b] - cont[a]), 'Todas', S.s);
    const tons = [...new Set(D.map(x => x.ton))].sort((a, b) => ordTon(a) - ordTon(b));
    q('piTon').innerHTML = '<option value="">Todas</option>' + tons.map(t => `<option value="${esc(t)}"${t === S.ton ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const cavs = [...new Set(D.map(x => x.cav))].sort((a, b) => ordCav(a) - ordCav(b));
    q('piCav').innerHTML = '<option value="">Todas</option>' + cavs.map(t => `<option value="${esc(t)}"${t === S.cav ? ' selected' : ''}>${esc(t)}</option>`).join('');
    opt(q('piInj'), [...new Set(D.filter(x => !S.ton || x.ton === S.ton).map(x => x.inj))].sort(), 'Todas', S.inj);
    q('piCat').innerHTML = CATS.map(c => `<button data-c="${c}" aria-pressed="${S.cat === c}">${c}</button>`).join('');
    q('piIni').value = S.ini; q('piFim').value = S.fim; q('piPar').value = S.par; q('piOut').checked = S.out;
    if (document.activeElement !== q('piMol')) q('piMol').value = S.mol;
    document.querySelectorAll('#piPresets button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === S.preset));
    q('piNOut').textContent = D.filter(x => x.min > LIM_EXTREMO).length + ' lançamentos';
    const c = [];
    if (S.preset !== 'tudo') c.push(['p', 'Período: ' + fmtD(S.ini) + ' a ' + fmtD(S.fim)]);
    if (S.g) c.push(['g', S.g]); if (S.s) c.push(['s', S.s]); if (S.cat !== 'Todos') c.push(['cat', 'Molde: ' + S.cat]);
    if (S.cav) c.push(['cav', S.cav]); if (S.ton) c.push(['ton', 'Tonelagem ' + S.ton]); if (S.inj) c.push(['inj', 'Injetora ' + S.inj]); if (S.mol) c.push(['mol', 'Molde contém "' + S.mol + '"']);
    if (S.par !== '') c.push(['par', S.par === '1' ? 'Máquina parada' : 'Máquina rodando']); if (S.out) c.push(['out', 'Sem lançamentos acima de 8 h']);
    q('piChips').innerHTML = c.length ? c.map(([k, t]) => `<span class="pi-chip">${esc(t)}<button data-k="${k}" aria-label="Remover filtro ${esc(t)}">×</button></span>`).join('') + '<button class="pi-clear" data-pi="limpar">Limpar tudo</button>' : '<span class="pi-hint" style="margin:0">Nenhum filtro ativo. Mostrando todos os lançamentos.</span>';
    return c.map(x => x[1]);
  }
  function preset(p) {
    S.preset = p;
    if (p === 'tudo') { S.ini = DMIN; S.fim = DMAX; }
    if (p === 'mes') { S.fim = DMAX; S.ini = DMAX.slice(0, 8) + '01'; }
    if (p === '30') { S.fim = DMAX; S.ini = addDays(DMAX, -29); }
    if (p === '90') { S.fim = DMAX; S.ini = addDays(DMAX, -89); }
  }
  function remover(k) {
    if (k === 'p') preset('tudo'); else if (k === 'cat') S.cat = 'Todos'; else if (k === 'out') S.out = false; else S[k] = '';
    if (k === 'g') S.s = '';
  }
  const unid = t => t.replace(/ (h|min)/g, '<small>$1</small>');
  function kpis(rows) {
    const s = stats(rows); let dl = '';
    if (S.preset !== 'tudo') {
      const len = diffDays(S.ini, S.fim), pf = addDays(S.ini, -1), pi = addDays(S.ini, -len);
      const prev = base(['p']).filter(x => x.d >= pi && x.d <= pf);
      if (prev.length && s.n) { const ps = stats(prev), d = (s.med / ps.med - 1) * 100; dl = `<div class="pi-d ${Math.abs(d) < 3 ? 'flat' : d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d.toFixed(0)}% vs período anterior (${hm(ps.med)})</div>`; }
    }
    const mx = rows.length ? rows.reduce((a, x) => x.min > a.min ? x : a) : null;
    q('piKpis').innerHTML = `
     <div class="pi-k"><div class="pi-v">${s.n ? unid(hm(s.med)) : '—'}</div><div class="pi-kl">Tempo médio</div>${dl}</div>
     <div class="pi-k"><div class="pi-v">${s.n ? unid(hm(s.mediana)) : '—'}</div><div class="pi-kl">Mediana (valor do meio)</div></div>
     <div class="pi-k"><div class="pi-v">${s.n}</div><div class="pi-kl">Lançamentos</div></div>
     <div class="pi-k"><div class="pi-v">${(s.tot / 60).toFixed(0)}<small>h</small></div><div class="pi-kl">Horas somadas</div></div>
     <div class="pi-k"><div class="pi-v">${mx ? unid(hm(mx.min)) : '—'}</div><div class="pi-kl">Maior lançamento${mx ? ' · ' + esc(mx.inj) + ' · ' + fmtD(mx.d) : ''}</div></div>`;
  }

  // linha da faixa de tempos (também usada no PDF)
  function stripSvg(a, xmax, W, H, comEixo) {
    const pad = 8, X = v => pad + (Math.min(v, xmax) / xmax) * (W - 2 * pad), m = mean(a.map(x => x.min)), md = med(a.map(x => x.min));
    let s = `<svg width="${comEixo ? '100%' : W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    for (let t = 0; t <= xmax; t += 60) s += `<line x1="${X(t)}" x2="${X(t)}" y1="0" y2="${H}" stroke="#e6ebf0"/>`;
    a.forEach((x, i) => { const cy = 7 + ((i * 37 + x.min * 13) % (H - 14)); s += x.min > xmax ? `<path d="M${W - pad - 6} ${cy - 4}l6 4-6 4z" fill="#0056b3"/>` : `<circle cx="${X(x.min)}" cy="${cy}" r="3.4" fill="rgba(0,86,179,.38)" stroke="#0056b3" stroke-width=".8"/>`; });
    return s + `<line x1="${X(m)}" x2="${X(m)}" y1="1" y2="${H - 1}" stroke="#14202e" stroke-width="2"/><rect x="${X(md) - 4.5}" y="${H / 2 - 4.5}" width="9" height="9" fill="#b86a00" stroke="#fff" stroke-width="1.2" transform="rotate(45 ${X(md)} ${H / 2})"/></svg>`;
  }
  function xmaxDe(rows) { const all = rows.map(x => x.min).sort((a, b) => a - b); const p98 = all.length ? all[Math.min(all.length - 1, Math.floor(all.length * .98))] : 240; return Math.max(120, Math.ceil(Math.min(LIM_EXTREMO, p98) / 60) * 60); }
  function eixoSvg(xmax, W, haExtremo) {
    const pad = 8, X = v => pad + (v / xmax) * (W - 2 * pad); let ax = `<svg width="100%" height="20" viewBox="0 0 ${W} 20" aria-hidden="true">`;
    for (let t = 0; t <= xmax; t += 60) { const al = t === 0 ? 'start' : t === xmax ? 'end' : 'middle'; ax += `<text x="${X(t)}" y="14" text-anchor="${al}" fill="#5a6a7b" font-size="12">${t / 60} h${t === xmax && haExtremo ? ' ou mais' : ''}</text>`; }
    return ax + '</svg>';
  }
  function strip(rows) {
    const by = {}; rows.forEach(x => (by[x.s] = by[x.s] || []).push(x));
    const keys = Object.keys(by).sort((a, b) => by[b].length - by[a].length), total = keys.length;
    if (!rows.length) { q('piStrip').innerHTML = '<div class="pi-empty">Nenhum lançamento com esses filtros. Remova um filtro acima.</div>'; q('piAxis').innerHTML = ''; q('piMore').hidden = true; return; }
    const xmax = xmaxDe(rows), W = Math.max(220, q('piAxis').clientWidth || 600);
    q('piStrip').innerHTML = keys.slice(0, S.rows).map(k => {
      const a = by[k], v = a.map(x => x.min);
      return `<button class="pi-srow" data-s="${esc(k)}" title="Filtrar por ${esc(k)}"><div class="pi-lab"><b>${esc(k)}</b><span><span class="pi-n">${hm(mean(v))}</span> média · mediana ${hm(med(v))} · ${a.length} lanç.</span></div>${stripSvg(a, xmax, W, 34, true)}</button>`;
    }).join('');
    q('piAxis').innerHTML = eixoSvg(xmax, W, rows.some(x => x.min > xmax));
    const b = q('piMore'); b.hidden = total <= 12; b.textContent = S.rows < total ? `Mostrar todas as ${total} atividades` : 'Mostrar só as 12 principais';
  }
  function mensal(rows) {
    const by = {}; rows.forEach(x => (by[x.mes] = by[x.mes] || []).push(x.min));
    const ms = Object.keys(by).sort(); if (!ms.length) { q('piMensal').innerHTML = '<div class="pi-empty">Sem dados.</div>'; return; }
    const W = Math.max(260, q('piMensal').clientWidth || 520), H = 210, L = 34, B = 30, T = 22, bw = Math.min(46, (W - L) / ms.length - 10);
    const vals = ms.map(m => mean(by[m])), top = Math.max(60, Math.ceil(Math.max(...vals) / 60) * 60), Y = v => T + (H - T - B) * (1 - v / top);
    let s = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tempo médio por mês">`;
    for (let t = 0; t <= top; t += top > 240 ? 120 : 60) s += `<line x1="${L}" x2="${W}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e6ebf0"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end" fill="#5a6a7b" font-size="12">${t / 60}h</text>`;
    ms.forEach((m, i) => { const cx = L + (W - L) * (i + .5) / ms.length, y = Y(vals[i]);
      s += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${Y(0) - y}" fill="#0056b3" rx="2"/><text x="${cx}" y="${y - 6}" text-anchor="middle" fill="#14202e" font-size="12" font-weight="600">${Math.round(vals[i])}</text><text x="${cx}" y="${H - 12}" text-anchor="middle" fill="#5a6a7b" font-size="12">${fmtM(m)}</text><text x="${cx}" y="${H - 1}" text-anchor="middle" fill="#5a6a7b" font-size="10.5">${by[m].length} lanç.</text>`; });
    q('piMensal').innerHTML = s + '</svg>';
  }
  function comp() {
    const all = base(['cat']);
    const corpo = ['Balde', 'Tampa', 'STX', 'PMX', 'Alça', 'Outros'].map(c => { const a = all.filter(x => x.cat === c);
      if (!a.length) return `<tr><td>${c}</td><td colspan="4" style="color:#64748b">sem lançamentos</td></tr>`;
      const s = stats(a); return `<tr${S.cat === c ? ' style="background:#dbe9f7"' : ''}><td><b>${c}</b></td><td style="text-align:right"><b>${hm(s.med)}</b></td><td style="text-align:right">${hm(s.mediana)}</td><td style="text-align:right">${s.n}</td><td style="text-align:right">${(s.tot / 60).toFixed(0)}</td></tr>`; }).join('');
    q('piComp').innerHTML = `<table><thead><tr><th>Molde</th><th style="text-align:right">Média</th><th style="text-align:right">Mediana</th><th style="text-align:right">Lançam.</th><th style="text-align:right">Horas</th></tr></thead><tbody>${corpo}</tbody></table><div class="pi-hint" style="margin-top:8px">Respeita todos os filtros, menos o de molde. STX são as tampas dos potes e PMX são os potes.</div>`;
  }
  function th(t, key, lab, r) { const [sk, sd] = S.sort[t]; return `<th class="pi-sort" style="${r ? 'text-align:right' : ''}" data-t="${t}" data-k="${key}">${lab}${sk === key ? (sd > 0 ? ' ▲' : ' ▼') : ''}</th>`; }
  function tabela(rows) {
    const t = S.tab;
    document.querySelectorAll('#piTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
    if (!rows.length) { q('piTab').innerHTML = '<div class="pi-empty">Nenhum lançamento com esses filtros.</div>'; return; }
    if (t === 'lan') {
      const pode = typeof podeEditar === 'function' && podeEditar();
      const [k, d] = S.sort.lan, a = [...rows].sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * d);
      q('piTab').innerHTML = `<table><thead><tr>${th('lan', 'd', 'Data')}${th('lan', 'inj', 'Injetora')}${th('lan', 'mol', 'Molde')}${th('lan', 's', 'Atividade')}${th('lan', 'min', 'Tempo', 1)}<th>Técnico</th><th>Observação</th><th>Máquina</th>${pode ? '<th></th>' : ''}</tr></thead><tbody>${a.slice(0, S.lim).map(x => `<tr><td>${fmtD(x.d)}</td><td>${esc(x.inj)}</td><td>${esc(x.mol)}</td><td>${esc(x.s)}</td><td style="text-align:right"><b>${hm(x.min)}</b>${x.min > LIM_EXTREMO ? '<br><span class="pi-pill st">acima de 8 h</span>' : ''}</td><td>${esc(x.tec)}</td><td style="max-width:260px">${esc(x.desc.length > 90 ? x.desc.slice(0, 90) + '…' : x.desc)}</td><td>${x.par ? '<span class="pi-pill st">Parada</span>' : ''}</td>${pode ? `<td><button class="btn-secondary" style="padding:4px 10px;font-size:12px" data-edit="${x.id}">✏️ Editar</button></td>` : ''}</tr>`).join('')}</tbody></table>${a.length > S.lim ? `<button class="btn-secondary" data-pi="lim" style="margin-top:10px">Mostrar mais (${a.length - S.lim} restantes)</button>` : ''}`;
      return;
    }
    const g = group(rows, t === 'cav' ? 'cav' : t === 'ton' ? 'ton' : t === 'inj' ? 'inj' : 'mol'), [k, d] = S.sort[t];
    if ((t === 'ton' || t === 'cav') && k === 'k') g.sort((x, y) => (ordTon(x.k) - ordTon(y.k)) * d); else
    g.sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * d);
    const mx = Math.max(...g.map(x => x.med));
    q('piTab').innerHTML = `<table><thead><tr>${th(t, 'k', t === 'cav' ? 'Cavidades' : t === 'ton' ? 'Tonelagem' : t === 'inj' ? 'Injetora' : 'Molde')}${th(t, 'med', 'Tempo médio', 1)}${th(t, 'mediana', 'Mediana', 1)}${th(t, 'n', 'Lançam.', 1)}${th(t, 'tot', 'Horas', 1)}${th(t, 'max', 'Maior', 1)}</tr></thead><tbody>${g.slice(0, 25).map(x => `<tr class="pi-click" data-f="${t}" data-v="${esc(x.k)}" title="Filtrar"><td>${esc(x.k)}</td><td style="text-align:right"><span class="pi-bar" style="width:${Math.max(1, 60 * x.med / mx)}px"></span><b>${hm(x.med)}</b></td><td style="text-align:right">${hm(x.mediana)}</td><td style="text-align:right">${x.n}</td><td style="text-align:right">${x.tot.toFixed(1)}</td><td style="text-align:right">${hm(x.max)}</td></tr>`).join('')}</tbody></table>${g.length > 25 ? `<div class="pi-hint" style="margin-top:8px">Mostrando as 25 com mais lançamentos de ${g.length}. Use os filtros para ver as demais.</div>` : ''}`;
  }
  function render() {
    if (!raiz || !q('piKpis')) return;
    const rows = base();
    q('piFonte').textContent = `Fonte: lançamentos de Produção · ${D.length} registros de ${fmtD(DMIN)} a ${fmtD(DMAX)} · mostrando ${rows.length}`;
    filtros(); kpis(rows); strip(rows); mensal(base(['p'])); comp(); tabela(rows);
  }

  // ---------- exportação ----------
  function descFiltros() { const c = [...document.querySelectorAll('#piChips .pi-chip')].map(x => x.firstChild.textContent); return c.length ? c.join(' · ') : 'sem filtros (todos os lançamentos)'; }
  function exportarExcel() {
    const rows = base();
    if (!rows.length) { toast('Nenhum lançamento para exportar com esses filtros.', 'erro'); return; }
    const ord = [...rows].sort((a, b) => a.d.localeCompare(b.d)), N = ord.length + 1;
    const col = c => `Lançamentos!$${c}$2:$${c}$${N}`;
    const lan = [['Data', 'Injetora', 'Molde', 'Tipo de molde', 'Tipo de serviço', 'Atividade', 'Minutos', 'Máquina parada', 'Mês', 'Tonelagem', 'Cavidades']]
      .concat(ord.map(x => [new Date(x.d + 'T12:00:00'), x.inj, x.mol, x.cat, x.g, x.s, x.min, x.par ? 'Sim' : 'Não', x.mes, x.ton, x.cav]));
    const s = stats(rows), c = (v, f) => ({ t: 'n', v, f });
    const res = [['Indicadores de PCM — Produção'], ['Filtros: ' + descFiltros()], ['Gerado em ' + new Date().toLocaleString('pt-BR')], [],
      ['Indicador', 'Valor'],
      ['Tempo médio (min)', c(s.med, `AVERAGE(${col('G')})`)], ['Mediana (min)', c(s.mediana, `MEDIAN(${col('G')})`)],
      ['Lançamentos', c(s.n, `COUNT(${col('G')})`)], ['Horas somadas', c(s.tot / 60, `SUM(${col('G')})/60`)],
      ['Maior lançamento (min)', c(s.max, `MAX(${col('G')})`)], ['Menor lançamento (min)', c(s.min, `MIN(${col('G')})`)]];
    const tabAgr = (titulo, key, colunaLetra, itens, nome) => [[nome, 'Tempo médio (min)', 'Mediana (min)', 'Lançamentos', 'Horas', 'Maior (min)']]
      .concat(itens.map(g => [g.k, c(g.med, `IFERROR(AVERAGEIFS(${col('G')},${col(colunaLetra)},A{r}),0)`), g.mediana, c(g.n, `COUNTIFS(${col(colunaLetra)},A{r})`), c(g.tot, `SUMIFS(${col('G')},${col(colunaLetra)},A{r})/60`), g.max]));
    const fix = aoa => aoa.map((l, i) => l.map(x => x && x.f ? { ...x, f: x.f.replace(/\{r\}/g, i + 1) } : x));
    const porAt = group(rows, 's').sort((a, b) => b.n - a.n), porCat = group(rows, 'cat').sort((a, b) => b.n - a.n),
      porMes = group(rows, 'mes').sort((a, b) => a.k.localeCompare(b.k)), porCav = group(rows, 'cav').sort((a, b) => ordCav(a.k) - ordCav(b.k)), porTon = group(rows, 'ton').sort((a, b) => ordTon(a.k) - ordTon(b.k)), porInj = group(rows, 'inj').sort((a, b) => b.n - a.n), porMol = group(rows, 'mol').sort((a, b) => b.n - a.n);
    const wb = XLSX.utils.book_new(), add = (nome, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }); ws['!cols'] = (w || []).map(x => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, nome); return ws; };
    add('Resumo', res, [30, 18]);
    add('Por atividade', fix(tabAgr('', 's', 'F', porAt, 'Atividade')), [38, 16, 14, 12, 10, 12]);
    add('Por tipo de molde', fix(tabAgr('', 'cat', 'D', porCat, 'Tipo de molde')), [20, 16, 14, 12, 10, 12]);
    add('Por mês', fix(tabAgr('', 'mes', 'I', porMes, 'Mês')), [12, 16, 14, 12, 10, 12]);
    add('Por cavidades', fix(tabAgr('', 'cav', 'K', porCav, 'Cavidades do molde')), [20, 16, 14, 12, 10, 12]);
    add('Por tonelagem', fix(tabAgr('', 'ton', 'J', porTon, 'Tonelagem')), [16, 16, 14, 12, 10, 12]);
    add('Por injetora', fix(tabAgr('', 'inj', 'B', porInj, 'Injetora')), [14, 16, 14, 12, 10, 12]);
    add('Por molde', fix(tabAgr('', 'mol', 'C', porMol, 'Molde')), [52, 16, 14, 12, 10, 12]);
    const wl = add('Lançamentos', lan, [12, 12, 52, 13, 16, 32, 10, 15, 9, 13, 16]);
    wl['!autofilter'] = { ref: `A1:K${N}` };
    wl['!cols'][0] = { wch: 12 };
    for (let r = 2; r <= N; r++) if (wl['A' + r]) wl['A' + r].z = 'dd/mm/yyyy';
    XLSX.writeFile(wb, `Indicadores_PCM_${hojeLocal()}.xlsx`);
    toast('Excel gerado.');
  }
  function exportarPdf() {
    const rows = base();
    if (!rows.length) { toast('Nenhum lançamento para exportar com esses filtros.', 'erro'); return; }
    const s = stats(rows), xmax = xmaxDe(rows), W = 680, by = {}; rows.forEach(x => (by[x.s] = by[x.s] || []).push(x));
    const keys = Object.keys(by).sort((a, b) => by[b].length - by[a].length).slice(0, 14);
    const strips = keys.map(k => { const a = by[k], v = a.map(x => x.min); return `<div class="r"><div class="l"><b>${esc(k)}</b><br>${hm(mean(v))} média · mediana ${hm(med(v))} · ${a.length} lanç.</div>${stripSvg(a, xmax, W, 30, false)}</div>`; }).join('');
    const tab = (titulo, g, nome, n) => `<h3>${titulo}</h3><table><tr><th>${nome}</th><th>Média</th><th>Mediana</th><th>Lanç.</th><th>Horas</th><th>Maior</th></tr>${g.slice(0, n).map(x => `<tr><td>${esc(x.k)}</td><td>${hm(x.med)}</td><td>${hm(x.mediana)}</td><td>${x.n}</td><td>${x.tot.toFixed(1)}</td><td>${hm(x.max)}</td></tr>`).join('')}</table>`;
    const mes = group(rows, 'mes').sort((a, b) => a.k.localeCompare(b.k)).map(x => ({ ...x, k: fmtM(x.k) }));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Indicadores de PCM</title><style>
      @page{size:A4;margin:14mm}body{font:11px/1.4 Arial,sans-serif;color:#14202e;margin:0}h1{font-size:20px;margin:0}h3{font-size:13px;margin:16px 0 6px}
      .sub{color:#5a6a7b;margin:3px 0 10px}.k{display:flex;gap:22px;border-top:1px solid #c9d2dc;border-bottom:1px solid #c9d2dc;padding:8px 0;margin:8px 0}.k b{display:block;font-size:20px}
      .r{display:grid;grid-template-columns:170px 1fr;align-items:center;border-top:1px solid #e6ebf0;font-size:10px}.l{padding:2px 6px 2px 0}
      table{width:100%;border-collapse:collapse;font-size:10px;break-inside:avoid}th,td{text-align:right;padding:3px 6px;border-bottom:1px solid #e6ebf0}th:first-child,td:first-child{text-align:left}th{color:#5a6a7b}
      .leg{color:#5a6a7b;font-size:10px;margin:2px 0 6px}.pb{break-before:page}svg{display:block}</style></head><body>
      <h1>Indicadores de PCM — Produção</h1><div class="sub">Filtros: ${esc(descFiltros())}<br>Gerado em ${new Date().toLocaleString('pt-BR')} · ${rows.length} lançamentos</div>
      <div class="k"><div><b>${hm(s.med)}</b>tempo médio</div><div><b>${hm(s.mediana)}</b>mediana</div><div><b>${s.n}</b>lançamentos</div><div><b>${(s.tot / 60).toFixed(0)} h</b>somadas</div><div><b>${hm(s.max)}</b>maior</div></div>
      <h3>Faixa de tempos por atividade</h3><div class="leg">Cada ponto é um lançamento. Linha escura: média. Losango: mediana. Escala de 0 a ${xmax / 60} h.</div>${strips}
      <div class="pb"></div>${tab('Por mês', mes, 'Mês', 14)}${tab('Por cavidades do molde', group(rows, 'cav').sort((a, b) => ordCav(a.k) - ordCav(b.k)), 'Cavidades', 14)}${tab('Por tonelagem', group(rows, 'ton').sort((a, b) => ordTon(a.k) - ordTon(b.k)), 'Tonelagem', 14)}${tab('Por tipo de molde', group(rows, 'cat').sort((a, b) => b.n - a.n), 'Molde', 8)}
      ${tab('Por injetora (25 com mais lançamentos)', group(rows, 'inj').sort((a, b) => b.n - a.n), 'Injetora', 25)}${tab('Por molde (25 com mais lançamentos)', group(rows, 'mol').sort((a, b) => b.n - a.n), 'Molde', 25)}
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('O navegador bloqueou a janela. Permita pop-ups e tente de novo.', 'erro'); return; }
    w.document.write(html); w.document.close();
    toast('Na janela que abriu, escolha "Salvar como PDF".');
  }

  // Abre o mesmo formulário da tela Produção. Ao salvar, os indicadores recarregam com os filtros mantidos.
  async function editarLancamento(id) {
    try {
      if (typeof carregarListasProducao === 'function') await carregarListasProducao();
      _dadosProducao = await db._get('prod_lancamentos', 'id=eq.' + id, '*');
      window._aoSalvarProducao = function () { window._aoSalvarProducao = null; if (q('piKpis')) carregar(); };
      await editarProd(id);
    } catch (e) { console.error(e); toast('Não foi possível abrir o lançamento.', 'erro'); }
  }

  // ---------- eventos ----------
  function ligarEventos() {
    raiz.addEventListener('click', e => {
      const t = e.target; let b;
      if ((b = t.closest('#piPresets button'))) { preset(b.dataset.p); return render(); }
      if ((b = t.closest('[data-edit]'))) return editarLancamento(+b.dataset.edit);
      if ((b = t.closest('#piCat button'))) { S.cat = b.dataset.c; return render(); }
      if ((b = t.closest('.pi-chip button'))) { remover(b.dataset.k); return render(); }
      if ((b = t.closest('[data-pi]'))) {
        const a = b.dataset.pi;
        if (a === 'limpar') { Object.assign(S, { g: '', s: '', cat: 'Todos', ton: '', cav: '', inj: '', mol: '', par: '', out: false }); preset('tudo'); return render(); }
        if (a === 'more') { S.rows = S.rows === 12 ? 999 : 12; return render(); }
        if (a === 'lim') { S.lim += 100; return render(); }
        if (a === 'xls') return exportarExcel();
        if (a === 'pdf') return exportarPdf();
      }
      if ((b = t.closest('.pi-srow'))) { S.s = b.dataset.s; const x = D.find(y => y.s === S.s); if (x) S.g = x.g; render(); return raiz.scrollIntoView({ behavior: 'smooth' }); }
      if ((b = t.closest('#piTabs button'))) { S.tab = b.dataset.t; return render(); }
      if ((b = t.closest('th.pi-sort'))) { const tt = b.dataset.t, k = b.dataset.k, [sk, sd] = S.sort[tt]; S.sort[tt] = [k, sk === k ? -sd : (['k', 'inj', 'mol', 's', 'ton', 'cav'].includes(k) ? 1 : -1)]; return render(); }
      if ((b = t.closest('tr.pi-click'))) { if (b.dataset.f === 'cav') S.cav = b.dataset.v; else if (b.dataset.f === 'ton') S.ton = b.dataset.v; else if (b.dataset.f === 'inj') S.inj = b.dataset.v; else S.mol = b.dataset.v.split(' - ')[0]; render(); return raiz.scrollIntoView({ behavior: 'smooth' }); }
    });
    raiz.addEventListener('change', e => {
      const id = e.target.id;
      if (id === 'piGrupo') { S.g = e.target.value; S.s = ''; }
      else if (id === 'piServ') S.s = e.target.value;
      else if (id === 'piCav') S.cav = e.target.value;
      else if (id === 'piTon') { S.ton = e.target.value; if (S.inj && S.ton && D.find(x => x.inj === S.inj).ton !== S.ton) S.inj = ''; }
      else if (id === 'piInj') S.inj = e.target.value;
      else if (id === 'piPar') S.par = e.target.value;
      else if (id === 'piOut') S.out = e.target.checked;
      else if (id === 'piIni') { S.ini = e.target.value || DMIN; S.preset = 'custom'; }
      else if (id === 'piFim') { S.fim = e.target.value || DMAX; S.preset = 'custom'; }
      else return;
      render();
    });
    let tm; raiz.addEventListener('input', e => { if (e.target.id !== 'piMol') return; clearTimeout(tm); tm = setTimeout(() => { S.mol = e.target.value; render(); }, 200); });
  }

  // ---------- estilo ----------
  function injetarCss() {
    if (q('piCss')) return;
    const st = document.createElement('style'); st.id = 'piCss';
    st.textContent = `
    #pcmAbaInd{--pi-ink:#14202e;--pi-mut:#5a6a7b;--pi-line:#d3dae2;--pi-soft:#e6ebf0;--pi-acc:#0056b3;--pi-accs:#dbe9f7;--pi-sig:#b86a00}
    .pcm-abas{display:flex;gap:2px;border-bottom:1px solid #d3dae2;margin-bottom:16px}
    .pcm-abas button{border:0;background:none;padding:10px 16px;cursor:pointer;font:inherit;font-weight:600;color:#5a6a7b;border-bottom:3px solid transparent;margin-bottom:-1px}
    .pcm-abas button[aria-selected=true]{color:#14202e;border-bottom-color:#0056b3}
    .pi-topo{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
    .pi-sub,.pi-hint{color:var(--pi-mut);font-size:13px}.pi-hint{margin:0 0 10px;max-width:70ch}
    .pi-frow{display:flex;gap:10px 14px;flex-wrap:wrap;align-items:flex-end}
    .pi-f{display:flex;flex-direction:column;gap:3px;min-width:0}.pi-f label,.pi-l{font-size:12px;color:var(--pi-mut);font-weight:600}
    .pi-f select,.pi-f input[type=text],.pi-f input[type=date]{min-height:36px;width:auto;max-width:100%}
    .pi-seg{display:inline-flex;border:1px solid var(--pi-line);border-radius:6px;overflow:hidden;background:#fff;flex-wrap:wrap}
    .pi-seg button{border:0;background:none;padding:7px 11px;min-height:36px;cursor:pointer;font:inherit;font-size:13px;border-right:1px solid var(--pi-soft)}
    .pi-seg button:last-child{border-right:0}.pi-seg button[aria-pressed=true]{background:var(--pi-acc);color:#fff}
    .pi-seg button:not([aria-pressed=true]):hover{background:var(--pi-accs)}
    .pi-chk{display:flex;gap:7px;align-items:center;min-height:36px;font-size:13px;cursor:pointer}.pi-chk input{width:auto}
    .pi-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;align-items:center}
    .pi-chip{display:inline-flex;gap:4px;align-items:center;background:var(--pi-accs);border-radius:999px;padding:2px 4px 2px 10px;font-size:13px}
    .pi-chip button{border:0;background:none;cursor:pointer;width:22px;height:22px;border-radius:50%;line-height:1;font-size:15px}.pi-chip button:hover{background:#fff}
    .pi-clear{border:0;background:none;color:var(--pi-acc);cursor:pointer;text-decoration:underline;font-size:13px}
    .pi-pill{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;background:var(--pi-soft)}.pi-pill.st{background:#fbead0;color:var(--pi-sig)}
    .pi-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:0 0 16px;background:#fff;border:1px solid var(--pi-line);border-radius:10px}
    .pi-k{padding:14px 16px;border-right:1px solid var(--pi-soft);min-width:0}.pi-k:last-child{border-right:0}
    .pi-v{font-size:30px;font-weight:700;line-height:1.05;font-variant-numeric:tabular-nums;color:var(--pi-ink)}.pi-v small{font-size:15px;color:var(--pi-mut);margin-left:3px;font-weight:500}
    .pi-kl{font-size:12.5px;color:var(--pi-mut);margin-top:4px}.pi-d{font-size:12px;margin-top:3px;font-weight:600}.pi-d.up{color:#b3261e}.pi-d.down{color:#17733f}.pi-d.flat{color:var(--pi-mut)}
    .pi-h{margin:0 0 3px;font-size:16px;color:var(--pi-ink)}
    .pi-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--pi-mut);margin-bottom:8px}.pi-legend i{display:inline-block;vertical-align:middle;margin-right:5px}
    .pi-ldot{width:9px;height:9px;border-radius:50%;background:rgba(0,86,179,.38);border:1px solid var(--pi-acc)}.pi-lmean{width:2px;height:14px;background:var(--pi-ink)}.pi-lmed{width:9px;height:9px;background:var(--pi-sig);transform:rotate(45deg)}
    .pi-srow{display:grid;grid-template-columns:200px minmax(0,1fr);align-items:center;border:0;border-top:1px solid var(--pi-soft);cursor:pointer;background:none;padding:0;text-align:left;width:100%;font:inherit}
    .pi-srow:hover{background:var(--pi-accs)}.pi-lab{padding:6px 10px 6px 2px;min-width:0}.pi-lab b{display:block;font-size:13.5px;overflow-wrap:anywhere}.pi-lab span{font-size:12px;color:var(--pi-mut)}.pi-n{color:var(--pi-ink);font-weight:700;font-size:13px}
    .pi-axis{display:grid;grid-template-columns:200px minmax(0,1fr)}
    .pi-two{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px}
    .pi-tabs{display:flex;gap:2px;border-bottom:1px solid var(--pi-line);margin-bottom:12px;overflow-x:auto}
    .pi-tabs button{border:0;background:none;padding:9px 14px;cursor:pointer;font:inherit;font-weight:600;color:var(--pi-mut);border-bottom:3px solid transparent;margin-bottom:-1px;white-space:nowrap}
    .pi-tabs button[aria-selected=true]{color:var(--pi-ink);border-bottom-color:var(--pi-acc)}
    th.pi-sort{cursor:pointer}th.pi-sort:hover{color:var(--pi-acc)}tr.pi-click{cursor:pointer}tr.pi-click:hover td{background:var(--pi-accs)}
    .pi-bar{display:inline-block;height:8px;background:var(--pi-acc);border-radius:2px;vertical-align:middle;margin-right:6px}
    .pi-empty{padding:24px 8px;color:var(--pi-mut);text-align:center}
    @media(max-width:900px){.pi-two{grid-template-columns:minmax(0,1fr)}}
    @media(max-width:820px){.pi-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pi-k{border-bottom:1px solid var(--pi-soft)}.pi-k:nth-child(2n){border-right:0}.pi-k:last-child{grid-column:1/-1;border-bottom:0}}
    @media(max-width:640px){.pi-srow,.pi-axis{grid-template-columns:1fr}.pi-axis>div:first-child{display:none}.pi-lab{padding-bottom:0}}`;
    document.head.appendChild(st);
  }

  // ---------- entrada ----------
  window.iniciarPcmIndicadores = function () {
    injetarCss();
    raiz = q('pcmAbaInd'); if (!raiz) return;
    raiz.replaceWith(raiz.cloneNode(false)); raiz = q('pcmAbaInd'); // zera ouvintes antigos
    carregar();
  };
  window.mostrarAbaPCM = function (aba) {
    const m = q('pcmAbaMoldes'), i = q('pcmAbaInd'); if (!m || !i) return;
    const h = q('pcmHdrAcoes'); if (h) h.style.display = aba === 'ind' ? 'none' : '';
    m.style.display = aba === 'ind' ? 'none' : ''; i.style.display = aba === 'ind' ? '' : 'none';
    document.querySelectorAll('.pcm-abas button').forEach(b => b.setAttribute('aria-selected', b.dataset.aba === aba));
    if (aba === 'ind') window.iniciarPcmIndicadores();
  };
})();
