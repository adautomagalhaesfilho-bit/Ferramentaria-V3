// ==========================================
// 📈 CONFIABILIDADE — DF, MTBF, MTTR e Backlog
// Calculado só com os lançamentos do próprio sistema (Produção, PCM, Pendências, RAM).
// Visões: Injetoras (equipamento) e Moldes (ativo da ferramentaria).
// As funções de cálculo (calc*) são puras, sem acesso a tela ou banco.
// ==========================================

var _confEstado = { escopo: 'injetoras', sub: 'resumo', horasDia: 24, diasSemana: 7, soParada: false, dados: null, chave: null, ts: 0 };
try {
  const salvo = JSON.parse(localStorage.getItem('confCfg') || 'null');
  if (salvo) {
    if ([24, 22, 16, 8].includes(salvo.horasDia)) _confEstado.horasDia = salvo.horasDia;
    if ([7, 6, 5].includes(salvo.diasSemana)) _confEstado.diasSemana = salvo.diasSemana;
    if (typeof salvo.soParada === 'boolean') _confEstado.soParada = salvo.soParada;
  }
} catch (e) { /* sem storage: usa o padrão */ }

const _CONF_MAX_MIN = 720; // lançamento com mais de 12h é tratado como esquecido aberto (fora das médias)

// ---------- helpers de cálculo ----------
function _confTipo(t) {
  const s = String(t || '').toLowerCase();
  if (s.includes('corret')) return 'Corretiva';
  if (s.includes('prevent')) return 'Preventiva';
  if (s.includes('inspe')) return 'Inspeção';
  if (s.includes('setup')) return 'Setup';
  return 'Outro';
}

function _confDuracao(p) {
  const m = Number(p.minutos) || 0;
  return (m > 0 && m <= _CONF_MAX_MIN) ? m : null;
}

function _confDiasValidos(ini, fim, diasSemana) {
  let n = 0;
  const d = new Date(ini + 'T12:00:00'), f = new Date(fim + 'T12:00:00');
  for (; d <= f; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); // 0 dom ... 6 sáb
    if (diasSemana === 6 && dow === 0) continue;
    if (diasSemana === 5 && (dow === 0 || dow === 6)) continue;
    n++;
  }
  return n;
}

function _confCalendarioMin(inj, ini, fim, cfg) {
  const a = inj.admissao && inj.admissao > ini ? inj.admissao : ini;
  const b = inj.desativacao && inj.desativacao < fim ? inj.desativacao : fim;
  if (a > b) return 0;
  return _confDiasValidos(a, b, cfg.diasSemana) * cfg.horasDia * 60;
}

function _confEhFalha(p, cfg) {
  return _confTipo(p.tipo) === 'Corretiva' && (!cfg.soParada || p.maquina_parada === true);
}

function _confQualidade(lancs, cfg) {
  const q = { total: lancs.length, corretivas: 0, corretivasComParada: 0, suspeitos: 0, paradaSemHora: 0, corretivasSemParada: 0, abertosAntigos: 0, injetoraForaCadastro: 0 };
  const hoje = hojeLocal();
  const limite = new Date(hoje + 'T12:00:00'); limite.setDate(limite.getDate() - 3);
  const limStr = dataLocal(limite);
  lancs.forEach(p => {
    const m = Number(p.minutos) || 0;
    if (m > _CONF_MAX_MIN) q.suspeitos++;
    if (p.maquina_parada && (!p.hora_inicio || !p.hora_fim)) q.paradaSemHora++;
    if (_confTipo(p.tipo) === 'Corretiva') { q.corretivas++; if (p.maquina_parada) q.corretivasComParada++; else q.corretivasSemParada++; }
    if ((p.status === 'Em andamento' || p.status === 'Pausado') && p.data < limStr) q.abertosAntigos++;
  });
  return q;
}

