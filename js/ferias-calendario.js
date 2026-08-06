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
const _SETORES_FERIAS = ['Todos','Usinagem','Bancada','Projeto','Produção'];
const _CORES_SETOR_FERIAS = { Todos:'#1e3a5f', Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', 'Produção':'#10b981' };
var _setorAtivoFerias = 'Todos';

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
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px" id="setorFeriasTabs">
    ${_SETORES_FERIAS.map(s => `<button onclick="mudarSetorFerias('${s}')" id="tabFerias_${s}"
      style="padding:7px 16px;border-radius:20px;border:2px solid ${s===_setorAtivoFerias?_CORES_SETOR_FERIAS[s]:'#e2e8f0'};
      background:${s===_setorAtivoFerias?_CORES_SETOR_FERIAS[s]:'#fff'};color:${s===_setorAtivoFerias?'#fff':_CORES_SETOR_FERIAS[s]};
      font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s">${s}</button>`).join('')}
  </div>
  <div class="cards-row" id="resumoFeriasCards"></div>
  <div id="alertaFeriasWrap"></div>
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

// ==========================================
// ⚠️ ALERTAS — férias a programar / prazo do período aquisitivo se esgotando
// ==========================================
async function renderizarAlertasFerias() {
  const el = document.getElementById('alertaFeriasWrap');
  if (!el) return;
  const hoje = new Date().toISOString().split('T')[0];
  const setorMapeado = _setorAtivoFerias === 'Produção' ? ['Producao','Produção'] : [_setorAtivoFerias];
  const funcsAlvo = _setorAtivoFerias === 'Todos'
    ? _funcionariosFerias
    : _funcionariosFerias.filter(f => setorMapeado.includes(f.setor));

  const alertas = [];
  for (const f of funcsAlvo) {
    if (!f.admissao) continue;
    const saldo = await calcularSaldoFerias(f.nome, f.admissao);
    if (saldo.saldo <= 0) continue; // já programou/usou os 30 dias do período
    const diasAtePrazo = Math.round((new Date(saldo.periodoFim+'T12:00:00') - new Date(hoje+'T12:00:00')) / 86400000);
    alertas.push({ nome: f.nome, setor: f.setor, saldo: saldo.saldo, diasAtePrazo });
  }

  if (!alertas.length) { el.innerHTML = ''; return; }
  alertas.sort((a,b) => a.diasAtePrazo - b.diasAtePrazo);

  el.innerHTML = `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:16px">
    <div style="font-weight:700;color:#92400e;font-size:14px;margin-bottom:10px">⚠️ Férias a Programar (${alertas.length})</div>
    <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
      ${alertas.map(a => {
        const vencido = a.diasAtePrazo < 0;
        const urgente = !vencido && a.diasAtePrazo <= 60;
        const cor = vencido ? '#b91c1c' : urgente ? '#c2410c' : '#92400e';
        const prazoTxt = vencido ? `venceu há ${Math.abs(a.diasAtePrazo)} dias` : `${a.diasAtePrazo} dias até vencer o período`;
        return `<div style="color:${cor}">${vencido?'🔴':urgente?'🟠':'🟡'} <b>${a.nome}</b> (${a.setor||'—'}) — ${a.saldo} dia${a.saldo>1?'s':''} sem programar · ${prazoTxt}</div>`;
      }).join('')}
    </div>
  </div>`;
}

function mudarAnoFerias(delta) {
  _anoAtualFerias += delta;
  const label = document.getElementById('labelAnoFerias');
  if (label) label.innerText = _anoAtualFerias;
  carregarFeriasAno();
}

function mudarSetorFerias(setor) {
  _setorAtivoFerias = setor;
  _SETORES_FERIAS.forEach(s => {
    const btn = document.getElementById('tabFerias_'+s);
    if (!btn) return;
    const ativo = s === setor;
    btn.style.borderColor = ativo ? _CORES_SETOR_FERIAS[s] : '#e2e8f0';
    btn.style.background  = ativo ? _CORES_SETOR_FERIAS[s] : '#fff';
    btn.style.color       = ativo ? '#fff' : _CORES_SETOR_FERIAS[s];
  });
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

    // Conflito é calculado com TODOS os registros do ano (não só os do setor visível),
    // já que a comparação em si já é restrita ao mesmo setor internamente
    _calcularConflitos(registrosDoAno);

    // Exibição (calendário, cards, lista) mostra só o setor da aba selecionada
    const setorMapeado = _setorAtivoFerias === 'Produção' ? ['Producao','Produção'] : [_setorAtivoFerias];
    const registrosFiltrados = _setorAtivoFerias === 'Todos'
      ? registrosDoAno
      : registrosDoAno.filter(r => setorMapeado.includes(r._setor));

    _atribuirCoresFerias(registrosFiltrados);
    _montarItensPorDia(registrosFiltrados);

    renderizarResumoFerias(registrosFiltrados);
    renderizarCalendarioFerias();
    await renderizarListaFeriasAno(registrosFiltrados);
    await renderizarAlertasFerias();
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
  el.innerHTML = `
    <div class="resume-card" style="background:#dbeafe;border-left:4px solid #1d4ed8">
      <div style="font-size:11px;color:#0c4a6e;font-weight:600">👥 Pessoas de Férias</div>
      <div style="font-size:28px;color:#1d4ed8;font-weight:700">${pessoas}</div>
    </div>
    <div class="resume-card" style="background:#ede9fe;border-left:4px solid #7c3aed">
      <div style="font-size:11px;color:#4c1d95;font-weight:600">📅 Total de Dias</div>
      <div style="font-size:28px;color:#7c3aed;font-weight:700">${totalDias}</div>
    </div>
  `;
}

// ==========================================
// 📅 CALENDÁRIO (4 meses por linha)
// ==========================================
function renderizarCalendarioFerias() {
  const el = document.getElementById('gridCalendarioFerias');
  if (!el) return;
  const linhas = [];
  for (let i=0; i<12; i+=4) {
    const card = document.createElement('div');
    card.innerHTML = [...Array(4)].map((_, offset) => {
      const m = i + offset;
      if (m >= 12) return '';
      return _renderMesCalendarioFerias(m);
    }).join('');
    linhas.push(card.innerHTML);
  }
  el.innerHTML = linhas.join('');
}

function _renderMesCalendarioFerias(mesIndex) {
  const mes = mesIndex + 1;
  const primeiroDia = new Date(_anoAtualFerias, mesIndex, 1).getDay();
  const diasDoMes = new Date(_anoAtualFerias, mesIndex+1, 0).getDate();
  const linhas = [];
  let diaAtual = 1;
  for (let s=0; s<6; s++) {
    const dias = [];
    for (let d=0; d<7; d++) {
      if (s===0 && d<primeiroDia) {
        dias.push('<div></div>');
      } else if (diaAtual<=diasDoMes) {
        const diaStr = String(diaAtual).padStart(2,'0');
        const dataStr = `${_anoAtualFerias}-${String(mes).padStart(2,'0')}-${diaStr}`;
        const itens = _itensPorDiaFerias[dataStr] || [];
        const temConflito = itens.some(x=>x.conflito);
        const hover = itens.length > 0 ? "style=\"background:#f0f9ff;border-color:#0284c7\"" : "";
        let nomes = itens.map(x=>`<span style="font-size:8px;background:${x.cor.bg};color:${x.cor.cor};padding:1px 3px;border-radius:2px;display:inline-block;margin:1px;white-space:nowrap">${x.nome.split(' ')[0]}</span>`).join('');
        dias.push(`<div ${hover} style="padding:4px;border:1px solid ${temConflito?'#ef4444':'#e2e8f0'};border-radius:4px;min-height:32px;font-size:10px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between">
          <div style="font-weight:600;color:#1e3a5f">${diaAtual}</div>
          <div style="display:flex;gap:1px;flex-wrap:wrap">${nomes}</div>
        </div>`);
        diaAtual++;
      } else {
        dias.push('<div></div>');
      }
    }
    linhas.push(`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">${dias.join('')}</div>`);
  }
  return `
    <div style="background:#f9fafb;padding:12px;border-radius:8px;border:1px solid #e2e8f0">
      <div style="font-weight:700;color:#1e3a5f;font-size:14px;margin-bottom:8px;text-align:center">${_NOMES_MES[mesIndex]}</div>
      <div style="font-size:9px;color:#64748b;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;text-align:center;font-weight:600">
        <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
      </div>
      ${linhas.join('')}
    </div>
  `;
}

// ==========================================
// ➕ NOVA FÉRIAS (com Data Inicial + Quantidade de Dias)
// ==========================================
function abrirNovaFeriasRapida(dataPreenchida) {
  const mapaSetorFerias = {
    'Usinagem': _listas?.funcionarios || [],
    'Bancada':  _listas?.funcBancada || [],
    'Projeto':  _listas?.funcProjeto || [],
    'Produção': _listas?.funcProducao || []
  };
  const funcs = (_setorAtivoFerias !== 'Todos' ? (mapaSetorFerias[_setorAtivoFerias] || []) :
    (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[]).concat(_listas?.funcProjeto||[]).concat(_listas?.funcProducao||[])
  ).filter((v,i,a)=>a.indexOf(v)===i).sort();
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
        <div class="form-group"><label>Data Inicial *</label><input type="date" id="nfcIni" value="${dataPreenchida||''}"></div>
        <div class="form-group"><label>Quantidade de Dias *</label><input type="number" id="nfcDias" value="1" min="1" max="30"></div>
      </div>
      <div id="nfcDataFimPreview" style="font-size:12px;color:#475569;margin-top:4px;padding:8px;background:#f1f5f9;border-radius:4px;display:none">
        <strong>Fim em:</strong> <span id="nfcDataFimSpan"></span>
      </div>
      <div id="nfcSaldoInfo" style="font-size:12px;color:#64748b;margin-top:8px;padding:8px;background:#f0fdf4;border-radius:4px;border-left:3px solid #22c55e"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovaFeriasRapida()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharNovaFeriasRapida()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);

  const selFunc = document.getElementById('nfcFunc');
  const inputIni = document.getElementById('nfcIni');
  const inputDias = document.getElementById('nfcDias');

  // Atualizar preview quando qualquer campo mudar
  const atualizarPreview = async () => {
    const nome = selFunc.value;
    const inicio = inputIni.value;
    const dias = parseInt(inputDias.value) || 1;
    const infoEl = document.getElementById('nfcSaldoInfo');
    const previewEl = document.getElementById('nfcDataFimPreview');
    const fimSpan = document.getElementById('nfcDataFimSpan');

    if (inicio && dias > 0) {
      // Calcular data de fim
      const dataIni = new Date(inicio + 'T12:00:00');
      const dataFim = new Date(dataIni);
      dataFim.setDate(dataFim.getDate() + dias - 1);
      const fimStr = dataFim.toISOString().split('T')[0];
      fimSpan.innerText = fimStr.split('-').reverse().join('/');
      previewEl.style.display = 'block';
    } else {
      previewEl.style.display = 'none';
    }

    if (!nome || !infoEl) return;
    const f = _funcionariosFerias.find(x=>x.nome===nome);
    if (!f || !f.admissao) { infoEl.innerHTML=''; return; }
    const saldo = await calcularSaldoFerias(nome, f.admissao);
    const faltam = 30 - saldo.usados;
    infoEl.innerHTML = `<strong>Saldo:</strong> ${saldo.saldo} de 30 dias<br><strong>Período:</strong> ${saldo.periodoInicio.split('-').reverse().join('/')} a ${saldo.periodoFim.split('-').reverse().join('/')}`;
  };

  if (selFunc) selFunc.onchange = atualizarPreview;
  if (inputIni) inputIni.onchange = atualizarPreview;
  if (inputDias) inputDias.onchange = atualizarPreview;
}

