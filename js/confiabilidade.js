// ==========================================
// 📈 CONFIABILIDADE.JS — MTBF e MTTR da Ferramentaria, por molde
// - Ocorrência = corretivas do mesmo molde (Produção + Bancada) que são a mesma falha:
//   a que ficou na máquina e depois foi para a bancada conta UMA vez.
// - MTTR = tempo corrido do molde parado por ocorrência (da corretiva até voltar à injetora); sem histórico do PCM, trabalho efetivo sem sobreposição.
// - MTBF = tempo montado na injetora (histórico do PCM) e ciclos (contador) entre ocorrências.
// Só usa informação que a Ferramentaria controla.
// ==========================================

var CONF_GAP_BANCADA_DIAS = 45;   // com histórico no PCM, corretiva de bancada até 45 dias depois (sem o molde voltar à máquina) é a mesma falha; sem histórico, só até 7 dias

function _confDia(iso) { const [y, m, d] = String(iso).substring(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function _confIso(dia) { return new Date(dia * 86400000).toISOString().substring(0, 10); }
// minutos de "relógio de parede" (hora local) a partir de data + hora do lançamento, ou de um timestamp do histórico
function _confMinLanc(dia, hi) { const [y, m, d] = String(dia).substring(0, 10).split('-').map(Number); const h = /^(\d{1,2}):(\d{2})/.exec(hi || ''); return Date.UTC(y, m - 1, d, h ? +h[1] : 0, h ? +h[2] : 0) / 60000; }
function _confMinTs(ts) { const d = new Date(ts); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 60000; }
function _confBr(iso) { return String(iso).substring(0, 10).split('-').reverse().join('/'); }

// Função pura (testável): recebe os dados já carregados e devolve os indicadores
function confCalcular(dados) {
  const hoje = _confDia(dados.hoje);
  const hist = (dados.hist || []).slice().sort((a, b) => String(a.movido_em).localeCompare(String(b.movido_em)) || a.id - b.id);
  const emMaquinaDias = hist.filter(h => h.localizacao === 'Em Máquina').map(h => _confDia(h.movido_em));
  const inicioHist = hist.length ? _confDia(hist[0].movido_em) : Infinity;   // antes disso não sabemos onde o molde estava

  // 1) Corretivas de Produção e de Bancada
  const evs = [];
  (dados.prod || []).filter(l => /corretiv/i.test(l.tipo || '')).forEach(l => evs.push({
    origem: 'Produção', id: l.id, ativ: l.atividade || '', desc: l.descricao || '', data: String(l.data).substring(0, 10), hi: l.hora_inicio || '', min: l.minutos || 0,
    onde: l.injetora || 'Produção', tec: String(l.tecnicos || '').split(',').map(t => t.trim()).filter(Boolean) }));
  // Bancada: vários técnicos no mesmo serviço geram um lançamento para cada um (mesma data, hora e duração): conta uma vez
  const bancVistos = {};
  (dados.banc || []).filter(l => l.setor === 'Bancada' && /corretiv/i.test(l.tipo || '')).forEach(l => {
    const dia = String(l.data).substring(0, 10), chave = dia + '|' + (l.hora_inicio || '') + '|' + (l.minutos || 0);
    if (bancVistos[chave]) { if (l.funcionario) bancVistos[chave].tec.push(l.funcionario); return; }
    const ev = { origem: 'Bancada', id: l.id, ativ: '', desc: l.descricao || '', data: dia, hi: l.hora_inicio || '', min: l.minutos || 0, onde: 'Bancada', tec: l.funcionario ? [l.funcionario] : [] };
    bancVistos[chave] = ev; evs.push(ev);
  });
  evs.sort((a, b) => a.data.localeCompare(b.data) || (a.origem === b.origem ? a.hi.localeCompare(b.hi) : (a.origem === 'Produção' ? -1 : 1)));

  // 2) Agrupa em ocorrências
  const ocs = [];
  evs.forEach(ev => {
    const cur = ocs[ocs.length - 1];
    let junta = false;
    if (cur) {
      const d0 = _confDia(cur.fim), d1 = _confDia(ev.data);
      const voltouParaMaquina = emMaquinaDias.some(d => d > d0 && d <= d1);
      const limite = ev.origem === 'Bancada' ? (d1 >= inicioHist ? CONF_GAP_BANCADA_DIAS : 7) : 1;
      junta = !voltouParaMaquina && (d1 - d0) <= limite;
    }
    if (junta) { cur.fim = ev.data; cur.evs.push(ev); }
    else ocs.push({ ini: ev.data, fim: ev.data, evs: [ev] });
  });
  ocs.forEach(o => {
    // Tempo real decorrido: se dois técnicos lançaram o mesmo serviço em horários que se sobrepõem, o tempo em paralelo conta uma vez só
    const doTipo = t => o.evs.filter(e => e.origem === t);
    o.minMaq = _confUniaoMin(doTipo('Produção'));
    o.minBanc = _confUniaoMin(doTipo('Bancada'));
    o.total = o.minMaq + o.minBanc;
    o.minSoma = o.evs.reduce((a, e) => a + e.min, 0);   // soma bruta dos lançamentos (horas-homem), só para referência
    o.trabalho = o.total;   // tempo de trabalho decorrido (sem sobreposição)
    // MTTR = tempo corrido: da primeira corretiva até o molde voltar para a injetora. Só dá para saber onde o histórico do PCM já existia.
    o.base = 'trabalho';
    if (_confDia(o.ini) >= inicioHist) {
      const ini = Math.min(...o.evs.map(e => _confMinLanc(e.data, e.hi)));
      const fimEv = Math.max(...o.evs.map(e => _confMinLanc(e.data, e.hi) + e.min));
      const volta = hist.find(h => h.localizacao === 'Em Máquina' && _confMinTs(h.movido_em) >= ini);
      if (volta) { const vm = _confMinTs(volta.movido_em); if (vm > ini) { o.total = Math.max(vm - ini, o.trabalho); o.base = 'corrido'; o.voltouEm = volta.movido_em; } }
    }
    const passos = []; o.evs.forEach(e => { const p = e.origem === 'Bancada' ? 'Bancada' : 'Produção ' + e.onde; if (!passos.includes(p)) passos.push(p); });
    o.onde = passos.join(' → ');
    o.tec = [...new Set(o.evs.flatMap(e => e.tec))];
  });

  // 3) Leituras do contador, em ciclos acumulados (se o contador foi zerado, continua somando)
  const leit = (dados.leituras || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)) || a.id - b.id);
  let off = 0, prev = null, prevAdj = 0;
  leit.forEach(l => {
    if (l.zerado && prev) off += prev.ciclos;
    let adj = off + l.ciclos; if (adj < prevAdj) adj = prevAdj;
    l.adj = adj; l.delta = (prev && !l.zerado) ? Math.max(0, l.ciclos - prev.ciclos) : null;
    prev = l; prevAdj = adj;
  });
  ocs.forEach(o => { const l = leit.find(x => String(x.data).substring(0, 10) >= o.ini && String(x.data).substring(0, 10) <= o.fim); o.leitura = l || null; });

  // 4) Períodos em que o molde esteve montado na injetora (histórico do PCM)
  const montado = []; let ab = null;
  hist.forEach(h => {
    const d = _confDia(h.movido_em);
    if (h.localizacao === 'Em Máquina') { if (ab === null) ab = d; }
    else if (ab !== null) { montado.push([ab, d]); ab = null; }
  });
  if (ab !== null) montado.push([ab, hoje]);
  const diasMontado = (a, b) => montado.reduce((s, [x, y]) => s + Math.max(0, Math.min(y, b) - Math.max(x, a)), 0);

  // 5) Intervalos entre ocorrências consecutivas
  const ints = [];
  for (let i = 1; i < ocs.length; i++) {
    const a = ocs[i - 1], b = ocs[i];
    // Só conta dias montado quando o histórico do PCM já existia no começo da janela
    const dm = _confDia(a.fim) >= inicioHist ? diasMontado(_confDia(a.fim), _confDia(b.ini)) : 0;
    const ci = (a.leitura && b.leitura && b.leitura.adj > a.leitura.adj) ? b.leitura.adj - a.leitura.adj : null;
    ints.push({ de: a.fim, ate: b.ini, diasMontado: dm > 0 ? dm : null, ciclos: ci });
  }
  const media = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  const dm = ints.map(x => x.diasMontado).filter(x => x != null);
  const cc = ints.map(x => x.ciclos).filter(x => x != null);
  const maq = ocs.filter(o => o.minMaq > 0).map(o => o.minMaq);
  const ban = ocs.filter(o => o.minBanc > 0).map(o => o.minBanc);

  let tendencia = null;
  const serie = cc.length >= 3 ? cc : (dm.length >= 3 ? dm : null);
  if (serie) {
    const ult = serie[serie.length - 1], mAnt = media(serie.slice(0, -1));
    tendencia = ult < mAnt * 0.7 ? 'piorando' : (ult > mAnt * 1.3 ? 'melhorando' : 'estável');
  }
  return {
    ocorrencias: ocs, leituras: leit, intervalos: ints,
    mtbfDias: media(dm), mtbfCiclos: media(cc), nDias: dm.length, nCiclos: cc.length,
    mttrTotal: media(ocs.map(o => o.total)), mttrMaq: media(maq), mttrBanc: media(ban),
    tendencia, suficiente: ocs.length >= 3,
    montado, hojeDia: hoje, inicioHist: isFinite(inicioHist) ? inicioHist : null
  };
}

