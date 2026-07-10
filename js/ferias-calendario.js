// ==========================================
// 🏖️ FERIAS-CALENDARIO.JS — Programação de Férias
// ==========================================

var _anoAtualFerias = new Date().getFullYear();
var _itensPorDiaFerias = {};
var _registrosFerias = [];
var _funcionariosFerias = [];
var _coresPorFuncionario = {};

const _PALETA_FERIAS = [
  { bg:'#dbeafe', cor:'#1d4ed8' },
  { bg:'#ede9fe', cor:'#7c3aed' },
  { bg:'#d1fae5', cor:'#059669' },
  { bg:'#ffe4d6', cor:'#c2410c' },
  { bg:'#fce7f3', cor:'#be185d' },
  { bg:'#dcfce7', cor:'#15803d' },
  { bg:'#fef3c7', cor:'#b45309' },
  { bg:'#f1f5f9', cor:'#475569' },
];

const _NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
async function inicializarProgramacaoFerias() {
  const el = document.getElementById('telaProgramacaoFerias');
  if (!el) return;
  el.innerHTML = `
  <div class="page-header">
    <h1>🏖️ Programação de Férias</h1>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn-secondary" style="padding:6px 12px" onclick="mudarAnoFerias(-1)">◀</button>
      <div style="font-size:18px;font-weight:700;color:#1e3a5f;min-width:60px;text-align:center" id="labelAnoFerias">${_anoAtualFerias}</div>
      <button class="btn-secondary" style="padding:6px 12px" onclick="mudarAnoFerias(1)">▶</button>
      <button class="btn-primary" style="margin-left:12px" onclick="abrirNovaFeriasRapida()">+ Nova Férias</button>
    </div>
  </div>
  <div class="cards-row" id="resumoFeriasCards"></div>
  <div id="loaderFerias" class="loader-inline"><div class="spinner-sm"></div><span>Carregando calendário...</span></div>
  <div class="card">
    <div id="gridCalendarioFerias" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px"></div>
    <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
      <span style="width:12px;height:12px;border-radius:3px;display:inline-block;border:2px solid #ef4444"></span>
      <span style="font-size:11px;color:#64748b">Conflito — mais de uma pessoa do mesmo setor de férias no dia</span>
    </div>
  </div>
  <div class="card">
    <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:16px">📋 Férias do Ano</div>
    <div id="listaFeriasAno"></div>
  </div>`;
  await carregarFeriasAno();
}

function mudarAnoFerias(delta) {
  _anoAtualFerias += delta;
  const label = document.getElementById('labelAnoFerias');
  if (label) label.innerText = _anoAtualFerias;
  carregarFeriasAno();
}

// ==========================================
// 📊 CARREGAR DADOS DO ANO
// ==========================================
async function carregarFeriasAno() {
  const loader = document.getElementById('loaderFerias');
  if (loader) loader.style.display = 'flex';
  try {
    const [registros, funcionarios] = await Promise.all([
      db._get('ferias', 'motivo=eq.Férias&order=inicio.asc', '*'),
      db.listarFuncionarios()
    ]);
    _registrosFerias = registros || [];
    _funcionariosFerias = (funcionarios || []).filter(f => f.ativo);

    // Filtra só registros que tocam o ano selecionado
    const anoIni = `${_anoAtualFerias}-01-01`;
    const anoFim = `${_anoAtualFerias}-12-31`;
    const registrosDoAno = _registrosFerias.filter(r => r.inicio <= anoFim && r.fim >= anoIni);

    _atribuirCoresFerias(registrosDoAno);
    _calcularConflitos(registrosDoAno);
    _montarItensPorDia(registrosDoAno);

    renderizarResumoFerias(registrosDoAno);
    renderizarCalendarioFerias();
    await renderizarListaFeriasAno(registrosDoAno);
  } catch(e) {
    toast('Erro ao carregar programação de férias.','erro');
    console.error(e);
  }
  if (loader) loader.style.display = 'none';
}

