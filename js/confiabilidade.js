// ==========================================
// 📈 CONFIABILIDADE.JS — MTBF e MTTR da Ferramentaria, por molde
// - Ocorrência = corretivas do mesmo molde (Produção + Bancada) que são a mesma falha:
//   a que ficou na máquina e depois foi para a bancada conta UMA vez.
// - MTTR da Ferramentaria = tempo que a Ferramentaria gastou por ocorrência (soma dos lançamentos).
// - MTBF = tempo montado na injetora (histórico do PCM) e ciclos (contador) entre ocorrências.
// Só usa informação que a Ferramentaria controla.
// ==========================================

var CONF_GAP_BANCADA_DIAS = 45;   // com histórico no PCM, corretiva de bancada até 45 dias depois (sem o molde voltar à máquina) é a mesma falha; sem histórico, só até 7 dias

function _confDia(iso) { const [y, m, d] = String(iso).substring(0, 10).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function _confIso(dia) { return new Date(dia * 86400000).toISOString().substring(0, 10); }
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
    origem: 'Produção', data: String(l.data).substring(0, 10), hi: l.hora_inicio || '', min: l.minutos || 0,
    onde: l.injetora || 'Produção', tec: String(l.tecnicos || '').split(',').map(t => t.trim()).filter(Boolean) }));
  // Bancada: vários técnicos no mesmo serviço geram um lançamento para cada um (mesma data, hora e duração): conta uma vez
  const bancVistos = {};
  (dados.banc || []).filter(l => l.setor === 'Bancada' && /corretiv/i.test(l.tipo || '')).forEach(l => {
    const dia = String(l.data).substring(0, 10), chave = dia + '|' + (l.hora_inicio || '') + '|' + (l.minutos || 0);
    if (bancVistos[chave]) { if (l.funcionario) bancVistos[chave].tec.push(l.funcionario); return; }
    const ev = { origem: 'Bancada', data: dia, hi: l.hora_inicio || '', min: l.minutos || 0, onde: 'Bancada', tec: l.funcionario ? [l.funcionario] : [] };
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
    o.minMaq = o.evs.filter(e => e.origem === 'Produção').reduce((a, e) => a + e.min, 0);
    o.minBanc = o.evs.filter(e => e.origem === 'Bancada').reduce((a, e) => a + e.min, 0);
    o.total = o.minMaq + o.minBanc;
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
    tendencia, suficiente: ocs.length >= 3
  };
}

async function confiabilidadeCarregar(job) {
  const enc = encodeURIComponent(job);
  const [prod, banc, hist, leituras] = await Promise.all([
    db._get('prod_lancamentos', 'molde=eq.' + enc + '&tipo=ilike.*orretiv*&order=data.asc', 'id,data,hora_inicio,minutos,tipo,injetora,tecnicos'),
    db._get('lancamentos', 'job=eq.' + enc + '&setor=eq.Bancada&tipo=ilike.*orretiv*&order=data.asc', 'id,data,hora_inicio,minutos,tipo,setor,funcionario'),
    db._get('molde_localizacao_historico', 'job=eq.' + enc + '&order=movido_em.asc,id.asc', '*'),
    db._get('molde_contador_ciclos', 'job=eq.' + enc + '&order=data.asc,id.asc', '*')
  ]);
  return { prod: prod || [], banc: banc || [], hist: hist || [], leituras: leituras || [], hoje: hojeLocal() };
}

function _confNum(n, dec) { return n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: dec || 0 }); }