// Soma o tempo dos lançamentos sem contar duas vezes os trechos de relógio em que mais de um técnico trabalhou ao mesmo tempo.
// Lançamento sem hora de início não dá para comparar: entra pelo tempo informado.
function _confUniaoMin(evs) {
  let total = 0; const porDia = {};
  evs.forEach(e => {
    const m = /^(\d{1,2}):(\d{2})/.exec(e.hi || '');
    if (!m || !(e.min > 0)) { total += e.min || 0; return; }
    const a = (+m[1]) * 60 + (+m[2]);
    (porDia[e.data] = porDia[e.data] || []).push([a, a + e.min]);
  });
  Object.values(porDia).forEach(iv => {
    iv.sort((x, y) => x[0] - y[0]);
    let [ini, fim] = iv[0];
    for (let i = 1; i < iv.length; i++) {
      if (iv[i][0] <= fim) fim = Math.max(fim, iv[i][1]);
      else { total += fim - ini; [ini, fim] = iv[i]; }
    }
    total += fim - ini;
  });
  return total;
}

async function confiabilidadeCarregar(job) {
  const enc = encodeURIComponent(job);
  const [prod, banc, hist, leituras] = await Promise.all([
    db._get('prod_lancamentos', 'molde=eq.' + enc + '&tipo=ilike.*orretiv*&order=data.asc', 'id,data,hora_inicio,minutos,tipo,atividade,descricao,injetora,tecnicos'),
    db._get('lancamentos', 'job=eq.' + enc + '&setor=eq.Bancada&tipo=ilike.*orretiv*&order=data.asc', 'id,data,hora_inicio,minutos,tipo,setor,funcionario,descricao'),
    db._get('molde_localizacao_historico', 'job=eq.' + enc + '&order=movido_em.asc,id.asc', '*'),
    db._get('molde_contador_ciclos', 'job=eq.' + enc + '&order=data.asc,id.asc', '*')
  ]);
  return { prod: prod || [], banc: banc || [], hist: hist || [], leituras: leituras || [], hoje: hojeLocal() };
}