function _atribuirCoresFerias(registros) {
  _coresPorFuncionario = {};
  let i = 0;
  registros.forEach(r => {
    if (!_coresPorFuncionario[r.funcionario]) {
      _coresPorFuncionario[r.funcionario] = _PALETA_FERIAS[i % _PALETA_FERIAS.length];
      i++;
    }
  });
}

// Marca em cada registro se ele está em conflito (sobreposição com outro do MESMO setor)
function _calcularConflitos(registros) {
  registros.forEach(r => { r._conflito = false; r._setor = (_funcionariosFerias.find(f=>f.nome===r.funcionario)||{}).setor || null; });
  for (let i=0; i<registros.length; i++) {
    for (let j=i+1; j<registros.length; j++) {
      const a = registros[i], b = registros[j];
      if (!a._setor || a._setor !== b._setor) continue;
      if (a.funcionario === b.funcionario) continue;
      const sobrepoe = a.inicio <= b.fim && b.inicio <= a.fim;
      if (sobrepoe) { a._conflito = true; b._conflito = true; }
    }
  }
}

function _montarItensPorDia(registros) {
  _itensPorDiaFerias = {};
  registros.forEach(r => {
    for (let d = new Date(r.inicio+'T12:00:00'); d <= new Date(r.fim+'T12:00:00'); d.setDate(d.getDate()+1)) {
      const ds = d.toISOString().split('T')[0];
      if (ds < `${_anoAtualFerias}-01-01` || ds > `${_anoAtualFerias}-12-31`) continue;
      if (!_itensPorDiaFerias[ds]) _itensPorDiaFerias[ds] = [];
      _itensPorDiaFerias[ds].push({
        nome: r.funcionario, inicio: r.inicio, fim: r.fim,
        cor: _coresPorFuncionario[r.funcionario], conflito: r._conflito, raw: r
      });
    }
  });
}

// ==========================================
// 📊 RESUMO
// ==========================================
function renderizarResumoFerias(registros) {
  const el = document.getElementById('resumoFeriasCards');
  if (!el) return;
  const pessoas = new Set(registros.map(r=>r.funcionario)).size;
  const totalDias = registros.reduce((a,r) => {
    const ini = r.inicio < `${_anoAtualFerias}-01-01` ? `${_anoAtualFerias}-01-01` : r.inicio;
    const fim = r.fim > `${_anoAtualFerias}-12-31` ? `${_anoAtualFerias}-12-31` : r.fim;
    return a + Math.round((new Date(fim+'T12:00:00')-new Date(ini+'T12:00:00'))/86400000) + 1;
  }, 0);
  const conflitos = registros.filter(r=>r._conflito).length;

  el.innerHTML = `
    ${metricCard('👥','Funcionários com Férias', pessoas, `no ano de ${_anoAtualFerias}`, '#0056b3')}
    ${metricCard('📅','Dias Alocados', totalDias, 'total no ano', '#10b981')}
    ${metricCard('⚠️','Conflitos Detectados', conflitos, 'mesma equipe sobreposta', conflitos>0?'#ef4444':'#94a3b8')}
  `;
}

// ==========================================
// 🗓️ CALENDÁRIO — 12 MESES
// ==========================================
function renderizarCalendarioFerias() {
  const el = document.getElementById('gridCalendarioFerias');
  if (!el) return;
  let html = '';
  for (let m = 0; m < 12; m++) html += _renderMesCalendario(_anoAtualFerias, m);
  el.innerHTML = html;
}