// ---------- INJETORAS ----------
function calcInjetoras(lancs, injetoras, ini, fim, cfg) {
  const mapa = {};
  injetoras.forEach(i => {
    mapa[i.nome] = { nome: i.nome, calend: _confCalendarioMin(i, ini, fim, cfg), prog: 0, down: 0, falhas: 0, causas: {} };
  });
  let fora = 0;
  lancs.forEach(p => {
    if (p.data < ini || p.data > fim) return;
    const e = mapa[p.injetora];
    if (!e) { fora++; return; }
    const dur = _confDuracao(p);
    if (dur === null) return;
    const tn = _confTipo(p.tipo);
    if (_confEhFalha(p, cfg)) {
      e.down += dur; e.falhas++;
      const c = p.atividade || 'Sem atividade';
      if (!e.causas[c]) e.causas[c] = { n: 0, min: 0 };
      e.causas[c].n++; e.causas[c].min += dur;
    } else if ((tn === 'Setup' || tn === 'Preventiva' || tn === 'Inspeção') && p.maquina_parada) {
      e.prog += dur;
    }
  });
  const itens = Object.values(mapa).map(e => _confFechar(e));
  return { itens, total: _confTotal(itens), foraCadastro: fora };
}

function _confFechar(e) {
  const req = Math.max(e.calend - e.prog, 0);
  const disp = Math.max(req - e.down, 0);
  return Object.assign(e, {
    req, disp,
    df: req > 0 ? disp / req : null,
    mtbfH: e.falhas ? disp / 60 / e.falhas : null,
    mttr: e.falhas ? e.down / e.falhas : null
  });
}

function _confTotal(itens) {
  const t = { req: 0, disp: 0, down: 0, prog: 0, falhas: 0 };
  itens.forEach(i => { t.req += i.req; t.disp += i.disp; t.down += i.down; t.prog += (i.prog || 0); t.falhas += i.falhas; });
  t.df = t.req > 0 ? t.disp / t.req : null;
  t.mtbfH = t.falhas ? t.disp / 60 / t.falhas : null;
  t.mttr = t.falhas ? t.down / t.falhas : null;
  return t;
}

// ---------- MOLDES ----------
function calcMoldes(lancs, historico, jobsSet, ini, fim, agora, cfg) {
  const mapa = {};
  const get = nome => mapa[nome] || (mapa[nome] = { nome, emMaq: 0, sala: 0, ferr: 0, down: 0, falhas: 0, causas: {} });

  lancs.forEach(p => {
    if (p.data < ini || p.data > fim) return;
    if (!p.molde || !jobsSet.has(p.molde)) return;
    const dur = _confDuracao(p);
    if (dur === null || !_confEhFalha(p, cfg)) return;
    const e = get(p.molde);
    e.down += dur; e.falhas++;
    const c = p.atividade || 'Sem atividade';
    if (!e.causas[c]) e.causas[c] = { n: 0, min: 0 };
    e.causas[c].n++; e.causas[c].min += dur;
  });

  // Tempo em cada local: cada movimentação vale até a próxima do mesmo molde (a última vale até agora)
  const t0 = new Date(ini + 'T00:00:00').getTime();
  const t1 = Math.min(new Date(fim + 'T23:59:59').getTime(), agora);
  const porJob = {};
  historico.forEach(h => { if (h.job) (porJob[h.job] = porJob[h.job] || []).push(h); });
  Object.entries(porJob).forEach(([job, linhas]) => {
    linhas.sort((a, b) => new Date(a.movido_em) - new Date(b.movido_em));
    linhas.forEach((h, i) => {
      const a = Math.max(new Date(h.movido_em).getTime(), t0);
      const b = Math.min(i + 1 < linhas.length ? new Date(linhas[i + 1].movido_em).getTime() : agora, t1);
      if (b <= a) return;
      const min = (b - a) / 60000;
      const e = get(job);
      if (h.localizacao === 'Em Máquina') e.emMaq += min;
      else if (h.localizacao === 'Sala de Molde') e.sala += min;
      else if (h.localizacao === 'Na Ferramentaria') e.ferr += min;
    });
  });

  const itens = Object.values(mapa).map(e => {
    const den = e.emMaq + e.sala + e.ferr;
    const disp = e.emMaq + e.sala;
    return Object.assign(e, {
      den, disp,
      df: den > 0 ? disp / den : null,
      mtbfH: e.falhas && e.emMaq > 0 ? e.emMaq / 60 / e.falhas : null,
      mttr: e.falhas ? e.down / e.falhas : null
    });
  });
  const t = { den: 0, disp: 0, emMaq: 0, down: 0, falhas: 0 };
  itens.forEach(i => { t.den += i.den; t.disp += i.disp; t.emMaq += i.emMaq; t.down += i.down; t.falhas += i.falhas; });
  t.df = t.den > 0 ? t.disp / t.den : null;
  t.mtbfH = t.falhas && t.emMaq > 0 ? t.emMaq / 60 / t.falhas : null;
  t.mttr = t.falhas ? t.down / t.falhas : null;
  return { itens, total: t };
}