function _confNum(n, dec) { return n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: dec || 0 }); }


// Linha do tempo da vida do molde: verde = montado na injetora, cinza = fora da máquina, vermelho = ocorrência de corretiva
function _confSvgLinhaTempo(r) {
  if (!r.montado || !r.montado.length || !r.ocorrencias.length) return '';
  const ocD = r.ocorrencias.map(o => ({ ini: _confDia(o.ini), fim: _confDia(o.fim), o }));
  const d0 = Math.min(r.montado[0][0], ...ocD.map(x => x.ini)), d1 = Math.max(r.hojeDia, ...ocD.map(x => x.fim));
  const W = 640, ml = 12, mr = 12, hb = 22, span = Math.max(1, d1 - d0);
  const x = d => ml + (d - d0) / span * (W - ml - mr);
  // Rótulos em até 5 "andares" para não se sobreporem (cada rótulo ocupa ~78 unidades)
  const LW = 78, niveis = [];
  const rot = ocD.map(m => {
    const cx = x((m.ini + m.fim) / 2); let n = 0;
    while (niveis[n] !== undefined && cx - niveis[n] < LW) n++;
    niveis[n] = cx; return { m, cx, n };
  });
  const nMax = Math.min(4, Math.max(...rot.map(q => q.n)));
  const yb = 22 + (nMax + 1) * 12;
  const mont = r.montado.map(([a, b]) => `<rect x="${x(a).toFixed(1)}" y="${yb}" width="${Math.max(2, x(Math.min(b, d1)) - x(a)).toFixed(1)}" height="${hb}" fill="#10b981" rx="3"><title>Montado na injetora: ${_confBr(_confIso(a))} a ${_confBr(_confIso(Math.min(b, d1)))} (${Math.min(b, d1) - a} dias)</title></rect>`).join('');
  const semHist = r.inicioHist != null && r.inicioHist > d0
    ? `<rect x="${ml}" y="${yb}" width="${(x(r.inicioHist) - ml).toFixed(1)}" height="${hb}" fill="url(#confHach)" rx="3"><title>Antes de ${_confBr(_confIso(r.inicioHist))} o sistema não sabe onde o molde estava</title></rect>` : '';
  // meses no eixo
  const ticks = []; const dt = new Date(d0 * 86400000); dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + 1);
  for (; dt.getTime() / 86400000 < d1; dt.setUTCMonth(dt.getUTCMonth() + 1)) ticks.push(Math.round(dt.getTime() / 86400000));
  const eixo = ticks.map(t => `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${yb + hb}" y2="${yb + hb + 5}" stroke="#94a3b8"/><text x="${x(t).toFixed(1)}" y="${yb + hb + 16}" text-anchor="middle" font-size="9" fill="#64748b">${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][new Date(t * 86400000).getUTCMonth()]}</text>`).join('');
  const marc = rot.map(({ m, cx, n }) => {
    const ty = 12 + (nMax - Math.min(n, nMax)) * 12 + 0;   // andar 0 (mais perto da barra) fica embaixo
    const ya = yb - 4 - 12 * Math.min(n, nMax) - 4;
    return `<rect x="${(x(m.ini) - 1).toFixed(1)}" y="${yb - 4}" width="${Math.max(3, x(m.fim) - x(m.ini) + 2).toFixed(1)}" height="${hb + 8}" fill="#ef4444" rx="2"><title>Corretiva ${_confBr(m.o.ini)}: ${_confNum(m.o.total)} min da Ferramentaria (${esc(m.o.onde)})</title></rect>` +
      `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${ya + 2}" y2="${yb - 4}" stroke="#ef4444" stroke-width="1"/>` +
      `<text x="${cx.toFixed(1)}" y="${ya}" text-anchor="${cx > W - 50 ? 'end' : cx < 50 ? 'start' : 'middle'}" font-size="9" font-weight="700" fill="#b91c1c" stroke="#fff" stroke-width="2.5" paint-order="stroke">${_confBr(m.o.ini).substring(0, 5)} · ${_confNum(m.o.total)}m</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${yb + hb + 22}" style="width:100%;max-width:820px;height:auto;display:block" role="img" aria-label="Linha do tempo do molde">
    <defs><pattern id="confHach" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f1f5f9"/><line x1="0" y1="0" x2="0" y2="6" stroke="#cbd5e1" stroke-width="2"/></pattern></defs>
    <rect x="${ml}" y="${yb}" width="${W - ml - mr}" height="${hb}" fill="#e2e8f0" rx="3"/>${semHist}${mont}${marc}${eixo}</svg>
    <div style="font-size:11px;color:#64748b;display:flex;gap:14px;flex-wrap:wrap;margin-top:2px">
      <span><i style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px"></i> montado na injetora</span>
      <span><i style="display:inline-block;width:10px;height:10px;background:#e2e8f0;border-radius:2px;border:1px solid #cbd5e1"></i> fora da máquina</span>
      ${semHist ? '<span><i style="display:inline-block;width:10px;height:10px;background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 2px,#cbd5e1 2px,#cbd5e1 4px);border-radius:2px"></i> sem histórico de localização</span>' : ''}
      <span><i style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px"></i> corretiva (data · minutos da Ferramentaria)</span></div>`;
}

// Gráfico de barras em SVG. itens: [{rot, partes:[{v,cor}]}]; barras empilhadas; linha tracejada = média
function _confSvgBarras(itens, op) {
  const W = 420, H = 190, ml = 44, mr = 10, mt = 16, mb = 38;
  const tot = i => i.partes.reduce((a, p) => a + p.v, 0);
  const maxV = Math.max(1, ...itens.map(tot), op.media || 0) * 1.12;
  const n = itens.length, bw = Math.min(46, (W - ml - mr) / n * 0.62), passo = (W - ml - mr) / n;
  const y = v => mt + (H - mt - mb) * (1 - v / maxV);
  const grade = [0, 0.5, 1].map(f => { const v = maxV / 1.12 * f; return `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${ml - 5}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${_confNum(v)}</text>`; }).join('');
  const bars = itens.map((it, k) => {
    const x = ml + passo * k + (passo - bw) / 2; let acc = 0;
    const segs = it.partes.filter(p => p.v > 0).map(p => { const y0 = y(acc + p.v), h = y(acc) - y0; acc += p.v; return `<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" fill="${p.cor}" rx="3"><title>${esc((p.nome ? p.nome + ': ' : '') + _confNum(p.v) + ' ' + op.un)}</title></rect>`; }).join('');
    return segs + `<text x="${(x + bw / 2).toFixed(1)}" y="${(y(acc) - 4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e3a5f">${_confNum(acc)}</text>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${H - mb + 13}" text-anchor="middle" font-size="9" fill="#64748b">${esc(it.rot)}</text>`;
  }).join('');
  const med = op.media != null && op.ok ? `<line x1="${ml}" x2="${W - mr}" y1="${y(op.media)}" y2="${y(op.media)}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5 3"/><text x="${W - mr}" y="${y(op.media) - 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#ef4444" stroke="#fff" stroke-width="3" paint-order="stroke">média ${_confNum(op.media)}</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:520px;height:auto;display:block" role="img" aria-label="Gráfico de barras em ${esc(op.un)}">${grade}${bars}${med}</svg>`;
}

function confiabilidadePartes(job, r) {
  if (!r.ocorrencias.length && !r.leituras.length) {
    return { topo: `<div class="card" style="border-left:4px solid #f59e0b"><div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:6px">📈 Confiabilidade da Ferramentaria</div>
      <div style="font-size:13px;color:#64748b">Este molde ainda não tem corretivas nem leituras do contador de ciclos.</div></div>`, base: '' };
  }
  const insuf = !r.suficiente;
  const aviso = insuf ? `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:8px">dados insuficientes: ${r.ocorrencias.length} de 3 ocorrências</span>` : '';
  const pillT = r.tendencia === 'piorando' ? '<span style="font-size:11px;background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:6px">piorando</span>'
              : r.tendencia === 'melhorando' ? '<span style="font-size:11px;background:#10b981;color:#fff;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:6px">melhorando</span>' : '';
  const mostra = (v, dec) => insuf ? '—' : _confNum(v, dec);

  // Gráficos (SVG, sem biblioteca): MTBF em dias e em ciclos, MTTR por ocorrência e onde o tempo foi gasto
  const grafTit = (t, extra) => `<div style="margin:18px 0 6px;font-weight:700;font-size:13px;color:#1e3a5f">${t} ${extra || ''}</div>`;
  const dd = x => _confBr(x.de).substring(0, 5) + '→' + _confBr(x.ate).substring(0, 5);
  const serieDias = r.intervalos.filter(x => x.diasMontado != null).map(x => ({ rot: dd(x), partes: [{ v: x.diasMontado, cor: '#0056b3' }] }));
  const serieCic = r.intervalos.filter(x => x.ciclos != null).map(x => ({ rot: dd(x), partes: [{ v: x.ciclos, cor: '#10b981' }] }));
  const serieMttr = r.ocorrencias.map(o => ({ rot: _confBr(o.ini).substring(0, 5), partes: o.base === 'corrido' ? [{ v: o.total, cor: '#ef4444', nome: 'molde parado (corrido)' }] : [{ v: o.minMaq || 0, cor: '#0056b3', nome: 'máquina' }, { v: o.minBanc || 0, cor: '#f59e0b', nome: 'bancada' }] }));
  const totMaq = r.ocorrencias.reduce((a, o) => a + (o.minMaq || 0), 0), totBanc = r.ocorrencias.reduce((a, o) => a + (o.minBanc || 0), 0);
  const pctMaq = totMaq + totBanc ? Math.round(totMaq / (totMaq + totBanc) * 100) : null;
  const legenda = '<span style="font-size:11px;color:#64748b;font-weight:400;margin-left:6px"><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:3px"></span>corrido até voltar à injetora <span style="display:inline-block;width:10px;height:10px;background:#0056b3;border-radius:2px;margin:0 3px 0 8px"></span>trabalho na máquina <span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;margin:0 3px 0 8px"></span>bancada</span>';
  const linhaTempo = _confSvgLinhaTempo(r);
  const barras =
    (linhaTempo ? `${grafTit('🕒 Linha do tempo do molde: onde ficou e quando falhou')}${linhaTempo}` : '') +
    ((serieDias.length || serieCic.length) ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
      ${serieDias.length ? `<div>${grafTit('📆 MTBF: dias montado entre ocorrências', pillT)}${_confSvgBarras(serieDias, { media: r.mtbfDias, un: 'dias', ok: !insuf })}</div>` : ''}
      ${serieCic.length ? `<div>${grafTit('🔢 MTBF: ciclos entre ocorrências', serieDias.length ? '' : pillT)}${_confSvgBarras(serieCic, { media: r.mtbfCiclos, un: 'ciclos', ok: !insuf })}</div>` : ''}
    </div>` : `<div style="font-size:12px;color:#64748b;margin-top:14px">O gráfico de MTBF aparece a partir de 2 ocorrências.</div>`) +
    (serieMttr.length ? `${grafTit('🛠️ MTTR: tempo corrido do molde parado em cada ocorrência (min)', legenda)}${_confSvgBarras(serieMttr, { media: r.mttrTotal, un: 'min', ok: !insuf })}` : '') +
    (pctMaq != null ? `${grafTit('⚖️ Onde o tempo foi gasto')}<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;font-size:11px;font-weight:700;color:#fff"><div style="width:${pctMaq}%;background:#0056b3;display:flex;align-items:center;justify-content:center;min-width:${pctMaq ? 28 : 0}px">${pctMaq}%</div><div style="width:${100 - pctMaq}%;background:#f59e0b;display:flex;align-items:center;justify-content:center;min-width:${100 - pctMaq ? 28 : 0}px">${100 - pctMaq}%</div></div>
      <div style="font-size:11px;color:#64748b;margin-top:3px">Máquina (Produção): ${_confNum(totMaq)} min · Bancada: ${_confNum(totBanc)} min</div>` : '');

  const podeEd = typeof podeEditar === 'function' && podeEditar();
  const fm = m => esc(typeof fmtMin === 'function' ? fmtMin(m) : m + ' min');
  const linhaLanc = e => `<div style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;border-top:1px dashed #e2e8f0;font-size:12px">
      ${podeEd ? `<button class="btn-secondary" style="font-size:11px;padding:2px 8px;flex:none" onclick="confiabilidadeEditarLanc('${e.origem === 'Bancada' ? 'Bancada' : 'Producao'}', ${Number(e.id)}, '${esc(e.data)}', '${escJs(job)}')">✏️ Editar</button>` : ''}
      <div style="flex:none;min-width:92px;color:#475569"><b>${_confBr(e.data).substring(0, 5)}</b>${e.hi ? ' ' + esc(String(e.hi).substring(0, 5)) : ''}</div>
      <div style="flex:none;min-width:110px;font-weight:600;color:${e.origem === 'Bancada' ? '#b45309' : '#0056b3'}">${e.origem === 'Bancada' ? 'Bancada' : 'Produção ' + esc(e.onde)}</div>
      <div style="flex:none;min-width:60px;text-align:right">${fm(e.min)}</div>
      <div style="flex:1;min-width:0;color:#334155">${e.ativ ? '<b>' + esc(e.ativ) + '</b>' : ''}${e.ativ && e.desc ? ' — ' : ''}${esc(e.desc.length > 160 ? e.desc.slice(0, 160) + '…' : e.desc)}${(e.ativ || e.desc) ? '<br>' : ''}<span style="color:#64748b">${esc(e.tec.join(', ') || '—')}</span></div></div>`;
  const linhasOc = r.ocorrencias.slice().reverse().map(o => `<tr style="background:#f8fafc;cursor:pointer" onclick="confiabilidadeToggleOc(this)" title="Clique para ver os lançamentos">
      <td><span class="conf-seta" style="display:inline-block;width:14px;color:#0056b3;transition:transform .15s">▶</span> ${_confBr(o.ini)}${o.fim !== o.ini ? ' <span style="color:#94a3b8">→ ' + _confBr(o.fim).substring(0, 5) + '</span>' : ''}</td>
      <td>${esc(o.onde)}</td>
      <td style="text-align:right">${fm(o.total)}</td>
      <td style="text-align:right">${o.leitura ? _confNum(o.leitura.ciclos) : '<span style="color:#94a3b8">—</span>'}</td>
      <td>${esc(o.tec.join(', ') || '—')}</td></tr>
    <tr class="conf-det" style="display:none"><td colspan="5" style="padding:2px 10px 10px 24px"><div style="font-size:11px;color:#64748b;margin-bottom:2px">Lançamentos desta ocorrência (${o.evs.length})${o.base === 'corrido' ? ` · molde parado ${fm(o.total)} corridos, até voltar para a injetora em ${_confBr(o.voltouEm)} (trabalho efetivo ${fm(o.trabalho)}; soma bruta dos lançamentos ${fm(o.minSoma)})` : ` · sem histórico de volta à injetora: conta o trabalho efetivo ${fm(o.trabalho)} (soma bruta dos lançamentos ${fm(o.minSoma)}; técnicos no mesmo horário contam uma vez)`}</div>${o.evs.map(linhaLanc).join('')}</td></tr>`).join('');

  const admin = typeof isAdmin === 'function' && isAdmin();
  const linhasLeit = r.leituras.slice().reverse().map(l => `<tr>
      <td>${_confBr(l.data)}</td>
      <td style="text-align:right">${_confNum(l.ciclos)}${l.zerado ? ' <span title="contador zerado ou trocado" style="color:#f59e0b">⟲</span>' : ''}</td>
      <td style="text-align:right">${l.delta != null ? '+' + _confNum(l.delta) : '—'}</td>
      <td>${esc(l.registrado_por || '—')}</td><td>${esc(l.origem || '')}${l.tipo ? ' · ' + esc(l.tipo) : ''}</td>
      ${admin ? `<td><button class="btn-secondary" style="font-size:11px;padding:2px 8px" onclick="confiabilidadeExcluirLeitura(${Number(l.id)}, '${escJs(job)}')">🗑</button></td>` : ''}</tr>`).join('');

  const topo = `
  <div class="card" style="border-left:4px solid #0056b3">
    <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:4px">📈 Confiabilidade da Ferramentaria ${aviso}</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:12px">Corretivas da Produção e da Bancada. Uma falha que passou da máquina para a bancada conta uma vez.</div>
    <div class="cards-row">
      <div class="metric-card" style="border-left-color:#0056b3"><div class="metric-valor">${mostra(r.mtbfDias, 0)}${!insuf && r.mtbfDias != null ? ' dias' : ''}</div><div class="metric-label">MTBF (dias montado)</div><div class="metric-sub">média entre ocorrências</div></div>
      <div class="metric-card" style="border-left-color:#10b981"><div class="metric-valor">${mostra(r.mtbfCiclos, 0)}</div><div class="metric-label">MTBF (ciclos)</div><div class="metric-sub">${r.nCiclos ? r.nCiclos + ' intervalo(s) com leitura' : 'precisa de leituras do contador'}</div></div>
      <div class="metric-card" style="border-left-color:#ef4444"><div class="metric-valor">${mostra(r.mttrTotal, 0)}${!insuf && r.mttrTotal != null ? ' min' : ''}</div><div class="metric-label">MTTR (molde parado)</div><div class="metric-sub">tempo corrido, da corretiva até voltar à injetora</div></div>
      <div class="metric-card" style="border-left-color:#f59e0b"><div class="metric-valor">${r.ocorrencias.length}</div><div class="metric-label">Ocorrências</div><div class="metric-sub">${r.leituras.length ? _confNum(r.leituras[r.leituras.length - 1].ciclos) + ' ciclos na última leitura' : 'sem leitura do contador'}</div></div>
    </div>
    <div style="font-size:12px;color:#64748b;margin-top:8px">Trabalho efetivo da Ferramentaria por ocorrência: <b>${_confNum(r.mttrMaq)} min</b> em média na máquina (Produção) · <b>${_confNum(r.mttrBanc)} min</b> em média na bancada. ${r.ocorrencias.some(o => o.base !== 'corrido') ? `<br>${r.ocorrencias.filter(o => o.base === 'corrido').length} de ${r.ocorrencias.length} ocorrências têm tempo corrido; as demais (antes do histórico do PCM) entram pelo trabalho efetivo.` : ''}</div>
    ${barras}
  </div>`;
  const base = `
  <div class="card" style="border-left:4px solid #0056b3">
    ${r.ocorrencias.length ? `<div style="margin:0 0 6px;font-weight:700;font-size:13px;color:#1e3a5f">Ocorrências de corretiva</div>
    <div class="table-wrap"><table><thead><tr><th>Início <span style="font-weight:400;color:#94a3b8">(clique na linha para ver os lançamentos)</span></th><th>Onde atuamos</th><th style="text-align:right">Tempo parado</th><th style="text-align:right">Contador</th><th>Técnicos</th></tr></thead><tbody>${linhasOc}</tbody></table></div>` : ''}
    ${r.leituras.length ? `<div style="margin:16px 0 6px;font-weight:700;font-size:13px;color:#1e3a5f">Leituras do contador</div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th style="text-align:right">Ciclos</th><th style="text-align:right">Desde a anterior</th><th>Registrou</th><th>Origem</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>${linhasLeit}</tbody></table></div>` : ''}
    <div style="background:#e8f0fa;border-radius:8px;padding:10px 12px;font-size:12px;color:#5a6a7b;margin-top:14px"><b style="color:#14202e">Como é calculado.</b>
      Ocorrência = corretivas do mesmo molde sem o molde voltar para a máquina no meio (usa o histórico do PCM). MTTR = tempo corrido do molde parado, da primeira corretiva até ele voltar para a injetora (histórico do PCM), em média por ocorrência; nunca soma as horas de várias pessoas. Antes do histórico do PCM (30/06/2026) não dá para saber quando voltou: nesses casos entra o trabalho efetivo, sem contar duas vezes quem trabalhou no mesmo horário. MTBF = dias montado na injetora, ou ciclos do contador, entre uma ocorrência e a próxima, em média. Com menos de 3 ocorrências os números não aparecem.</div>
  </div>`;
  return { topo, base };
}

function confiabilidadeHTML(job, r) { const p = confiabilidadePartes(job, r); return p.topo + p.base; }

async function confiabilidadeRenderizar(job) {
  const el = document.getElementById('fichaConfiab');
  if (!el) return;
  try {
    const dados = await confiabilidadeCarregar(job);
    if (document.getElementById('fichaConfiab') !== el) return;
    const p = confiabilidadePartes(job, confCalcular(dados));
    el.innerHTML = p.topo;
    const base = document.getElementById('fichaConfiabBase'); if (base) base.innerHTML = p.base;
  } catch (e) {
    console.error(e);
    el.innerHTML = '<div class="card"><div style="font-size:13px;color:#b91c1c">Não foi possível carregar a confiabilidade deste molde.</div></div>';
  }
}

function confiabilidadeToggleOc(tr) {
  const det = tr.nextElementSibling; if (!det) return;
  const abre = det.style.display === 'none';
  det.style.display = abre ? '' : 'none';
  const seta = tr.querySelector('.conf-seta'); if (seta) seta.style.transform = abre ? 'rotate(90deg)' : '';
}

// Abre o mesmo formulário de edição de Produção/Bancada; ao salvar, a ficha recalcula a confiabilidade
async function confiabilidadeEditarLanc(origem, id, data, job) {
  try {
    const recarregar = function () { window._aoSalvarProducao = null; window._aoSalvarLancamento = null; confiabilidadeRenderizar(job); };
    if (origem === 'Bancada') {
      _setorAtivo = 'Bancada';
      _dadosApontamentos = await db.buscarLancamentosDia('Bancada', data, 'Todas');
      window._aoSalvarLancamento = recarregar;
      editarApontamentoPorId(id);
    } else {
      if (typeof carregarListasProducao === 'function') await carregarListasProducao();
      _dadosProducao = await db._get('prod_lancamentos', 'id=eq.' + id, '*');
      window._aoSalvarProducao = recarregar;
      await editarProd(id);
    }
  } catch (e) { console.error(e); toast('Não foi possível abrir o lançamento.', 'erro'); }
}

function confiabilidadeExcluirLeitura(id, job) {
  confirmarExclusao('Excluir esta leitura do contador?', async function () {
    try { await db._delete('molde_contador_ciclos', 'id=eq.' + id); toast('Leitura excluída!', 'sucesso'); confiabilidadeRenderizar(job); }
    catch (e) { toast('Erro ao excluir a leitura.', 'erro'); }
  });
}

if (typeof module !== 'undefined') module.exports = { confCalcular };