function _renderMesCalendario(ano, mes) {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes+1, 0);
  const diasNoMes = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay();

  let html = `<div>
    <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:8px;text-align:center">${_NOMES_MES[mes]}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">
      <span style="font-size:9px;color:#94a3b8;text-align:center">D</span>
      <span style="font-size:9px;color:#94a3b8;text-align:center">S</span>
      <span style="font-size:9px;color:#94a3b8;text-align:center">T</span>
      <span style="font-size:9px;color:#94a3b8;text-align:center">Q</span>
      <span style="font-size:9px;color:#94a3b8;text-align:center">Q</span>
      <span style="font-size:9px;color:#94a3b8;text-align:center">S</span>
      <span style="font-size:9px;color:#94a3b8;text-align:center">S</span>`;

  for (let i=0; i<diaSemanaInicio; i++) html += '<span></span>';

  for (let d=1; d<=diasNoMes; d++) {
    const ds = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const itens = _itensPorDiaFerias[ds] || [];
    let estilo = 'font-size:10px;text-align:center;padding:3px 0;border-radius:3px;cursor:pointer';
    if (itens.length) {
      estilo += `;background:${itens[0].cor.bg};color:${itens[0].cor.cor};font-weight:700`;
      if (itens.some(i=>i.conflito)) estilo += ';border:1.5px solid #ef4444';
    }
    html += `<span style="${estilo}" onclick="abrirPopoverDiaFerias(event,'${ds}')">${d}</span>`;
  }
  html += '</div></div>';
  return html;
}

// ==========================================
// 🔔 POPOVER DO DIA
// ==========================================
function abrirPopoverDiaFerias(evt, dataStr) {
  evt.stopPropagation();
  fecharPopoverDiaFerias();
  const itens = _itensPorDiaFerias[dataStr] || [];
  const rect = evt.currentTarget.getBoundingClientRect();
  const div = document.createElement('div');
  div.id = 'popoverDiaFeriasWrap';
  div.style.cssText = `position:fixed;z-index:2000;top:${rect.bottom+6}px;left:${Math.min(rect.left, window.innerWidth-280)}px;background:#fff;border:1px solid var(--borda);border-radius:10px;box-shadow:0 12px 32px rgba(15,30,60,0.18);padding:12px;width:260px`;

  const dataFmt = dataStr.split('-').reverse().join('/');
  let html = `<div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:8px">📅 ${dataFmt}</div>`;

  if (!itens.length) {
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Nenhuma férias registrada nesse dia.</div>`;
  } else {
    itens.forEach(it => {
      const raw = JSON.stringify(it.raw).replace(/'/g,"&apos;");
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed #f1f5f9">
        <div>
          <div style="font-size:12px;font-weight:600;color:#1e3a5f">${it.nome}${it.conflito?' ⚠️':''}</div>
          <div style="font-size:10px;color:#94a3b8">${it.inicio.split('-').reverse().join('/')} a ${it.fim.split('-').reverse().join('/')}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick='fecharPopoverDiaFerias();abrirEdicaoFeriasCalendario(${raw})' style="background:none;border:none;color:#0056b3;cursor:pointer;font-size:13px">✏️</button>
          <button onclick="fecharPopoverDiaFerias();excluirFeriasCalendarioConfirm(${it.raw.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:13px">🗑️</button>
        </div>
      </div>`;
    });
  }
  html += `<button class="btn-success" style="width:100%;margin-top:10px;font-size:12px;padding:7px 0" onclick="fecharPopoverDiaFerias();abrirNovaFeriasRapida('${dataStr}')">+ Nova Férias</button>`;
  div.innerHTML = html;
  document.body.appendChild(div);
  setTimeout(() => document.addEventListener('click', _fecharPopoverDiaFeriasAoClicarFora), 10);
}

function _fecharPopoverDiaFeriasAoClicarFora(e) {
  const pop = document.getElementById('popoverDiaFeriasWrap');
  if (pop && !pop.contains(e.target)) fecharPopoverDiaFerias();
}

function fecharPopoverDiaFerias() {
  document.getElementById('popoverDiaFeriasWrap')?.remove();
  document.removeEventListener('click', _fecharPopoverDiaFeriasAoClicarFora);
}