// ---------- BACKLOG ----------
function calcBacklog(d, hoje) {
  const dias = iso => Math.max(0, Math.floor((new Date(hoje + 'T12:00:00') - new Date(String(iso).slice(0, 10) + 'T12:00:00')) / 86400000));
  const pend = (d.pendencias || []).map(p => Object.assign({}, p, { idade: p.criado_em ? dias(p.criado_em) : 0 }));
  const porCrit = {}, porSetor = {};
  pend.forEach(p => {
    const c = p.criticidade || 'Sem criticidade'; porCrit[c] = (porCrit[c] || 0) + 1;
    const s = p.setor_responsavel || 'Sem setor'; porSetor[s] = (porSetor[s] || 0) + 1;
  });
  const idadeMedia = pend.length ? Math.round(pend.reduce((a, p) => a + p.idade, 0) / pend.length) : 0;
  const parados = (d.localizacao || [])
    .filter(l => l.localizacao === 'Na Ferramentaria' && l.atualizado_em)
    .map(l => ({ job: l.job, dias: dias(l.atualizado_em) }))
    .filter(l => l.dias >= 5)
    .sort((a, b) => b.dias - a.dias);

  const ramAbertas = (d.ram || []).filter(r => (d.ramSetores || []).some(s => s.ram_id === r.id && !s.concluido));
  const ramAtrasadas = ramAbertas.filter(r => r.prazo_final && String(r.prazo_final).slice(0, 10) < hoje);

  const lim = new Date(hoje + 'T12:00:00'); lim.setDate(lim.getDate() - 3);
  const limStr = dataLocal(lim);
  const abertos = (d.prodAbertos || []);
  const recentes = abertos.filter(p => p.data >= limStr);
  const antigos = abertos.filter(p => p.data < limStr);
  return { pend, porCrit, porSetor, idadeMedia, parados, ramAbertas, ramAtrasadas, recentes, antigos };
}

// ---------- CARGA DE DADOS ----------
async function _confCarregar(ini, fim) {
  const chave = ini + '|' + fim;
  if (_confEstado.dados && _confEstado.chave === chave && Date.now() - _confEstado.ts < 60000) return _confEstado.dados;
  const d6 = new Date(fim + 'T12:00:00'); d6.setDate(1); d6.setMonth(d6.getMonth() - 5);
  const iniTend = dataLocal(d6);
  const desde = ini < iniTend ? ini : iniTend;
  const [lancs, injs, hist, loc, pend, ram, ramSet, jobs] = await Promise.all([
    db._get('prod_lancamentos', 'data=gte.' + desde + '&data=lte.' + fim, '*'),
    db._get('prod_injetoras', 'order=nome.asc', '*'),
    db._get('molde_localizacao_historico', 'order=movido_em.asc', 'job,localizacao,movido_em'),
    db._get('molde_localizacao', '', '*'),
    db._get('molde_pendencias', 'concluido=eq.false', '*'),
    db._get('ram', '', '*').catch(() => []),
    db._get('ram_setores', '', '*').catch(() => []),
    db._get('jobs', '', 'nome')
  ]);
  const dados = {
    lancs: lancs || [], injetoras: injs || [], historico: hist || [], localizacao: loc || [],
    pendencias: pend || [], ram: ram || [], ramSetores: ramSet || [],
    jobsSet: new Set((jobs || []).map(j => j.nome)), iniTend,
    prodAbertos: (lancs || []).filter(p => p.status === 'Em andamento' || p.status === 'Pausado')
  };
  _confEstado.dados = dados; _confEstado.chave = chave; _confEstado.ts = Date.now();
  return dados;
}

function _confMeses(fim, n) {
  const out = [];
  const base = new Date(fim + 'T12:00:00'); base.setDate(1);
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(base); d.setMonth(d.getMonth() - k);
    const ini = dataLocal(d);
    const f = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
    const fimM = dataLocal(f) > fim ? fim : dataLocal(f);
    out.push({ rotulo: String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(), ini, fim: fimM });
  }
  return out;
}