function confiabilidadeHTML(job, r) {
  if (!r.ocorrencias.length && !r.leituras.length) {
    return `<div class="card" style="border-left:4px solid #f59e0b"><div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:6px">📈 Confiabilidade da Ferramentaria</div>
      <div style="font-size:13px;color:#64748b">Este molde ainda não tem corretivas nem leituras do contador de ciclos.</div></div>`;
  }
  const insuf = !r.suficiente;
  const aviso = insuf ? `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:8px">dados insuficientes: ${r.ocorrencias.length} de 3 ocorrências</span>` : '';
  const pillT = r.tendencia === 'piorando' ? '<span style="font-size:11px;background:#ef4444;color:#fff;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:6px">piorando</span>'
              : r.tendencia === 'melhorando' ? '<span style="font-size:11px;background:#10b981;color:#fff;padding:2px 8px;border-radius:10px;font-weight:700;margin-left:6px">melhorando</span>' : '';
  const mostra = (v, dec) => insuf ? '—' : _confNum(v, dec);

  const serie = r.intervalos.map(x => ({ ...x, v: x.ciclos != null ? x.ciclos : null })).filter(x => x.v != null);
  const maxV = Math.max(1, ...serie.map(x => x.v));
  const barras = serie.length ? `<div style="margin:14px 0 4px;font-weight:700;font-size:13px;color:#1e3a5f">Ciclos entre ocorrências ${pillT}</div>` +
    serie.map(x => `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12px"><span style="width:130px;color:#64748b">${_confBr(x.de).substring(0, 5)} → ${_confBr(x.ate).substring(0, 5)}</span><i style="display:block;height:16px;border-radius:4px;background:#0056b3;width:${Math.max(4, Math.round(x.v / maxV * 60))}%"></i><span>${_confNum(x.v)}</span></div>`).join('') : '';

  const linhasOc = r.ocorrencias.slice().reverse().map(o => `<tr>
      <td>${_confBr(o.ini)}${o.fim !== o.ini ? ' <span style="color:#94a3b8">→ ' + _confBr(o.fim).substring(0, 5) + '</span>' : ''}</td>
      <td>${esc(o.onde)}</td>
      <td style="text-align:right">${esc(typeof fmtMin === 'function' ? fmtMin(o.total) : o.total + ' min')}</td>
      <td style="text-align:right">${o.leitura ? _confNum(o.leitura.ciclos) : '<span style="color:#94a3b8">—</span>'}</td>
      <td>${esc(o.tec.join(', ') || '—')}</td></tr>`).join('');

  const admin = typeof isAdmin === 'function' && isAdmin();
  const linhasLeit = r.leituras.slice().reverse().map(l => `<tr>
      <td>${_confBr(l.data)}</td>
      <td style="text-align:right">${_confNum(l.ciclos)}${l.zerado ? ' <span title="contador zerado ou trocado" style="color:#f59e0b">⟲</span>' : ''}</td>
      <td style="text-align:right">${l.delta != null ? '+' + _confNum(l.delta) : '—'}</td>
      <td>${esc(l.registrado_por || '—')}</td><td>${esc(l.origem || '')}${l.tipo ? ' · ' + esc(l.tipo) : ''}</td>
      ${admin ? `<td><button class="btn-secondary" style="font-size:11px;padding:2px 8px" onclick="confiabilidadeExcluirLeitura(${Number(l.id)}, '${escJs(job)}')">🗑</button></td>` : ''}</tr>`).join('');

  return `
  <div class="card" style="border-left:4px solid #0056b3">
    <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:4px">📈 Confiabilidade da Ferramentaria ${aviso}</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:12px">Corretivas da Produção e da Bancada. Uma falha que passou da máquina para a bancada conta uma vez.</div>
    <div class="cards-row">
      <div class="metric-card" style="border-left-color:#0056b3"><div class="metric-valor">${mostra(r.mtbfDias, 0)}${!insuf && r.mtbfDias != null ? ' dias' : ''}</div><div class="metric-label">MTBF (dias montado)</div><div class="metric-sub">média entre ocorrências</div></div>
      <div class="metric-card" style="border-left-color:#10b981"><div class="metric-valor">${mostra(r.mtbfCiclos, 0)}</div><div class="metric-label">MTBF (ciclos)</div><div class="metric-sub">${r.nCiclos ? r.nCiclos + ' intervalo(s) com leitura' : 'precisa de leituras do contador'}</div></div>
      <div class="metric-card" style="border-left-color:#ef4444"><div class="metric-valor">${mostra(r.mttrTotal, 0)}${!insuf && r.mttrTotal != null ? ' min' : ''}</div><div class="metric-label">MTTR da Ferramentaria</div><div class="metric-sub">por ocorrência (soma dos lançamentos)</div></div>
      <div class="metric-card" style="border-left-color:#f59e0b"><div class="metric-valor">${r.ocorrencias.length}</div><div class="metric-label">Ocorrências</div><div class="metric-sub">${r.leituras.length ? _confNum(r.leituras[r.leituras.length - 1].ciclos) + ' ciclos na última leitura' : 'sem leitura do contador'}</div></div>
    </div>
    <div style="font-size:12px;color:#64748b;margin-top:8px">Do MTTR: <b>${_confNum(r.mttrMaq)} min</b> em média na máquina (Produção) · <b>${_confNum(r.mttrBanc)} min</b> em média na bancada.</div>
    ${barras}
    ${r.ocorrencias.length ? `<div style="margin:16px 0 6px;font-weight:700;font-size:13px;color:#1e3a5f">Ocorrências de corretiva</div>
    <div class="table-wrap"><table><thead><tr><th>Início</th><th>Onde atuamos</th><th style="text-align:right">Tempo da Ferramentaria</th><th style="text-align:right">Contador</th><th>Técnicos</th></tr></thead><tbody>${linhasOc}</tbody></table></div>` : ''}
    ${r.leituras.length ? `<div style="margin:16px 0 6px;font-weight:700;font-size:13px;color:#1e3a5f">Leituras do contador</div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th style="text-align:right">Ciclos</th><th style="text-align:right">Desde a anterior</th><th>Registrou</th><th>Origem</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>${linhasLeit}</tbody></table></div>` : ''}
    <div style="background:#e8f0fa;border-radius:8px;padding:10px 12px;font-size:12px;color:#5a6a7b;margin-top:14px"><b style="color:#14202e">Como é calculado.</b>
      Ocorrência = corretivas do mesmo molde sem o molde voltar para a máquina no meio (usa o histórico do PCM). MTTR = tempo de trabalho da Ferramentaria ÷ ocorrências. MTBF = dias montado na injetora, ou ciclos do contador, entre uma ocorrência e a próxima, em média. Não usa tempo de máquina parada, que é da produção. Com menos de 3 ocorrências os números não aparecem.</div>
  </div>`;
}

async function confiabilidadeRenderizar(job) {
  const el = document.getElementById('fichaConfiab');
  if (!el) return;
  try {
    const dados = await confiabilidadeCarregar(job);
    if (document.getElementById('fichaConfiab') !== el) return;
    el.innerHTML = confiabilidadeHTML(job, confCalcular(dados));
  } catch (e) {
    console.error(e);
    el.innerHTML = '<div class="card"><div style="font-size:13px;color:#b91c1c">Não foi possível carregar a confiabilidade deste molde.</div></div>';
  }
}

function confiabilidadeExcluirLeitura(id, job) {
  confirmarExclusao('Excluir esta leitura do contador?', async function () {
    try { await db._delete('molde_contador_ciclos', 'id=eq.' + id); toast('Leitura excluída!', 'sucesso'); confiabilidadeRenderizar(job); }
    catch (e) { toast('Erro ao excluir a leitura.', 'erro'); }
  });
}

if (typeof module !== 'undefined') module.exports = { confCalcular };
