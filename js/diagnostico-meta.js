// ==========================================
// 🧭 DIAGNÓSTICO DA META — Dashboard da Usinagem
// Mostra POR QUE a meta de cada pessoa e de cada máquina ficou abaixo:
// dia sem apontamento, horário sem lançamento, atestado/folga, máquina parada.
// Usa as mesmas regras do dashboard (calcularMeta, capacidade por vigência),
// só que dia a dia. Não altera nenhum dado.
// ==========================================

var _dm = null;
var _DM_DIAS = ['D','S','T','Q','Q','S','S'];
var _DM_DIAS_LONGOS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

var _DM_MOT_EQ = [
  { k:'ok',  n:'Apontado',              c:'#0056b3', d:'Tempo lançado dentro da meta.' },
  { k:'dia', n:'Dia sem apontamento',   c:'#b91c1c', d:'Trabalhou pelo turno, mas não há lançamento nenhum no dia.' },
  { k:'lac', n:'Horário sem lançamento',c:'#d97706', d:'Tem lançamento, mas ficou tempo do expediente sem apontar.' },
  { k:'jus', n:'Atestado ou folga',     c:'#5b6b8c', d:'Dia justificado. Hoje continua na meta e baixa a ocupação.' }
];
var _DM_MOT_MQ = [
  { k:'ok',  n:'Em uso',             c:'#0056b3', d:'Tempo único de máquina trabalhando, sem contar horário repetido.' },
  { k:'par', n:'Parada registrada',  c:'#8b5cf6', d:'Parada de Máquina lançada, com o motivo informado.' },
  { k:'liv', n:'Sem uso registrado', c:'#b91c1c', d:'Horário disponível sem lançamento. Pode ser máquina livre ou falta de apontamento.' }
];