// ---------- FORMATAÇÃO ----------
function _confPct(v) { return v == null ? '—' : (v * 100).toFixed(1).replace('.', ',') + '%'; }
function _confH(v) { return v == null ? '—' : (v >= 100 ? Math.round(v) : v.toFixed(1)).toString().replace('.', ',') + ' h'; }
function _confMin(v) { return v == null ? '—' : Math.round(v) + ' min'; }
function _confHdeMin(m) { return (m / 60).toFixed(1).replace('.', ',') + ' h'; }
function _confCorDF(v) { return v == null ? '#94a3b8' : v >= 0.95 ? '#059669' : v >= 0.9 ? '#d97706' : '#dc2626'; }

// ---------- TELA ----------
async function desenharConfiabilidade(ini, fim) {
  const div = document.getElementById('dashConfiab');
  if (!div) return;
  div.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Calculando indicadores...</span></div>';
  let dados;
  try { dados = await _confCarregar(ini, fim); }
  catch (e) { console.error(e); div.innerHTML = '<div class="empty-msg">Erro ao carregar os dados de confiabilidade.</div>'; return; }
  _confRender(div, dados, ini, fim);
}

function _confSet(chave, valor) {
  _confEstado[chave] = valor;
  try { localStorage.setItem('confCfg', JSON.stringify({ horasDia: _confEstado.horasDia, diasSemana: _confEstado.diasSemana, soParada: _confEstado.soParada })); } catch (e) { /* ok */ }
  const ini = document.getElementById('dashIni')?.value, fim = document.getElementById('dashFim')?.value;
  const div = document.getElementById('dashConfiab');
  if (div && _confEstado.dados) _confRender(div, _confEstado.dados, ini, fim);
}