// ==========================================
// ➕ NOVA FÉRIAS (rápida, a partir do calendário)
// ==========================================
function abrirNovaFeriasRapida(dataPreenchida) {
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[]).concat(_listas?.funcProducao||[])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();
  const div = document.createElement('div');
  div.id = 'modalNovaFeriasCalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharNovaFeriasRapida()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>🏖️ Nova Férias</h3><button onclick="fecharNovaFeriasRapida()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Funcionário *</label>
        <select id="nfcFunc"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${f}">${f}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Início *</label><input type="date" id="nfcIni" value="${dataPreenchida||''}"></div>
        <div class="form-group"><label>Fim *</label><input type="date" id="nfcFim" value="${dataPreenchida||''}"></div>
      </div>
      <div id="nfcSaldoInfo" style="font-size:12px;color:#64748b;margin-top:4px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovaFeriasRapida()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharNovaFeriasRapida()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);

  const selFunc = document.getElementById('nfcFunc');
  if (selFunc) selFunc.onchange = async () => {
    const nome = selFunc.value;
    const info = document.getElementById('nfcSaldoInfo');
    if (!nome || !info) return;
    const f = _funcionariosFerias.find(x=>x.nome===nome);
    if (!f || !f.admissao) { info.innerText=''; return; }
    const saldo = await calcularSaldoFerias(nome, f.admissao);
    info.innerText = `Saldo atual: ${saldo.saldo} de 30 dias (período ${saldo.periodoInicio.split('-').reverse().join('/')} a ${saldo.periodoFim.split('-').reverse().join('/')})`;
  };
}

function fecharNovaFeriasRapida() {
  document.getElementById('modalNovaFeriasCalWrap')?.remove();
}

async function salvarNovaFeriasRapida() {
  const funcionario = document.getElementById('nfcFunc')?.value;
  const inicio = document.getElementById('nfcIni')?.value;
  const fim = document.getElementById('nfcFim')?.value;
  if (!funcionario) return toast('Selecione o funcionário.','erro');
  if (!inicio || !fim) return toast('Informe início e fim.','erro');
  if (fim < inicio) return toast('A data final não pode ser antes do início.','erro');
  try {
    await db.salvarFerias({ funcionario, inicio, fim, motivo:'Férias' });
    toast('Férias registrada!','sucesso');
    fecharNovaFeriasRapida();
    await carregarFeriasAno();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

// ==========================================
// ✏️ EDITAR / EXCLUIR (a partir do calendário)
// ==========================================
function abrirEdicaoFeriasCalendario(f) {
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[]).concat(_listas?.funcProducao||[])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();
  const div = document.createElement('div');
  div.id = 'modalEditFeriasCalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoFeriasCalendario()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>✏️ Editar Férias</h3><button onclick="fecharEdicaoFeriasCalendario()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Funcionário *</label>
        <select id="efcFunc">${funcs.map(fn=>`<option value="${fn}" ${f.funcionario===fn?'selected':''}>${fn}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Início *</label><input type="date" id="efcIni" value="${f.inicio||''}"></div>
        <div class="form-group"><label>Fim *</label><input type="date" id="efcFim" value="${f.fim||''}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoFeriasCalendario(${f.id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoFeriasCalendario()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharEdicaoFeriasCalendario() {
  document.getElementById('modalEditFeriasCalWrap')?.remove();
}

async function salvarEdicaoFeriasCalendario(id) {
  const funcionario = document.getElementById('efcFunc')?.value;
  const inicio = document.getElementById('efcIni')?.value;
  const fim = document.getElementById('efcFim')?.value;
  if (!funcionario || !inicio || !fim) return toast('Preencha todos os campos.','erro');
  if (fim < inicio) return toast('A data final não pode ser antes do início.','erro');
  try {
    await db.salvarFerias({ id, funcionario, inicio, fim, motivo:'Férias' });
    toast('Férias atualizada!','sucesso');
    fecharEdicaoFeriasCalendario();
    await carregarFeriasAno();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

function excluirFeriasCalendarioConfirm(id) {
  confirmarExclusao('Excluir este registro de férias?', async () => {
    try {
      await db.excluirFerias(id);
      toast('Removido!','sucesso');
      await carregarFeriasAno();
    } catch(e) { toast('Erro ao excluir.','erro'); }
  });
}

// ==========================================
// 📋 LISTA DO ANO (com saldo)
// ==========================================
async function renderizarListaFeriasAno(registros) {
  const el = document.getElementById('listaFeriasAno');
  if (!el) return;
  if (!registros.length) {
    el.innerHTML = '<div class="empty-msg">Nenhuma férias registrada para este ano.</div>';
    return;
  }
  const ordenados = [...registros].sort((a,b)=>a.inicio.localeCompare(b.inicio));
  const linhas = await Promise.all(ordenados.map(async r => {
    const f = _funcionariosFerias.find(x=>x.nome===r.funcionario);
    let saldoTxt = '';
    if (f?.admissao) {
      const saldo = await calcularSaldoFerias(r.funcionario, f.admissao);
      saldoTxt = `saldo ${saldo.saldo}/30`;
    }
    const cor = _coresPorFuncionario[r.funcionario] || _PALETA_FERIAS[0];
    const raw = JSON.stringify(r).replace(/'/g,"&apos;");
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #f1f5f9">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:10px;height:10px;border-radius:50%;background:${cor.cor};display:inline-block"></span>
        <div>
          <div style="font-size:13px;font-weight:600;color:#1e3a5f">${r.funcionario}</div>
          <div style="font-size:11px;color:#94a3b8">${f?.setor||'—'} · ${r.inicio.split('-').reverse().join('/')} a ${r.fim.split('-').reverse().join('/')} ${saldoTxt?'· '+saldoTxt:''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${r._conflito?'<span style="font-size:11px;background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:8px;font-weight:700">conflito</span>':''}
        <button onclick='abrirEdicaoFeriasCalendario(${raw})' style="background:none;border:none;color:#0056b3;cursor:pointer">✏️</button>
        <button onclick="excluirFeriasCalendarioConfirm(${r.id})" style="background:none;border:none;color:#ef4444;cursor:pointer">🗑️</button>
      </div>
    </div>`;
  }));
  el.innerHTML = linhas.join('');
}