// ---------- utilitários ----------
function _dmHM(h) { const m = /^(\d{1,2}):(\d{2})/.exec(h || ''); return m ? (+m[1])*60 + (+m[2]) : null; }
function _dmHH(m) { return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0'); }
function _dmDur(m) { m = Math.round(m); return m >= 60 ? Math.floor(m/60) + 'h' + (m%60 ? String(m%60).padStart(2,'0') : '') : m + ' min'; }
function _dmFmtD(d) { return d.slice(8) + '/' + d.slice(5,7); }
function _dmWd(d) { return new Date(d + 'T12:00:00').getDay(); }
function _dmIntervalos(lancs) {
  const iv = [];
  lancs.forEach(l => {
    const a = _dmHM(l.horaInicio), b = _dmHM(l.horaFim);
    if (a === null || b === null) return;
    iv.push([a, b > a ? b : b + 1440]);
  });
  iv.sort((p,q) => p[0]-q[0]);
  const u = [];
  iv.forEach(([a,b]) => { if (u.length && a <= u[u.length-1][1]) u[u.length-1][1] = Math.max(u[u.length-1][1], b); else u.push([a,b]); });
  return u;
}
function _dmBuracos(uniao, ini, fim, min) {
  const g = []; let c = ini;
  uniao.forEach(([a,b]) => { a = Math.max(a, ini); b = Math.min(b, fim); if (b <= a) return; if (a - c >= min) g.push([c,a]); c = Math.max(c,b); });
  if (fim - c >= min) g.push([c, fim]);
  return g;
}
function _dmDiasDoPeriodo(ini, fim) {
  const out = [];
  for (let d = new Date(ini + 'T12:00:00'); d <= new Date(fim + 'T12:00:00'); d.setDate(d.getDate() + 1)) out.push(dataLocal(d));
  return out;
}

// ---------- cálculo ----------
function _dmCalcular(ini, fim, lancsSetor) {
  const dados = _dadosDash;
  const feriados = dados.feriados || [];
  const dias = _dmDiasDoPeriodo(ini, fim);
  const prod = lancsSetor.filter(l => l.tipo !== 'Parada de Máquina');
  const paradas = lancsSetor.filter(l => l.tipo === 'Parada de Máquina');

  // Equipe: só quem é do setor Usinagem (apoio de outros setores não entra na meta daqui)
  const nomes = new Set();
  (dados.funcionarios || []).forEach(f => { if (f.setor === 'Usinagem' && f.ativo !== false && !isSupervisor(f.nome, dados)) nomes.add(f.nome); });

  const pessoas = [];
  [...nomes].sort((a,b) => a.localeCompare(b)).forEach(nome => {
    const f = (dados.funcionarios || []).find(x => x.nome === nome);
    const adm = f?.admissao || '1900-01-01', dem = f?.demissao || '2099-12-31';
    const ausencias = (dados.ferias || []).filter(x => x.funcionario === nome);
    const parciais = (dados.parciais || []).filter(p => p.funcionario === nome);
    const meus = prod.filter(l => l.funcionario === nome);
    const linhas = [];
    dias.forEach(ds => {
      if (ds < adm || ds > dem) return;
      const aus = ausencias.find(x => ds >= x.inicio && ds <= x.fim);
      const doDia = meus.filter(l => l.data === ds);
      if (aus && aus.motivo === 'Férias') { linhas.push({ d:ds, meta:0, m:0, fer:aus, extra:false, turno:turnoNaData(nome, ds, dados), gaps:[], parc:0, lancs:doDia, ocorr:[], jus:null }); return; }
      const m = doDia.reduce((a,l) => a + (l.minutos || 0), 0);
      const turno = turnoNaData(nome, ds, dados);
      const trabalha = funcTrabalhaEmDia(turno, ds, feriados);
      if (!trabalha) { if (m > 0) linhas.push({ d:ds, meta:0, m, extra:true, turno, gaps:[], parc:0, jus:null, lancs:doDia, ocorr:parciais.filter(p => p.data === ds) }); return; }
      let meta = capMinutosNaData(turno, f?.setor, ds), parc = 0;
      parciais.filter(p => p.data === ds && p.inicio && p.fim).forEach(p => { parc += Math.max(0, _dmHM(p.fim) - _dmHM(p.inicio)); });
      meta = Math.max(0, meta - parc);
      const fimJanela = (turno === 'Turma A' || turno === 'Turma B') ? 1170 : 1048;
      linhas.push({ d:ds, meta, m, extra:false, turno, parc, jus: aus ? aus.motivo : null, aus: aus || null, lancs: doDia, ocorr: parciais.filter(p => p.data === ds), gaps: _dmBuracos(_dmIntervalos(doDia), 480, fimJanela, 15), fimJanela });
    });
    if (linhas.length) pessoas.push({ nome, curto: _dmCurto(nome), linhas });
  });

  // Máquinas principais
  const hist = dados.capacidadeHistoricoMaquinas || [];
  const maquinasTipo = (typeof _listas !== 'undefined' && _listas?.maquinasTipo) || {};
  const nomesMaq = Object.keys(dados.capacidadesMaquinas || {}).filter(m => (dados.capacidadesMaquinas[m].tipo || maquinasTipo[m] || 'Principal') !== 'Secundaria').sort();
  const maquinas = [];
  nomesMaq.forEach(maq => {
    const compartilhadas = maq === 'Solda Laser' ? (dados.lancamentos || []).filter(l => l.setor === 'Bancada' && l.tipo === 'Solda Laser') : [];
    const usos = prod.filter(l => l.maquina === maq).concat(compartilhadas);
    const pars = paradas.filter(l => l.maquina === maq);
    const linhas = [];
    dias.forEach(ds => {
      const reg = _registroCapMaquinaNaData(hist, maq, ds);
      const todos = !!(reg && reg.todos_os_dias);
      const dow = _dmWd(ds);
      const funciona = todos || (dow !== 0 && dow !== 6 && !feriados.includes(ds));
      if (!funciona) return;
      const doDia = usos.filter(l => l.data === ds);
      const m = _minutosSemSobreposicao(doDia);
      const pm = {};
      pars.filter(l => l.data === ds).forEach(l => { const k = l.motivo || 'Sem motivo'; pm[k] = (pm[k] || 0) + (l.minutos || 0); });
      const fimJanela = todos ? 1170 : 1048;
      linhas.push({ d:ds, meta: reg ? reg.capacidade_min : 598, m, par: pm, lancs: doDia, pars: pars.filter(l => l.data === ds), gaps: _dmBuracos(_dmIntervalos(doDia), 480, fimJanela, 30), fimJanela });
    });
    maquinas.push({ nome: maq, linhas });
  });
  return { dias, pessoas, maquinas };
}
function _dmCurto(nome) {
  const p = String(nome).trim().split(/\s+/)[0] || '';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

// linhas "achatadas" já filtradas pelos controles
function _dmLinhasEq() {
  const out = [];
  _dm.dados.pessoas.forEach(p => {
    if (_dm.pessoa !== 'todas' && p.nome !== _dm.pessoa) return;
    p.linhas.forEach(r => {
      if (r.extra || r.fer) return;
      if (_dm.turno !== 'todos' && r.turno !== _dm.turno) return;
      const gap = Math.max(0, r.meta - r.m);
      const seg = { ok: Math.min(r.m, r.meta), dia: 0, lac: 0, jus: 0 };
      if (r.jus) seg.jus = gap; else if (r.m === 0) seg.dia = gap; else seg.lac = gap;
      const main = gap === 0 ? 'ok' : ['dia','lac','jus'].sort((a,b) => seg[b] - seg[a])[0];
      out.push({ o:p, r, meta:r.meta, m:Math.min(r.m, r.meta), gap, seg, main, pct: r.meta ? Math.round(100*r.m/r.meta) : 0 });
    });
  });
  return out;
}
function _dmLinhasMq() {
  const out = [];
  _dm.dados.maquinas.forEach(x => {
    if (_dm.maq !== 'todas' && x.nome !== _dm.maq) return;
    x.linhas.forEach(r => {
      const par = Object.values(r.par).reduce((a,b) => a + b, 0);
      const m = Math.min(r.m, r.meta), p = Math.min(par, r.meta - m), liv = Math.max(0, r.meta - m - p);
      out.push({ o:x, r, meta:r.meta, m, gap: liv + p, seg:{ ok:m, par:p, liv }, main: liv + p === 0 ? 'ok' : (p >= liv ? 'par' : 'liv'), pct: r.meta ? Math.round(100*r.m/r.meta) : 0 });
    });
  });
  return out;
}

// ---------- entrada ----------
function iniciarDiagnosticoMeta(ini, fim, lancsSetor) {
  const alvo = document.getElementById('diagMeta');
  if (!alvo) return;
  _dmInjetarCss();
  const antigo = _dm;
  _dm = { ini, fim, aba: antigo?.aba || 'eq', turno: antigo?.turno || 'todos', pessoa: antigo?.pessoa || 'todas', maq: antigo?.maq || 'todas',
          limite: antigo?.limite || 100, motivo: antigo?.motivo || null, sel: antigo?.reabrir || null, reabrir:null,
          dados: _dmCalcular(ini, fim, lancsSetor) };
  _dmRender();
  if (_dm.sel) { const id = _dm.sel; _dm.sel = null; _dmAbrir(id); }
}

function _dmEid(o) { return String(o).replace(/[^a-zA-Z0-9]/g, '_'); }

function _dmRender() {
  const alvo = document.getElementById('diagMeta');
  if (!alvo || !_dm) return;
  const eq = _dm.aba === 'eq';
  const L = eq ? _dmLinhasEq() : _dmLinhasMq();
  const MOT = eq ? _DM_MOT_EQ : _DM_MOT_MQ;
  alvo.innerHTML = `<div class="card dm">
    <div class="dm-head">
      <div><div class="dm-titulo">🧭 Diagnóstico da meta</div>
      <div class="dm-sub">Mostra por que a ocupação ficou abaixo da meta, dia a dia. Usa o período escolhido no topo da tela.</div></div>
      <div class="dm-tabs" role="tablist"><button data-aba="eq" aria-selected="${eq}">Equipe</button><button data-aba="mq" aria-selected="${!eq}">Máquinas</button></div>
    </div>
    ${_dmFiltros(eq)}${_dmKpis(L, eq)}${_dmPerda(L, MOT)}${_dmMapa(L, eq)}${_dmLista(L, eq, MOT)}
    ${eq ? '' : '<div class="dm-note">A Solda Laser soma também os lançamentos da Bancada. Máquinas com a marcação "opera todos os dias" contam sábado, domingo e feriado.</div>'}
  </div>`;
  alvo.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { _dm.aba = b.dataset.aba; _dm.motivo = null; _dmRender(); });
  alvo.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { _dm.turno = b.dataset.t; _dmRender(); });
  alvo.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { _dm.limite = +b.dataset.l; _dmRender(); });
  alvo.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { _dm.motivo = _dm.motivo === b.dataset.m ? null : b.dataset.m; _dmRender(); });
  const sp = alvo.querySelector('#dmPessoa'); if (sp) sp.onchange = e => { _dm.pessoa = e.target.value; _dmRender(); };
  const sm = alvo.querySelector('#dmMaq'); if (sm) sm.onchange = e => { _dm.maq = e.target.value; _dmRender(); };
  alvo.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => _dmAbrir(b.dataset.id); b.onkeydown = e => { if (e.key === 'Enter') _dmAbrir(b.dataset.id); }; });
}