function fecharNovaFeriasRapida() {
  document.getElementById('modalNovaFeriasCalWrap')?.remove();
}

async function salvarNovaFeriasRapida() {
  const funcionario = document.getElementById('nfcFunc')?.value;
  const inicio = document.getElementById('nfcIni')?.value;
  const dias = parseInt(document.getElementById('nfcDias')?.value) || 1;
  
  if (!funcionario) return toast('Selecione o funcionário.','erro');
  if (!inicio) return toast('Informe a data inicial.','erro');
  if (dias < 1 || dias > 30) return toast('A quantidade de dias deve estar entre 1 e 30.','erro');
  
  try {
    // Calcular data de fim a partir de data inicial + dias
    const dataIni = new Date(inicio + 'T12:00:00');
    const dataFim = new Date(dataIni);
    dataFim.setDate(dataFim.getDate() + dias - 1);
    const fim = dataFim.toISOString().split('T')[0];
    
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
  
  // Calcular número de dias baseado em início e fim
  const dataIni = new Date(f.inicio + 'T12:00:00');
  const dataFim = new Date(f.fim + 'T12:00:00');
  const dias = Math.round((dataFim - dataIni) / 86400000) + 1;

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
        <div class="form-group"><label>Data Inicial *</label><input type="date" id="efcIni" value="${f.inicio||''}"></div>
        <div class="form-group"><label>Quantidade de Dias *</label><input type="number" id="efcDias" value="${dias}" min="1" max="30"></div>
      </div>
      <div id="efcDataFimPreview" style="font-size:12px;color:#475569;margin-top:4px;padding:8px;background:#f1f5f9;border-radius:4px">
        <strong>Fim em:</strong> <span id="efcDataFimSpan">${f.fim.split('-').reverse().join('/')}</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoFeriasCalendario(${f.id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoFeriasCalendario()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);

  // Atualizar preview quando mudar
  const inputIni = document.getElementById('efcIni');
  const inputDias = document.getElementById('efcDias');
  const fimSpan = document.getElementById('efcDataFimSpan');

  const atualizarPreview = () => {
    const inicio = inputIni.value;
    const qtdDias = parseInt(inputDias.value) || 1;
    if (inicio && qtdDias > 0) {
      const dataIni = new Date(inicio + 'T12:00:00');
      const dataFim = new Date(dataIni);
      dataFim.setDate(dataFim.getDate() + qtdDias - 1);
      fimSpan.innerText = dataFim.toISOString().split('T')[0].split('-').reverse().join('/');
    }
  };

  if (inputIni) inputIni.onchange = atualizarPreview;
  if (inputDias) inputDias.onchange = atualizarPreview;
}

function fecharEdicaoFeriasCalendario() {
  document.getElementById('modalEditFeriasCalWrap')?.remove();
}

async function salvarEdicaoFeriasCalendario(id) {
  const funcionario = document.getElementById('efcFunc')?.value;
  const inicio = document.getElementById('efcIni')?.value;
  const dias = parseInt(document.getElementById('efcDias')?.value) || 1;
  
  if (!funcionario || !inicio) return toast('Preencha todos os campos.','erro');
  if (dias < 1 || dias > 30) return toast('A quantidade de dias deve estar entre 1 e 30.','erro');
  
  try {
    // Calcular data de fim a partir de data inicial + dias
    const dataIni = new Date(inicio + 'T12:00:00');
    const dataFim = new Date(dataIni);
    dataFim.setDate(dataFim.getDate() + dias - 1);
    const fim = dataFim.toISOString().split('T')[0];
    
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
// 📋 LISTA DO ANO (com saldo e período faltante)
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
    let diasFaltando = '';
    if (f?.admissao) {
      const saldo = await calcularSaldoFerias(r.funcionario, f.admissao);
      saldoTxt = `saldo ${saldo.saldo}/30`;
      
      // Calcular período faltante (dias até atingir 30 dias)
      if (saldo.saldo > 0) {
        const faltam = 30 - saldo.usados;
        diasFaltando = `<span style="font-size:11px;background:#fef08a;color:#92400e;padding:2px 8px;border-radius:8px;margin-left:4px">Faltam ${faltam} dias para completar o período</span>`;
      }
    }
    
    const cor = _coresPorFuncionario[r.funcionario] || _PALETA_FERIAS[0];
    const raw = JSON.stringify(r).replace(/'/g,"&apos;");
    const dias = Math.round((new Date(r.fim+'T12:00:00')-new Date(r.inicio+'T12:00:00'))/86400000) + 1;
    
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #f1f5f9">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        <span style="width:10px;height:10px;border-radius:50%;background:${cor.cor};display:inline-block"></span>
        <div>
          <div style="font-size:13px;font-weight:600;color:#1e3a5f">${r.funcionario}</div>
          <div style="font-size:11px;color:#94a3b8">${f?.setor||'—'} · ${r.inicio.split('-').reverse().join('/')} a ${r.fim.split('-').reverse().join('/')} · ${dias} dias ${saldoTxt?'· '+saldoTxt:''}</div>
          ${diasFaltando}
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