// ==========================================
// 💰 CÁLCULO DE SALDO — 30 dias/ano, reset no aniversário de admissão
// ==========================================
function _periodoAquisitivoAtual(admissaoStr, refDateStr) {
  let inicio = new Date(admissaoStr+'T12:00:00');
  const ref = new Date(refDateStr+'T12:00:00');
  if (ref < inicio) return { inicio: admissaoStr, fim: admissaoStr };
  let guard = 0;
  while (guard < 100) {
    const fimTentativa = new Date(inicio);
    fimTentativa.setFullYear(fimTentativa.getFullYear()+1);
    fimTentativa.setDate(fimTentativa.getDate()-1);
    if (ref <= fimTentativa) {
      return { inicio: inicio.toISOString().split('T')[0], fim: fimTentativa.toISOString().split('T')[0] };
    }
    inicio.setFullYear(inicio.getFullYear()+1);
    guard++;
  }
  return { inicio: admissaoStr, fim: admissaoStr };
}

async function calcularSaldoFerias(funcionario, admissao, dataReferencia) {
  const ref = dataReferencia || new Date().toISOString().split('T')[0];
  const periodo = _periodoAquisitivoAtual(admissao, ref);
  let registros = _registrosFerias.filter(r => r.funcionario === funcionario);
  if (!registros.length) {
    try { registros = await db._get('ferias', 'funcionario=eq.'+encodeURIComponent(funcionario)+'&motivo=eq.Férias', '*') || []; }
    catch(e) { registros = []; }
  } else {
    registros = registros.filter(r => r.motivo === 'Férias');
  }
  let usados = 0;
  registros.forEach(r => {
    const ini = r.inicio < periodo.inicio ? periodo.inicio : r.inicio;
    const fim = r.fim > periodo.fim ? periodo.fim : r.fim;
    if (ini <= fim) {
      usados += Math.round((new Date(fim+'T12:00:00')-new Date(ini+'T12:00:00'))/86400000) + 1;
    }
  });
  return { usados, saldo: Math.max(0, 30-usados), periodoInicio: periodo.inicio, periodoFim: periodo.fim };
}