function _dmFiltros(eq) {
  const lim = (v, t) => `<button data-l="${v}" aria-pressed="${_dm.limite === v}">${t}</button>`;
  const pessoas = _dm.dados.pessoas.map(p => `<option value="${esc(p.nome)}" ${_dm.pessoa === p.nome ? 'selected' : ''}>${esc(p.curto)}</option>`).join('');
  const maqs = _dm.dados.maquinas.map(m => `<option value="${esc(m.nome)}" ${_dm.maq === m.nome ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
  return `<div class="dm-filtros">
    ${eq ? `<div class="dm-f"><label>Turno</label><div class="dm-seg">${['todos','5x2','Turma A','Turma B'].map(t => `<button data-t="${esc(t)}" aria-pressed="${_dm.turno === t}">${t === 'todos' ? 'Todos' : esc(t)}</button>`).join('')}</div></div>
    <div class="dm-f"><label for="dmPessoa">Pessoa</label><select id="dmPessoa"><option value="todas">Todas</option>${pessoas}</select></div>`
    : `<div class="dm-f"><label for="dmMaq">Máquina</label><select id="dmMaq"><option value="todas">Todas</option>${maqs}</select></div>`}
    <div class="dm-f"><label>Mostrar dias</label><div class="dm-seg">${lim(100,'Todos')}${lim(99,'Abaixo de 100%')}${lim(90,'Abaixo de 90%')}${lim(70,'Abaixo de 70%')}</div></div>
  </div>`;
}

function _dmKpis(L, eq) {
  const meta = L.reduce((a,x) => a + x.meta, 0), m = L.reduce((a,x) => a + x.m, 0);
  const pct = meta ? Math.round(100 * m / meta) : 0;
  const abaixo = L.filter(x => x.pct < 90).length;
  const dia = L.filter(x => eq ? x.main === 'dia' : (x.m === 0 && x.seg.par === 0)).length;
  const cor = pct >= 90 ? '#059669' : pct >= 70 ? '#d97706' : '#b91c1c';
  return `<div class="dm-kpis">
    <div class="dm-kpi"><div class="v" style="color:${cor}">${pct}%</div><div class="l">${eq ? 'Ocupação da equipe' : 'Ocupação das máquinas'} (meta 90%)</div></div>
    <div class="dm-kpi"><div class="v">${_dmDur(Math.max(0, meta - m))}</div><div class="l">Tempo abaixo da meta no período</div></div>
    <div class="dm-kpi"><div class="v">${abaixo}</div><div class="l">${eq ? 'Dias de pessoa abaixo de 90%' : 'Dias de máquina abaixo de 90%'}</div></div>
    <div class="dm-kpi"><div class="v">${dia}</div><div class="l">${eq ? 'Dias sem nenhum apontamento' : 'Dias sem nenhum uso registrado'}</div></div></div>`;
}

function _dmPerda(L, MOT) {
  const tot = {}; MOT.forEach(x => tot[x.k] = 0);
  L.forEach(x => Object.entries(x.seg).forEach(([k,v]) => tot[k] += v));
  const meta = L.reduce((a,x) => a + x.meta, 0) || 1;
  const segs = MOT.map(x => ({ ...x, v: tot[x.k] })).filter(x => x.v > 0);
  if (!segs.length) return '';
  return `<div class="dm-sec"><div class="dm-h">Onde a meta se perdeu</div>
    <div class="dm-nota">Clique em um motivo para filtrar o mapa e a lista. Meta somada: ${_dmDur(meta)}.</div>
    <div class="dm-loss">${segs.map(x => `<button data-m="${x.k}" aria-pressed="${_dm.motivo === x.k}" style="flex:${x.v};background:${x.c}" title="${esc(x.n)}: ${_dmDur(x.v)}">${x.v / meta > .07 ? Math.round(100 * x.v / meta) + '%' : ''}</button>`).join('')}</div>
    <div class="dm-legend">${segs.map(x => `<button data-m="${x.k}" aria-pressed="${_dm.motivo === x.k}"><i style="background:${x.c}"></i><span><b>${esc(x.n)} · ${_dmDur(x.v)}</b><span>${esc(x.d)}</span></span></button>`).join('')}</div></div>`;
}

function _dmCls(x) { return x.main === 'jus' ? 'j' : x.pct >= 90 ? 'g' : x.pct >= 70 ? 'm' : 'l'; }

function _dmMapa(L, eq) {
  const dias = _dm.dados.dias;
  const objs = eq ? _dm.dados.pessoas.filter(p => L.some(x => x.o === p)) : _dm.dados.maquinas.filter(m => L.some(x => x.o === m));
  if (!objs.length) return '';
  const th = dias.map(d => `<th class="${_dmWd(d) % 6 === 0 ? 'we' : ''}">${d.slice(8)}<small>${_DM_DIAS[_dmWd(d)]}</small></th>`).join('');
  const rows = objs.map(o => {
    const nome = eq ? o.curto : o.nome.replace(/ - .*/, '');
    const cells = dias.map(d => {
      const x = L.find(y => y.o === o && y.r.d === d);
      if (!x) {
        const raw = o.linhas.find(y => y.d === d);
        const idr = (eq ? 'p' : 'm') + '|' + o.nome + '|' + d;
        if (raw && raw.fer) return `<td><button class="dm-cell f" data-id="${esc(idr)}" title="${esc(nome)} · ${_dmFmtD(d)} · de férias" aria-label="${esc(nome)} ${_dmFmtD(d)}: de férias">F</button></td>`;
        if (raw && raw.extra) return `<td><button class="dm-cell e" data-id="${esc(idr)}" title="${esc(nome)} · ${_dmFmtD(d)} · hora extra de ${_dmDur(raw.m)}" aria-label="${esc(nome)} ${_dmFmtD(d)}: hora extra">+</button></td>`;
        return `<td><span class="dm-cell o">·</span></td>`;
      }
      const fora = (_dm.motivo && _dm.motivo !== 'ok' && x.seg[_dm.motivo] === 0) || (_dm.motivo === 'ok' && x.main !== 'ok') || (_dm.limite < 100 && x.pct >= _dm.limite);
      const id = (eq ? 'p' : 'm') + '|' + (eq ? o.nome : o.nome) + '|' + d;
      return `<td><button class="dm-cell ${_dmCls(x)} ${fora ? 'dim' : ''}" data-id="${esc(id)}" title="${esc(nome)} · ${_dmFmtD(d)} · ${_dmDur(x.m)} de ${_dmDur(x.meta)}" aria-label="${esc(nome)} ${_dmFmtD(d)}: ${x.pct}%">${x.pct}</button></td>`;
    }).join('');
    const mine = L.filter(y => y.o === o), mm = mine.reduce((a,y) => a + y.meta, 0), aa = mine.reduce((a,y) => a + y.m, 0);
    return `<tr><td class="name">${esc(nome)}<small>${mm ? Math.round(100 * aa / mm) + '% no período' : ''}</small></td>${cells}</tr>`;
  }).join('');
  return `<div class="dm-sec"><div class="dm-h">${eq ? 'Mapa por pessoa e dia' : 'Mapa por máquina e dia'}</div>
    <div class="dm-nota">Cada quadrado é um dia, com a % da meta. Clique para ver o horário que faltou.</div>
    <div class="dm-scroll"><table class="dm-hm"><thead><tr><th></th>${th}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="dm-key"><span><i style="background:#cdebdd"></i>90% ou mais</span><span><i style="background:#f6e3b4"></i>70% a 89%</span><span><i style="background:#f2c9c3"></i>abaixo de 70%</span>${eq ? '<span><i style="background:repeating-linear-gradient(135deg,#dce2ee 0 3px,#fff 3px 6px)"></i>atestado ou folga</span>' : ''}${eq ? '<span><i style="background:#cdeceb;border:1px solid #6bbbb6"></i>férias</span><span><i style="background:#fff;border:2px solid #0056b3"></i>hora extra (dia de folga)</span>' : ''}<span><i style="background:#e6eaee"></i>sem meta no dia</span></div></div>`;
}

function _dmLista(L, eq, MOT) {
  let rows = L.filter(x => x.gap > 0 && x.pct < (_dm.limite >= 100 ? 100 : _dm.limite));
  if (_dm.motivo && _dm.motivo !== 'ok') rows = rows.filter(x => x.seg[_dm.motivo] > 0);
  rows.sort((a,b) => (_dm.motivo && _dm.motivo !== 'ok' ? b.seg[_dm.motivo] - a.seg[_dm.motivo] : b.gap - a.gap));
  const shown = rows.slice(0, 15);
  const nm = k => MOT.find(x => x.k === k);
  return `<div class="dm-sec"><div class="dm-h">O que cobrar</div>
    <div class="dm-nota">${rows.length} dia(s) abaixo da meta${_dm.motivo ? ' pelo motivo escolhido' : ''}, do maior para o menor tempo perdido.${rows.length > 15 ? ' Mostrando os 15 primeiros.' : ''}</div>
    ${shown.length ? `<div class="dm-scroll"><table class="dm-list"><thead><tr><th>${eq ? 'Pessoa' : 'Máquina'}</th><th>Dia</th><th>Motivo principal</th><th class="r dm-hide">Apontado</th><th class="r">Perdido</th></tr></thead><tbody>
    ${shown.map(x => { const mo = nm(x.main); const id = (eq ? 'p' : 'm') + '|' + x.o.nome + '|' + x.r.d;
      return `<tr class="row" tabindex="0" data-id="${esc(id)}"><td><b>${esc(eq ? x.o.curto : x.o.nome.replace(/ - .*/, ''))}</b></td><td>${_dmFmtD(x.r.d)} <span class="dm-mut">${['dom','seg','ter','qua','qui','sex','sáb'][_dmWd(x.r.d)]}</span></td><td><span class="dm-chip"><i style="background:${mo.c}"></i>${esc(mo.n)}</span></td><td class="r dm-hide">${_dmDur(x.m)} de ${_dmDur(x.meta)}</td><td class="r"><span class="dm-lost">${_dmDur(x.gap)}</span></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="dm-vazio">Nenhum dia abaixo da meta com esses filtros.</div>'}</div>`;
}

// ---------- detalhe do dia ----------
function _dmAchar(eq, nome, d) {
  const L = eq ? _dmLinhasEq() : _dmLinhasMq();
  const x = L.find(y => y.o.nome === nome && y.r.d === d);
  if (x) return x;
  const o = (eq ? _dm.dados.pessoas : _dm.dados.maquinas).find(y => y.nome === nome);
  const r = o && o.linhas.find(y => y.d === d);
  if (!r) return null;
  return { o, r, meta: r.meta, m: r.m, gap: 0, seg: {}, main: r.fer ? 'fer' : 'extra', pct: 0 };
}
function _dmDiasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000) + 1; }