function _confRender(div, d, ini, fim) {
  const cfg = _confEstado;
  const agora = Date.now();
  const lancsPer = d.lancs.filter(p => p.data >= ini && p.data <= fim);
  const inj = calcInjetoras(d.lancs, d.injetoras, ini, fim, cfg);
  const mol = calcMoldes(d.lancs, d.historico, d.jobsSet, ini, fim, agora, cfg);
  const bk = calcBacklog(d, hojeLocal());
  const qual = _confQualidade(lancsPer, cfg);
  const ehInj = cfg.escopo === 'injetoras';
  const res = ehInj ? inj : mol;

  const btn = (ativo, onclick, txt) => `<button class="dash-tab${ativo ? ' ativa' : ''}" onclick="${onclick}" style="font-size:13px;padding:7px 14px">${txt}</button>`;
  let html = `
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;font-size:12px;color:#1e3a8a;margin-bottom:12px">
    📈 Indicadores calculados <b>com os lançamentos do Ferramentaria V3</b> (não substituem o indicador oficial da empresa).
    Período: <b>${esc(ini.split('-').reverse().join('/'))}</b> a <b>${esc(fim.split('-').reverse().join('/'))}</b>.
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
    ${btn(ehInj, "_confSet('escopo','injetoras')", '🏭 Injetoras')}
    ${btn(!ehInj, "_confSet('escopo','moldes')", '🔩 Moldes')}
    <span style="width:14px"></span>
    ${[['resumo', 'Resumo'], ['df', 'DF'], ['mtbf', 'MTBF'], ['mttr', 'MTTR'], ['backlog', 'Backlog']].map(([k, t]) => btn(cfg.sub === k, `_confSet('sub','${k}')`, t)).join('')}
  </div>
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px;color:#475569;margin-bottom:14px">
    ${ehInj ? `<label>Horas de operação por dia
      <select onchange="_confSet('horasDia',parseInt(this.value))" style="width:auto">${[24, 22, 16, 8].map(h => `<option value="${h}"${cfg.horasDia === h ? ' selected' : ''}>${h}h</option>`).join('')}</select></label>
    <label>Dias por semana
      <select onchange="_confSet('diasSemana',parseInt(this.value))" style="width:auto">${[[7, 'Todos os dias'], [6, 'Seg a Sáb'], [5, 'Seg a Sex']].map(([v, t]) => `<option value="${v}"${cfg.diasSemana === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
    ${cfg.sub !== 'backlog' ? `<label><input type="checkbox" ${cfg.soParada ? 'checked' : ''} onchange="_confSet('soParada',this.checked)"> Contar como falha só corretiva com <b>máquina parada</b></label>` : ''}
  </div>`;

  if (cfg.sub === 'resumo') html += _confResumo(res, bk, qual, ehInj, d, ini, fim, cfg);
  else if (cfg.sub === 'df') html += _confDF(res, ehInj);
  else if (cfg.sub === 'mtbf') html += _confMTBF(res, ehInj);
  else if (cfg.sub === 'mttr') html += _confMTTR(res, ehInj);
  else html += _confBacklog(bk);

  html += _confComoCalculamos(ehInj, d, ini);
  div.innerHTML = html;
  if (cfg.sub === 'resumo') _confGraficoTendencia(d, fim, cfg, ehInj);
  else if (cfg.sub !== 'backlog') _confGraficoRanking(res, cfg.sub);
}

function _confCard(ico, titulo, valor, sub, cor) { return metricCard(ico, titulo, valor, sub, cor); }

function _confResumo(res, bk, qual, ehInj, d, ini, fim, cfg) {
  const t = res.total;
  const backlogTotal = bk.pend.length + bk.ramAbertas.length + bk.recentes.length;
  let h = `<div class="cards-row">
    ${_confCard('✅', 'DF — Disponibilidade', `<span>${_confPct(t.df)}</span>`, ehInj ? 'tempo disponível / tempo requerido' : 'tempo fora da Ferramentaria', _confCorDF(t.df))}
    ${_confCard('⏳', 'MTBF', _confH(t.mtbfH), t.falhas ? t.falhas + ' falha' + (t.falhas > 1 ? 's' : '') + ' no período' : 'nenhuma falha no período', '#0056b3')}
    ${_confCard('🔧', 'MTTR', _confMin(t.mttr), 'tempo médio de reparo', '#ea580c')}
    ${_confCard('📋', 'Backlog', backlogTotal, `${bk.pend.length} pendências · ${bk.ramAbertas.length} RAMs · ${bk.recentes.length} manutenções abertas`, '#7c3aed')}
  </div>
  <div class="grafico-card"><div class="grafico-titulo">📅 Evolução mensal — últimos 6 meses</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
      <div style="height:220px"><canvas id="chartConfDF"></canvas></div>
      <div style="height:220px"><canvas id="chartConfMTBF"></canvas></div>
      <div style="height:220px"><canvas id="chartConfMTTR"></canvas></div>
    </div></div>`;
  h += _confAvisosQualidade(qual, ehInj, d, ini);
  return h;
}

function _confAvisosQualidade(q, ehInj, d, ini) {
  const itens = [];
  if (q.suspeitos) itens.push(`<b>${q.suspeitos}</b> lançamento(s) com mais de 12h de duração ficaram <b>fora das médias</b> (provável esquecimento de fechar).`);
  if (q.paradaSemHora) itens.push(`<b>${q.paradaSemHora}</b> parada(s) sem horário de início/fim.`);
  if (q.corretivas && q.corretivasComParada / q.corretivas < 0.5) {
    itens.push(`Só <b>${Math.round(q.corretivasComParada / q.corretivas * 100)}%</b> das corretivas (${q.corretivasComParada} de ${q.corretivas}) têm "máquina parada" marcada. ` +
      (_confEstado.soParada ? 'Com o filtro ligado, a maior parte das falhas fica <b>fora</b> do cálculo.' : 'Por isso o tempo de reparo usa o tempo do técnico, que pode diferir do tempo real da máquina parada.'));
  } else if (q.corretivasSemParada) {
    itens.push(`<b>${q.corretivasSemParada}</b> corretiva(s) sem "máquina parada" marcada${_confEstado.soParada ? ' (não entram como falha)' : ''}.`);
  }
  if (q.abertosAntigos) itens.push(`<b>${q.abertosAntigos}</b> lançamento(s) ainda "Em andamento/Pausado" há mais de 3 dias.`);
  if (!ehInj && d.historico.length) {
    const primeiro = d.historico.reduce((m, h) => h.movido_em < m ? h.movido_em : m, d.historico[0].movido_em).slice(0, 10);
    if (ini < primeiro) itens.push(`O histórico de localização dos moldes só existe a partir de <b>${esc(primeiro.split('-').reverse().join('/'))}</b>. DF e MTBF dos moldes consideram apenas esse intervalo.`);
  }
  if (!itens.length) return '';
  return `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-top:8px;font-size:12px;color:#92400e">
    <div style="font-weight:700;margin-bottom:6px">🔎 Qualidade dos dados neste período</div>
    ${itens.map(i => `<div>• ${i}</div>`).join('')}</div>`;
}

function _confTabela(cab, linhas, vazio) {
  if (!linhas.length) return `<div class="empty-msg">${esc(vazio)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table></div>`;
}

function _confNome(nome, ehInj) {
  return ehInj ? esc(nome) : `<span style="cursor:pointer;text-decoration:underline" onclick="abrirFichaMolde('${escJs(nome)}')">${esc(nome)}</span>`;
}

function _confDF(res, ehInj) {
  const lista = res.itens.filter(i => i.df != null).sort((a, b) => a.df - b.df);
  const linhas = lista.slice(0, 30).map(i => ehInj
    ? `<tr><td>${_confNome(i.nome, true)}</td><td>${_confHdeMin(i.req)}</td><td>${_confHdeMin(i.prog)}</td><td>${_confHdeMin(i.down)}</td><td style="font-weight:700;color:${_confCorDF(i.df)}">${_confPct(i.df)}</td></tr>`
    : `<tr><td>${_confNome(i.nome, false)}</td><td>${_confHdeMin(i.den)}</td><td>${_confHdeMin(i.ferr)}</td><td style="font-weight:700;color:${_confCorDF(i.df)}">${_confPct(i.df)}</td></tr>`);
  const cab = ehInj ? ['Injetora', 'Tempo requerido', 'Parada programada', 'Parada por falha', 'DF'] : ['Molde', 'Tempo acompanhado', 'Na Ferramentaria', 'DF'];
  return `<div class="grafico-card"><div class="grafico-titulo">✅ Disponibilidade — ${ehInj ? 'injetoras com menor DF' : 'moldes com menor disponibilidade'}</div>
    <div style="height:300px"><canvas id="chartConfRank"></canvas></div></div>
    <div class="grafico-card"><div class="grafico-titulo">Frota: <span style="color:${_confCorDF(res.total.df)}">${_confPct(res.total.df)}</span></div>
    ${_confTabela(cab, linhas, 'Sem dados no período.')}</div>`;
}

function _confMTBF(res, ehInj) {
  const comFalha = res.itens.filter(i => i.mtbfH != null).sort((a, b) => a.mtbfH - b.mtbfH);
  const semFalha = res.itens.filter(i => i.falhas === 0 && (ehInj ? i.req > 0 : i.emMaq > 0)).length;
  const linhas = comFalha.slice(0, 30).map(i => `<tr><td>${_confNome(i.nome, ehInj)}</td><td>${i.falhas}</td><td>${_confHdeMin(ehInj ? i.disp : i.emMaq)}</td><td style="font-weight:700">${_confH(i.mtbfH)}</td></tr>`);
  return `<div class="grafico-card"><div class="grafico-titulo">⏳ MTBF — ${ehInj ? 'injetoras' : 'moldes'} com menor tempo entre falhas</div>
    <div style="height:300px"><canvas id="chartConfRank"></canvas></div></div>
    <div class="grafico-card"><div class="grafico-titulo">Frota: ${_confH(res.total.mtbfH)} · ${semFalha} ${ehInj ? 'injetora(s)' : 'molde(s)'} sem falha no período</div>
    ${_confTabela([ehInj ? 'Injetora' : 'Molde', 'Falhas', ehInj ? 'Tempo em operação' : 'Tempo em máquina', 'MTBF'], linhas, 'Nenhuma falha no período.')}</div>`;
}

function _confCausas(itens) {
  const mapa = {};
  itens.forEach(i => Object.entries(i.causas || {}).forEach(([c, v]) => {
    if (!mapa[c]) mapa[c] = { n: 0, min: 0 };
    mapa[c].n += v.n; mapa[c].min += v.min;
  }));
  return Object.entries(mapa).sort((a, b) => b[1].min - a[1].min).slice(0, 10);
}

function _confMTTR(res, ehInj) {
  const comFalha = res.itens.filter(i => i.mttr != null).sort((a, b) => b.mttr - a.mttr);
  const linhas = comFalha.slice(0, 30).map(i => `<tr><td>${_confNome(i.nome, ehInj)}</td><td>${i.falhas}</td><td>${_confHdeMin(i.down)}</td><td style="font-weight:700">${_confMin(i.mttr)}</td></tr>`);
  const causas = _confCausas(res.itens).map(([c, v]) => `<tr><td>${esc(c)}</td><td>${v.n}</td><td>${_confHdeMin(v.min)}</td><td>${_confMin(v.min / v.n)}</td></tr>`);
  return `<div class="grafico-card"><div class="grafico-titulo">🔧 MTTR — ${ehInj ? 'injetoras' : 'moldes'} com maior tempo médio de reparo</div>
    <div style="height:300px"><canvas id="chartConfRank"></canvas></div></div>
    <div class="grafico-card"><div class="grafico-titulo">Frota: ${_confMin(res.total.mttr)} em ${res.total.falhas} falha(s)</div>
    ${_confTabela([ehInj ? 'Injetora' : 'Molde', 'Falhas', 'Tempo total de reparo', 'MTTR'], linhas, 'Nenhuma falha no período.')}</div>
    <div class="grafico-card"><div class="grafico-titulo">Principais causas (pela atividade lançada) — por tempo parado</div>
    ${_confTabela(['Causa', 'Ocorrências', 'Tempo total', 'Média'], causas, 'Sem causas no período.')}</div>`;
}

function _confBacklog(bk) {
  const crit = Object.entries(bk.porCrit).map(([c, n]) => `${esc(c)}: <b>${n}</b>`).join(' · ') || '—';
  const setores = Object.entries(bk.porSetor).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${esc(s)}: <b>${n}</b>`).join(' · ') || '—';
  const velhas = bk.pend.slice().sort((a, b) => b.idade - a.idade).slice(0, 10).map(p =>
    `<tr><td>${_confNome(p.job, false)}</td><td>${esc(p.texto || '')}</td><td>${esc(p.setor_responsavel || '—')}</td><td>${esc(p.criticidade || '—')}</td><td>${esc(p.idade)} d</td></tr>`);
  const parados = bk.parados.map(m => `<tr><td>${_confNome(m.job, false)}</td><td>${esc(m.dias)} dias</td></tr>`);
  const rams = bk.ramAbertas.map(r => {
    const atras = bk.ramAtrasadas.includes(r);
    return `<tr><td>${esc(r.numero)}</td><td>${_confNome(r.job, false)}</td><td>${esc(r.prazo_final ? String(r.prazo_final).slice(0, 10).split('-').reverse().join('/') : '—')}</td><td style="color:${atras ? '#dc2626' : '#475569'};font-weight:${atras ? 700 : 400}">${atras ? 'Atrasada' : 'No prazo'}</td></tr>`;
  });
  return `<div class="cards-row">
    ${_confCard('📌', 'Pendências de molde', bk.pend.length, `idade média ${bk.idadeMedia} dias`, '#7c3aed')}
    ${_confCard('⚠️', 'Moldes parados', bk.parados.length, 'na Ferramentaria há 5+ dias', '#ef4444')}
    ${_confCard('📑', 'RAMs abertas', bk.ramAbertas.length, bk.ramAtrasadas.length + ' atrasada(s)', '#0056b3')}
    ${_confCard('🏭', 'Manutenções abertas', bk.recentes.length, bk.antigos.length + ' abertas há +3 dias (revisar)', '#ea580c')}
  </div>
  <div class="grafico-card"><div class="grafico-titulo">📌 Pendências abertas</div>
    <div style="font-size:12px;color:#475569;margin-bottom:8px">Por criticidade: ${crit}<br>Por setor: ${setores}</div>
    ${_confTabela(['Molde', 'Pendência', 'Setor', 'Criticidade', 'Idade'], velhas, 'Nenhuma pendência aberta.')}
    <div style="font-size:11px;color:#94a3b8;margin-top:6px">Mostrando as 10 mais antigas.</div></div>
  <div class="grafico-card"><div class="grafico-titulo">⚠️ Moldes parados na Ferramentaria (5+ dias)</div>${_confTabela(['Molde', 'Parado há'], parados, 'Nenhum molde parado.')}</div>
  <div class="grafico-card"><div class="grafico-titulo">📑 RAMs com setor pendente</div>${_confTabela(['RAM', 'Molde', 'Prazo', 'Situação'], rams, 'Nenhuma RAM aberta.')}</div>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;font-size:12px;color:#92400e">
    As ordens de serviço (OS) ficam em outro sistema: aqui entram só pendências, RAMs, moldes parados e lançamentos de manutenção ainda abertos.
    Manutenções "Em andamento" há mais de 3 dias provavelmente só não foram finalizadas na tela.</div>`;
}

function _confComoCalculamos(ehInj, d, ini) {
  const c = _confEstado;
  return `<details style="margin-top:16px;font-size:12px;color:#475569"><summary style="cursor:pointer;font-weight:600">ℹ️ Como calculamos</summary>
  <div style="padding:8px 4px;line-height:1.6">
  <b>Falha:</b> lançamento de manutenção <i>corretiva</i>${c.soParada ? ' com "máquina parada" marcado' : ''}. Lançamentos com mais de 12h não entram nas médias.<br>
  ${ehInj ? `<b>Tempo requerido</b> = dias do período × ${c.horasDia}h (desde a admissão da injetora) − paradas programadas (setup, preventiva e inspeção com máquina parada).<br>
  <b>DF</b> = (tempo requerido − paradas por falha) ÷ tempo requerido.<br>
  <b>MTBF</b> = (tempo requerido − paradas por falha) ÷ nº de falhas.<br>
  <b>MTTR</b> = tempo total das corretivas ÷ nº de falhas (é o tempo do lançamento do técnico, não necessariamente o da máquina parada).`
  : `<b>Falha do molde:</b> corretiva lançada na Produção com o molde informado. <b>Tempo em máquina / Sala de Molde / Na Ferramentaria</b> vem do histórico de localização (PCM).<br>
  <b>DF</b> = (tempo em máquina + Sala de Molde) ÷ tempo acompanhado (fora o tempo na Ferramentaria; "Desativado" não conta).<br>
  <b>MTBF</b> = horas em máquina ÷ nº de falhas. <b>MTTR</b> = tempo total das corretivas ÷ nº de falhas.`}
  </div></details>`;
}

// ---------- GRÁFICOS ----------
function _confGraficoRanking(res, sub) {
  const campo = sub === 'df' ? 'df' : sub === 'mtbf' ? 'mtbfH' : 'mttr';
  const asc = sub !== 'mttr';
  const lista = res.itens.filter(i => i[campo] != null).sort((a, b) => asc ? a[campo] - b[campo] : b[campo] - a[campo]).slice(0, 12);
  const valor = i => sub === 'df' ? +(i.df * 100).toFixed(1) : sub === 'mtbf' ? +i.mtbfH.toFixed(1) : Math.round(i.mttr);
  criarChart('chartConfRank', {
    type: 'bar',
    data: { labels: lista.map(i => i.nome.length > 28 ? i.nome.slice(0, 27) + '…' : i.nome), datasets: [{ data: lista.map(valor), backgroundColor: sub === 'df' ? lista.map(i => _confCorDF(i.df)) : '#0056b3', borderRadius: 4 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: sub === 'df' ? { x: { min: Math.max(0, Math.floor(Math.min(...lista.map(valor), 100) / 5) * 5 - 5), max: 100 } } : {} }
  });
}

function _confGraficoTendencia(d, fim, cfg, ehInj) {
  const meses = _confMeses(fim, 6);
  const pontos = meses.map(m => {
    const r = ehInj ? calcInjetoras(d.lancs, d.injetoras, m.ini, m.fim, cfg).total
                    : calcMoldes(d.lancs, d.historico, d.jobsSet, m.ini, m.fim, Date.now(), cfg).total;
    return r;
  });
  const rot = meses.map(m => m.rotulo);
  const linha = (id, titulo, vals, cor, pct) => criarChart(id, {
    type: 'line',
    data: { labels: rot, datasets: [{ label: titulo, data: vals, borderColor: cor, backgroundColor: cor + '22', fill: true, tension: 0.3, spanGaps: true }] },
    options: { maintainAspectRatio: false, plugins: { title: { display: true, text: titulo }, legend: { display: false } }, scales: pct ? { y: { min: Math.max(0, Math.floor(Math.min(...vals.filter(v => v != null), 100) / 5) * 5 - 5), max: 100 } } : {} }
  });
  linha('chartConfDF', 'DF (%)', pontos.map(p => p.df == null ? null : +(p.df * 100).toFixed(1)), '#059669', true);
  linha('chartConfMTBF', 'MTBF (h)', pontos.map(p => p.mtbfH == null ? null : +p.mtbfH.toFixed(1)), '#0056b3', false);
  linha('chartConfMTTR', 'MTTR (min)', pontos.map(p => p.mttr == null ? null : Math.round(p.mttr)), '#ea580c', false);
}

if (typeof module !== 'undefined') module.exports = { calcInjetoras, calcMoldes, calcBacklog, _confTipo, _confDuracao, _confDiasValidos, _confQualidade };