function _dmAbrir(id) {
  const [t, nome, d] = id.split('|');
  const eq = t === 'p';
  const x = _dmAchar(eq, nome, d);
  if (!x) return;
  const L = eq ? _dmLinhasEq() : _dmLinhasMq();
  const S = 480, E = x.r.fimJanela || 1048;
  const gaps = x.r.gaps || [];
  const blocos = []; let c = S;
  gaps.forEach(g => { if (g[0] > c) blocos.push([c, g[0]]); c = g[1]; });
  if (c < E) blocos.push([c, E]);
  const especial = { fer: { n:'De férias', c:'#0f766e' }, extra: { n:'Hora extra', c:'#0056b3' } };
  const mo = especial[x.main] || (eq ? _DM_MOT_EQ : _DM_MOT_MQ).find(y => y.k === x.main);
  const titulo = eq ? x.o.curto : x.o.nome.replace(/ - .*/, '');
  const editar = typeof podeEditar === 'function' && podeEditar();
  const nomeC = eq ? x.o.curto : x.o.nome;
  const idDe = dd => (eq ? 'p' : 'm') + '|' + x.o.nome + '|' + dd;

  // vizinhos do mesmo objeto (dia anterior / próximo) e média do período
  const meus = L.filter(y => y.o === x.o).sort((a,b) => a.r.d.localeCompare(b.r.d));
  const pos = meus.findIndex(y => y.r.d === d);
  const ant = pos > 0 ? meus[pos-1] : null, prox = pos >= 0 && pos < meus.length - 1 ? meus[pos+1] : null;
  const mm = meus.reduce((a,y) => a + y.meta, 0), aa = meus.reduce((a,y) => a + y.m, 0);
  const media = mm ? Math.round(100 * aa / mm) : null;
  const outros = L.filter(y => y.r.d === d && y.o !== x.o);

  // ausência
  let blocoAus = '';
  const aus = x.r.fer || x.r.aus;
  if (aus) {
    const n = _dmDiasEntre(aus.inicio, aus.fim);
    blocoAus = `<div class="dm-aus"><b>${esc(aus.motivo)}</b><br>de ${_dmFmtD(aus.inicio)} a ${_dmFmtD(aus.fim)} (${n} dia${n > 1 ? 's' : ''})${x.r.fer ? '<br>Fora da meta nesses dias.' : '<br>Hoje o dia continua na meta e baixa a ocupação.'}</div>`;
  }

  // lançamentos do dia
  const lancs = (x.r.lancs || []).slice().sort((a,b) => (a.horaInicio || '').localeCompare(b.horaInicio || '')).concat(x.r.pars || []);
  const linhaL = l => `<li class="dm-lanc"><div class="dm-lh"><b>${esc(l.horaInicio || '—')} às ${esc(l.horaFim || '—')}</b> <span class="dm-mut">${_dmDur(l.minutos || 0)}</span></div>
    <div class="dm-lb">${l.job ? '<b>' + esc(l.job) + '</b> · ' : ''}${esc(l.tipo === 'Parada de Máquina' ? 'Parada — ' + (l.motivo || 'sem motivo') : (l.tipo || ''))}${!eq && l.funcionario ? ' · ' + esc(l.funcionario) : ''}${eq && l.maquina ? ' · ' + esc(l.maquina) : ''}${l.setor && l.setor !== 'Usinagem' ? ' · ' + esc(l.setor) : ''}
      ${l.descricao ? '<div class="dm-mut">' + esc(l.descricao) + '</div>' : ''}${l.descontaAlmoco ? '<div class="dm-mut">Almoço descontado</div>' : ''}</div>
    ${editar ? `<button class="dm-btn" data-ed="${l.id}|${esc(l.data)}|${esc(l.setor || 'Usinagem')}">✏️ Editar</button>` : ''}</li>`;
  const blocoL = lancs.length ? `<ul class="dm-lancs">${lancs.map(linhaL).join('')}</ul>` : `<div class="dm-nota">${x.r.fer ? 'Sem lançamentos, como esperado nas férias.' : 'Nenhum lançamento neste dia.'}</div>`;

  // ocorrências (Atrasos e Ocorrências)
  const oc = (x.r.ocorr || []);
  const blocoO = oc.length ? `<div class="dm-h" style="margin-top:14px">Ocorrências registradas</div><ul class="dm-ocs">${oc.map(p => `<li>${esc(p.motivo || 'Ocorrência')} · ${esc((p.inicio || '').slice(0,5))} às ${esc((p.fim || '').slice(0,5))}${p.status ? ' · ' + esc(p.status) : ''}</li>`).join('')}</ul>` : '';

  // buracos de horário com atalho para lançar
  const blocoG = (!x.r.fer && (eq ? x.meta > 0 : true)) ? `<div class="dm-h" style="margin-top:14px">Horários sem lançamento</div>${gaps.length ? `<ul class="dm-gaps">${gaps.map(g => `<li>${_dmHH(g[0])} às ${_dmHH(g[1])} · ${_dmDur(g[1]-g[0])}${editar ? ` <button class="dm-lk" data-novo="${esc(eq ? x.o.nome : '')}|${d}|${_dmHH(g[0])}|${_dmHH(g[1])}|${esc(eq ? '' : x.o.nome)}">lançar</button>` : ''}</li>`).join('')}</ul>` : '<div class="dm-nota">Nenhum buraco de horário acima do limite.</div>'}` : '';

  let acao;
  if (eq) {
    acao = { ok: 'Dia dentro da meta. Nada a cobrar.', fer: 'Funcionário de férias. Nada a cobrar.', extra: 'Trabalhou em dia de folga do turno. Esse tempo entra como hora extra.',
      dia: `Perguntar a ${x.o.curto} e ao responsável do turno se houve trabalho em ${_dmFmtD(d)} sem apontar. Se não houve, registrar a ausência em Atrasos e Ocorrências.`,
      lac: `Pedir a ${x.o.curto} para conferir os horários em vermelho. O almoço já está descontado da meta.`,
      jus: `Dia justificado (${(x.r.jus || 'atestado ou folga')}). Hoje continua na meta e baixa a ocupação.` }[x.main];
    if (x.r.parc) acao += ` A meta do dia já descontou ${_dmDur(x.r.parc)} de saída registrada.`;
  } else {
    const pm = Object.entries(x.r.par || {}).map(([k,v]) => `${k} (${_dmDur(v)})`).join(', ');
    acao = x.main === 'ok' ? 'Máquina dentro da meta.' : x.main === 'par' ? `Parada registrada: ${pm}.` : `Máquina sem uso registrado. Confirmar se ficou livre ou se faltou apontar.${pm ? ' Paradas: ' + pm + '.' : ''}`;
  }

  const ov = document.getElementById('dmOverlay') || (() => { const e = document.createElement('div'); e.id = 'dmOverlay'; document.body.appendChild(e); return e; })();
  const mostraTempo = !x.r.fer;
  ov.innerHTML = `<div class="dm-scrim" id="dmScrim"></div><aside class="dm-drawer" role="dialog" aria-label="Detalhe do dia"><button class="dm-x" id="dmFechar" aria-label="Fechar">×</button>
    <div class="dm-nav"><button class="dm-btn" ${ant ? `data-id="${esc(idDe(ant.r.d))}"` : 'disabled'}>← ${ant ? _dmFmtD(ant.r.d) : ''}</button><button class="dm-btn" ${prox ? `data-id="${esc(idDe(prox.r.d))}"` : 'disabled'}>${prox ? _dmFmtD(prox.r.d) : ''} →</button></div>
    <div class="dm-dtitulo">${esc(titulo)}</div><div class="dm-mut">${_dmFmtD(d)} · ${_DM_DIAS_LONGOS[_dmWd(d)]}${eq ? ' · ' + esc(x.r.turno || '') : ''}</div>
    ${blocoAus}
    <div class="dm-dl"><div>Meta do dia</div><div>${x.meta ? _dmDur(x.meta) : 'sem meta'}</div><div>${eq ? 'Apontado' : 'Em uso'}</div><div>${_dmDur(x.r.m)}</div>${x.meta ? `<div>Percentual do dia</div><div>${x.pct}%</div>` : ''}${media !== null && x.meta ? `<div>Média ${eq ? 'da pessoa' : 'da máquina'} no período</div><div>${media}%</div>` : ''}
    <div>Situação</div><div><span class="dm-chip"><i style="background:${mo.c}"></i>${esc(mo.n)}</span></div></div>
    ${mostraTempo ? `<div class="dm-h">Linha do tempo do dia</div>
    <div class="dm-ruler"><div class="bar">${(gaps.length || x.m > 0 ? blocos : []).map(b => `<b style="left:${100*(b[0]-S)/(E-S)}%;width:${100*(b[1]-b[0])/(E-S)}%"></b>`).join('')}</div><div class="ticks"><span>${_dmHH(S)}</span><span>${_dmHH(Math.round((S+E)/2))}</span><span>${_dmHH(E)}</span></div></div>
    <div class="dm-nota"><i class="dm-sw" style="background:#0056b3"></i> lançado &nbsp; <i class="dm-sw" style="background:#f2c9c3"></i> sem lançamento (o almoço aparece aqui)</div>` : ''}
    <div class="dm-h" style="margin-top:14px">${eq ? 'Lançamentos do dia' : 'Lançamentos nesta máquina'}</div>${blocoL}
    ${editar && !x.r.fer ? `<button class="dm-btn dm-novo" data-novo="${esc(eq ? x.o.nome : '')}|${d}|||${esc(eq ? '' : x.o.nome)}">+ Novo lançamento neste dia</button>` : ''}
    ${blocoO}${blocoG}
    ${outros.length ? `<div class="dm-h" style="margin-top:14px">${eq ? 'Os outros no mesmo dia' : 'As outras máquinas no mesmo dia'}</div><div class="dm-outros">${outros.map(y => `<button class="dm-btn" data-id="${esc((eq ? 'p' : 'm') + '|' + y.o.nome + '|' + d)}">${esc(eq ? y.o.curto : y.o.nome.replace(/ - .*/, ''))} <b>${y.pct}%</b></button>`).join('')}</div><div class="dm-nota">Se todos estão baixos no mesmo dia, o motivo pode ser geral (sistema, falta de energia, reunião).</div>` : ''}
    <div class="dm-acao"><b>Próximo passo</b><br>${esc(acao)}</div></aside>`;
  const fechar = () => { ov.innerHTML = ''; document.removeEventListener('keydown', onEsc); };
  const onEsc = e => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', onEsc);
  document.getElementById('dmScrim').onclick = fechar;
  const f = document.getElementById('dmFechar'); f.onclick = fechar; f.focus();
  ov.querySelectorAll('[data-id]').forEach(b => b.onclick = () => _dmAbrir(b.dataset.id));
  ov.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { const [i, dt, st] = b.dataset.ed.split('|'); fechar(); _dmEditarLanc(+i, dt, st, id); });
  ov.querySelectorAll('[data-novo]').forEach(b => b.onclick = () => { const [nm, dt, hi, hf, mq] = b.dataset.novo.split('|'); fechar(); _dmNovoLanc(nm, dt, hi, hf, mq, id); });
}

// Abre o formulário de edição que já existe em Apontamentos. Ao salvar, o dashboard recarrega
// e o painel do dia reabre atualizado (gancho _aoSalvarLancamento, chamado pelo salvarForm).
async function _dmEditarLanc(idLanc, data, setor, idDia) {
  try {
    _setorAtivo = setor || 'Usinagem';
    _dadosApontamentos = await db.buscarLancamentosDia(_setorAtivo, data, 'Todas');
    _dmArmarRecarga(idDia);
    editarApontamentoPorId(idLanc);
  } catch (e) { console.error(e); toast('Não foi possível abrir o lançamento.', 'erro'); }
}
async function _dmNovoLanc(nome, data, hi, hf, maq, idDia) {
  try {
    _setorAtivo = 'Usinagem';
    _dmArmarRecarga(idDia);
    abrirNovoApontamento();
    document.getElementById('formData').value = data;
    await carregarFuncionariosForm('Usinagem');
    await new Promise(r => setTimeout(r, 50));
    if (nome) setSelect('formFunc', nome);
    if (maq) setSelect('formMaq', maq);
    if (hi) document.getElementById('formHrIni').value = hi;
    if (hf) document.getElementById('formHrFim').value = hf;
  } catch (e) { console.error(e); toast('Não foi possível abrir o formulário.', 'erro'); }
}
function _dmArmarRecarga(idDia) {
  window._aoSalvarLancamento = function () {
    window._aoSalvarLancamento = null;
    if (!document.getElementById('diagMeta') || typeof carregarDashboard !== 'function') return;
    _dm.reabrir = idDia;
    carregarDashboard();
  };
}

// ---------- estilo ----------
function _dmInjetarCss() {
  if (document.getElementById('dmCss')) return;
  const s = document.createElement('style'); s.id = 'dmCss';
  s.textContent = `
.dm .dm-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px}
.dm-titulo{font-weight:700;color:#1e3a5f;font-size:15px}
.dm-sub,.dm-nota,.dm-note{font-size:12px;color:#64748b;margin-top:3px}
.dm-note{margin-top:12px}
.dm-tabs{display:flex;gap:3px;background:#f1f5f9;border-radius:8px;padding:3px}
.dm-tabs button{border:0;background:none;font-weight:600;font-size:13px;color:#64748b;padding:7px 14px;border-radius:6px;cursor:pointer}
.dm-tabs button[aria-selected=true]{background:#0056b3;color:#fff}
.dm-filtros{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end;margin-bottom:14px}
.dm-f{display:flex;flex-direction:column;gap:3px;min-width:0}
.dm-f label{font-size:11.5px;color:#64748b;font-weight:600}
.dm-f select{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;background:#fff;min-height:34px}
.dm-seg{display:flex;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;background:#fff}
.dm-seg button{font:inherit;font-size:13px;border:0;border-right:1px solid #cbd5e1;background:none;color:#475569;padding:6px 10px;cursor:pointer;min-height:34px}
.dm-seg button:last-child{border-right:0}
.dm-seg button[aria-pressed=true]{background:#1e3a5f;color:#fff}
.dm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:16px}
.dm-kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
.dm-kpi .v{font-size:28px;font-weight:700;line-height:1.1;color:#1e3a5f;font-variant-numeric:tabular-nums}
.dm-kpi .l{font-size:12px;color:#64748b;margin-top:3px}
.dm-sec{margin-top:18px}
.dm-h{font-weight:700;color:#1e3a5f;font-size:14px}
.dm-loss{display:flex;height:40px;border-radius:6px;overflow:hidden;gap:2px;margin-top:10px}
.dm-loss button{border:0;padding:0;cursor:pointer;min-width:3px;color:#fff;font-weight:600;font-size:12px;display:flex;align-items:center;justify-content:center}
.dm-loss button[aria-pressed=true]{outline:3px solid #0f172a;outline-offset:-3px}
.dm-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 16px;margin-top:10px}
.dm-legend button{all:unset;cursor:pointer;display:flex;gap:8px;align-items:flex-start;padding:5px 7px;border-radius:6px;font-size:13px;color:#1e293b}
.dm-legend button:hover,.dm-legend button[aria-pressed=true]{background:#f1f5f9}
.dm-legend i{width:11px;height:11px;border-radius:2px;margin-top:4px;flex:none}
.dm-legend b{display:block;font-weight:600}
.dm-legend span span{display:block;font-size:12px;color:#64748b}
.dm-scroll{overflow-x:auto;padding-bottom:6px;margin-top:10px}
.dm-hm{border-collapse:separate;border-spacing:2px;font-size:11.5px}
.dm-hm th{font-weight:500;color:#64748b;text-align:center;min-width:32px;padding:0 0 3px}
.dm-hm th.we{color:#a0aab5}
.dm-hm th small{display:block;font-size:10px;color:#a0aab5}
.dm-hm td.name{position:sticky;left:0;background:#fff;padding-right:10px;font-weight:600;font-size:12.5px;white-space:nowrap;text-align:left;z-index:1;color:#1e3a5f}
.dm-hm td.name small{display:block;font-weight:400;color:#64748b;font-size:11px}
.dm-cell{display:block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:4px;border:0;font-weight:600;font-size:11.5px;color:#1e293b;padding:0;font-variant-numeric:tabular-nums}
button.dm-cell{cursor:pointer}
.dm-cell.g{background:#cdebdd}.dm-cell.m{background:#f6e3b4}.dm-cell.l{background:#f2c9c3}
.dm-cell.j{background:repeating-linear-gradient(135deg,#dce2ee 0 4px,#fff 4px 8px);color:#5b6b8c}
.dm-cell.o{background:#e6eaee;color:#a0aab5}
.dm-cell.f{background:#cdeceb;color:#0f766e;border:1px solid #6bbbb6}
.dm-cell.e{background:#fff;color:#0056b3;border:2px solid #0056b3;line-height:28px}
.dm-cell.dim{opacity:.2}
.dm-key{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#64748b;margin-top:8px}
.dm-key i{display:inline-block;width:13px;height:13px;border-radius:3px;vertical-align:-3px;margin-right:4px}
.dm-list{width:100%;border-collapse:collapse;font-size:13px}
.dm-list th{font-size:12px;color:#64748b;font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0}
.dm-list td{padding:8px;border-bottom:1px solid #f1f5f9}
.dm-list tr.row{cursor:pointer}.dm-list tr.row:hover td{background:#f8fafc}
.dm-list .r{text-align:right}
.dm-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px;border-radius:99px;background:#f1f5f9;border:1px solid #e2e8f0;white-space:nowrap}
.dm-chip i{width:8px;height:8px;border-radius:50%}
.dm-lost{font-weight:700;color:#b91c1c;font-variant-numeric:tabular-nums}
.dm-mut{color:#64748b}
.dm-vazio{padding:20px;text-align:center;color:#64748b;font-size:13px}
.dm-scrim{position:fixed;inset:0;background:rgba(10,18,26,.45);z-index:9100}
.dm-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,100%);background:#fff;z-index:9101;padding:20px;overflow-y:auto;box-shadow:-8px 0 30px rgba(0,0,0,.2)}
.dm-x{position:absolute;top:12px;right:14px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;width:34px;height:34px;font-size:18px;cursor:pointer}
.dm-dtitulo{font-size:20px;font-weight:700;color:#1e3a5f}
.dm-dl{display:grid;grid-template-columns:1fr auto;gap:6px 16px;margin:14px 0;font-size:13.5px}
.dm-dl div:nth-child(odd){color:#64748b}.dm-dl div:nth-child(even){text-align:right;font-weight:700}
.dm-ruler{margin:10px 0 6px}
.dm-ruler .bar{position:relative;height:30px;border-radius:5px;background:#f2c9c3;overflow:hidden}
.dm-ruler .bar b{position:absolute;top:0;bottom:0;background:#0056b3}
.dm-ruler .ticks{display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:3px}
.dm-sw{display:inline-block;width:11px;height:11px;border-radius:2px;vertical-align:-1px}
.dm-gaps{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.dm-gaps li{background:#f2c9c3;border-radius:5px;padding:3px 9px;font-size:12.5px;font-variant-numeric:tabular-nums}
.dm-acao{margin-top:16px;padding:11px 13px;border-radius:8px;background:#f1f5f9;border-left:4px solid #0056b3;font-size:13.5px}
.dm button:focus-visible,.dm select:focus-visible,.dm-drawer button:focus-visible,.dm-list tr:focus-visible{outline:2px solid #0056b3;outline-offset:2px}

.dm-nav{display:flex;justify-content:space-between;gap:8px;margin:0 44px 12px 0}
.dm-btn{font:inherit;font-size:12.5px;border:1px solid #cbd5e1;background:#fff;color:#1e3a5f;border-radius:6px;padding:5px 10px;cursor:pointer;min-height:32px}
.dm-btn:hover:not(:disabled){background:#f1f5f9}.dm-btn:disabled{opacity:.35;cursor:default}
.dm-novo{margin-top:10px;width:100%;border-style:dashed}
.dm-aus{margin:12px 0;padding:10px 12px;border-radius:8px;background:#e3f4f2;border-left:4px solid #0f766e;font-size:13px;color:#134e4a}
.dm-lancs,.dm-ocs{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.dm-lanc{display:grid;grid-template-columns:1fr auto;gap:2px 10px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px}
.dm-lanc .dm-lb{grid-column:1}.dm-lanc .dm-btn{grid-row:1 / span 2;grid-column:2;align-self:center}
.dm-ocs li{background:#f1f5f9;border-radius:6px;padding:6px 10px;font-size:13px}
.dm-lk{font:inherit;font-size:12px;border:0;background:none;color:#0056b3;text-decoration:underline;cursor:pointer;padding:0 0 0 4px}
.dm-outros{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
@media (max-width:560px){.dm-hide{display:none}.dm-kpi .v{font-size:24px}}
`;
  document.head.appendChild(s);
}
