// ==========================================
// 🚀 APP.JS — Inicialização e Navegação V3
// ==========================================

var _telaAtual = null;
var _excluirCallback = null;

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  if (!carregarSessao()) return;

  // Saudação personalizada
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const elSauda = document.getElementById('saudacaoTitulo');
  if (elSauda) elSauda.innerText = saudacao + ', ' + (_sessao?.nome || '') + '!';

  // Data na topbar
  const hoje = new Date();
  const diasSem = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const elData = document.getElementById('topbarData');
  if (elData) elData.innerText = diasSem[hoje.getDay()] + ', ' + hoje.toLocaleDateString('pt-BR');

  // Carrega listas globais
  try {
    _listas = await db.obterListas();
    inicializarAutocompletes();
  } catch(e) {
    console.error('Erro ao carregar listas:', e);
    toast('Erro ao carregar dados do sistema.', 'erro');
  }

  // Aplica permissões e navega
  aplicarPermissoes();

  // Datas do dashboard
  const fDate = d => d.toISOString().split('T')[0];
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dashIni = document.getElementById('dashIni');
  const dashFim = document.getElementById('dashFim');
  const dashMes = document.getElementById('dashMes');
  if (dashIni) dashIni.value = fDate(ini);
  if (dashFim) dashFim.value = fDate(hoje);
  if (dashMes) dashMes.value = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');

  // Navegação por histórico do browser
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.tela) {
      const el = document.getElementById('menu' + e.state.tela.charAt(0).toUpperCase() + e.state.tela.slice(1)) || null;
      _irParaSemHistory(e.state.tela, el);
    }
  });
});

// ==========================================
// 🧭 NAVEGAÇÃO
// ==========================================
var _mapaTelaEl = {
  dashboard:    'telaDashboard',
  usinagem:     'telaApontamentos',
  bancada:      'telaApontamentos',
  projeto:      'telaApontamentos',
  producao:     'telaProducao',
  moldes:       'telaMoldes',
  ficha:        'telaFicha',
  historico:    'telaHistorico',
  funcionarios: 'telaFuncionarios',
  jobsAdmin:    'telaJobsAdmin',
  maquinasAdmin:'telaMaquinasAdmin',
  injetoras:    'telaInjetoras',
  categorias:   'telaCategorias',
  feriados:     'telaFeriados',
  usuarios:     'telaUsuarios',
};

var _mapaTitulos = {
  dashboard:    'BI / Dashboard',
  usinagem:     'Usinagem',
  bancada:      'Bancada',
  projeto:      'Projeto',
  producao:     'Produção / Setup',
  moldes:       'Gestão de Moldes',
  ficha:        'Ficha do Molde',
  historico:    'Histórico',
  funcionarios: 'Funcionários',
  jobsAdmin:    'Moldes / Jobs',
  maquinasAdmin:'Máquinas',
  injetoras:    'Injetoras',
  categorias:   'Categorias',
  feriados:     'Gestão e RH',
  usuarios:     'Usuários',
};

function irPara(tela, elMenu) {
  // Empurra no histórico do browser
  history.pushState({ tela: tela }, '', '#' + tela);
  _irParaSemHistory(tela, elMenu);
}

function _irParaSemHistory(tela, elMenu) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

  _telaAtual = tela;
  const idTela = _mapaTelaEl[tela];
  if (idTela) document.getElementById(idTela)?.classList.add('ativa');
  if (elMenu) elMenu.classList.add('active');

  const titulo = document.getElementById('topbarTitulo');
  if (titulo) titulo.innerText = _mapaTitulos[tela] || tela;

  // Fechar sidebar no mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('open');
  }

  // Fechar modal se estiver aberto
  fecharModalForm();

  // Ações automáticas ao navegar
  setTimeout(() => {
    if (['usinagem','bancada','projeto'].includes(tela)) {
      abrirSetor(tela);
    } else if (tela === 'producao') {
      inicializarProducao();
    } else if (tela === 'dashboard') {
      carregarDashboard();
    } else if (tela === 'moldes') {
      carregarMoldes();
    } else if (tela === 'historico') {
      inicializarHistorico();
    } else if (tela === 'feriados') {
      inicializarRH();
    } else if (tela === 'usuarios') {
      carregarUsuarios();
    } else if (tela === 'funcionarios') {
      carregarFuncionariosAdmin();
    } else if (tela === 'jobsAdmin') {
      carregarJobsAdmin();
    } else if (tela === 'maquinasAdmin') {
      carregarMaquinasAdmin();
    } else if (tela === 'injetoras') {
      carregarInjetoras();
    } else if (tela === 'categorias') {
      carregarCategorias();
    }
  }, 50);
}

// ==========================================
// 🔒 ADMIN RECOLHÍVEL
// ==========================================
function toggleAdmin() {
  const label = document.getElementById('adminLabel');
  const items = document.getElementById('adminItems');
  if (!label || !items) return;
  label.classList.toggle('aberto');
  items.classList.toggle('aberto');
}

// ==========================================
// 📋 AUTOCOMPLETES GLOBAIS
// ==========================================
function inicializarAutocompletes() {
  if (!_listas) return;
  const jobs = _listas.jobs || [];
  setupAC('formJob',         'formJobList',         jobs);
  setupAC('fichaJobInput',   'fichaJobList',         jobs);
  setupAC('histJob',         'histJobList',          jobs);
  setupAC('prodFormMolde',   'prodFormMoldeList',    jobs);
  setupAC('formTipoBancadaInput', 'formTipoBancadaList', _listas.tiposBancada || [], val => {
    document.getElementById('formTipoBancada').value = val;
  });
}

function setupAC(inputId, listaId, dados, onSelect) {
  const input = document.getElementById(inputId);
  const lista  = document.getElementById(listaId);
  if (!input || !lista) return;
  input.addEventListener('input', () => {
    const termo = input.value.toUpperCase();
    lista.innerHTML = '';
    if (!termo) { lista.style.display = 'none'; return; }
    const filtrados = dados.filter(d => d.toUpperCase().includes(termo)).slice(0, 30);
    if (!filtrados.length) { lista.style.display = 'none'; return; }
    filtrados.forEach(item => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.innerText = item;
      div.onclick = () => {
        input.value = item;
        lista.style.display = 'none';
        if (onSelect) onSelect(item);
      };
      lista.appendChild(div);
    });
    lista.style.display = 'block';
  });
  document.addEventListener('click', e => { if (e.target !== input) lista.style.display = 'none'; });
}

// ==========================================
// 🔔 TOAST
// ==========================================
function toast(msg, tipo) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerText = msg;
  el.className = 'show' + (tipo ? ' ' + tipo : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', 3500);
}

// ==========================================
// 🪟 MODAL FORMULÁRIO LANÇAMENTO
// ==========================================
function abrirModalForm() {
  const overlay = document.getElementById('modalFormOverlay');
  if (overlay) {
    overlay.classList.add('aberto');
    document.body.style.overflow = 'hidden';
  }
}

function fecharModalForm() {
  const overlay = document.getElementById('modalFormOverlay');
  if (overlay) {
    overlay.classList.remove('aberto');
    document.body.style.overflow = '';
  }
}

// Fechar ao clicar no overlay (fora do modal)
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modalFormOverlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) fecharModalForm();
    });
  }
  const overlayProd = document.getElementById('modalFormProdOverlay');
  if (overlayProd) {
    overlayProd.addEventListener('click', function(e) {
      if (e.target === overlayProd) cancelarFormProducao();
    });
  }
});

function abrirModalFormProd() {
  const overlay = document.getElementById('modalFormProdOverlay');
  if (overlay) {
    overlay.classList.add('aberto');
    document.body.style.overflow = 'hidden';
  }
}

function fecharModalFormProd() {
  const overlay = document.getElementById('modalFormProdOverlay');
  if (overlay) {
    overlay.classList.remove('aberto');
    document.body.style.overflow = '';
  }
}

// ==========================================
// 🗑️ MODAL CONFIRMAÇÃO
// ==========================================
function confirmarExclusao(msg, callback) {
  _excluirCallback = callback;
  document.getElementById('modalConfMsg').innerText = msg;
  document.getElementById('modalConfOverlay').style.display = 'block';
  document.getElementById('modalConf').style.display = 'block';
}
function fecharModalConf() {
  document.getElementById('modalConfOverlay').style.display = 'none';
  document.getElementById('modalConf').style.display = 'none';
  _excluirCallback = null;
}
function executarExclusao() {
  fecharModalConf();
  if (_excluirCallback) { _excluirCallback(); _excluirCallback = null; }
}

// ==========================================
// 🔩 MODAL STATUS JOB
// ==========================================
var _jobAtual = null;
var _statusAtual = null;

function abrirModalStatus(job) {
  _jobAtual = job; _statusAtual = null;
  document.getElementById('modalJobNome').innerText = job;
  ['And','Paus','Fin'].forEach(s => {
    const btn = document.getElementById('modalBtn' + s);
    if (btn) btn.className = 'btn-status';
  });
  document.getElementById('btnConfirmarStatus').style.opacity = '0.4';
  document.getElementById('btnConfirmarStatus').style.pointerEvents = 'none';
  document.getElementById('modalDescWrap').style.display = 'none';
  document.getElementById('modalDataFimWrap').style.display = 'none';
  document.getElementById('modalDesc').value = '';
  document.getElementById('modalStatusOverlay').style.display = 'block';
  document.getElementById('modalStatus').style.display = 'block';
}

function selecionarStatusModal(status) {
  _statusAtual = status;
  const mapBtn = { 'Em andamento':'And', 'Pausado':'Paus', 'Finalizado':'Fin' };
  ['And','Paus','Fin'].forEach(s => { document.getElementById('modalBtn' + s).className = 'btn-status'; });
  const btn = document.getElementById('modalBtn' + mapBtn[status]);
  if (btn) btn.className = 'btn-status ' + (status==='Finalizado'?'ativo-fin':'ativo-and');
  const conf = document.getElementById('btnConfirmarStatus');
  conf.style.opacity = '1'; conf.style.pointerEvents = 'auto';
  document.getElementById('modalDescWrap').style.display = (status==='Pausado'||status==='Finalizado') ? 'block' : 'none';
  document.getElementById('modalDataFimWrap').style.display = status==='Finalizado' ? 'block' : 'none';
}

async function confirmarStatus() {
  if (!_jobAtual || !_statusAtual) return;
  const btn = document.getElementById('btnConfirmarStatus');
  btn.disabled = true; btn.innerText = 'Salvando...';
  const desc    = document.getElementById('modalDesc').value.trim();
  const dataFim = document.getElementById('modalDataFim').value;
  const job = _jobAtual; const status = _statusAtual;
  fecharModalStatus();
  try {
    await db.salvarStatusJob(job, status, desc, dataFim);
    toast('Status atualizado!', 'sucesso');
    if (typeof carregarMoldes === 'function') await carregarMoldes();
  } catch(e) { toast('Erro ao salvar status.', 'erro'); }
  btn.disabled = false; btn.innerText = 'Confirmar';
}

function fecharModalStatus() {
  document.getElementById('modalStatusOverlay').style.display = 'none';
  document.getElementById('modalStatus').style.display = 'none';
  _jobAtual = null; _statusAtual = null;
}

// ==========================================
// 📊 DASHBOARD — PERÍODO
// ==========================================
function setSemanaDash(n) {
  const hoje = new Date(); const ano = hoje.getFullYear(); const mes = hoje.getMonth();
  const dias = new Date(ano, mes+1, 0).getDate();
  const ranges = { 1:[1,7], 2:[8,14], 3:[15,21], 4:[22,dias] };
  const [d1,d2] = ranges[n];
  const fDate = d => new Date(ano,mes,d).toISOString().split('T')[0];
  document.getElementById('dashIni').value = fDate(d1);
  document.getElementById('dashFim').value = fDate(d2);
  carregarDashboard();
}

function selecionarMesDash() {
  const val = document.getElementById('dashMes').value;
  if (!val) return;
  const [ano,mes] = val.split('-').map(Number);
  const ini = new Date(ano,mes-1,1);
  const fim = new Date(ano,mes,0);
  const fDate = d => d.toISOString().split('T')[0];
  document.getElementById('dashIni').value = fDate(ini);
  document.getElementById('dashFim').value = fDate(fim);
  carregarDashboard();
}

function mudarTabDash(aba, elBtn) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('ativo'));
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('ativa'));
  const id = 'dash' + aba.charAt(0).toUpperCase() + aba.slice(1);
  document.getElementById(id)?.classList.add('ativo');
  if (elBtn) elBtn.classList.add('ativa');
  renderizarDashAtivo(aba);
}

// ==========================================
// 📱 SIDEBAR MOBILE / COLLAPSE
// ==========================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('collapsed');
  }
}

// ==========================================
// 🛠️ HELPERS GLOBAIS
// ==========================================
function fmtData(d) {
  if (!d) return '-';
  return d.split('-').reverse().join('/');
}
function fmtMin(mins) {
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + 'h';
}
function corStatus(s) {
  return s==='Finalizado'?'#10b981':s==='Pausado'?'#f59e0b':'#f97316';
}
function icoStatus(s) {
  return s==='Finalizado'?'🟢':s==='Pausado'?'🟡':'🟠';
}

// Stubs para telas admin
function carregarFuncionariosAdmin() { if(typeof carregarFuncionariosRH==='function') carregarFuncionariosRH(); }
function carregarJobsAdmin()      { const el=document.getElementById('listaJobsAdmin');      if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarJobs(); }
function carregarMaquinasAdmin()  { const el=document.getElementById('listaMaquinas');       if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarMaquinasLista(); }
function carregarInjetoras()      { const el=document.getElementById('listaInjetoras');      if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarInjetorasLista(); }
function carregarCategorias()     { const el=document.getElementById('painelCategorias');    if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarCategoriasLista(); }

// ==========================================
// 🗂️ ADMIN: JOBS / MOLDES
// ==========================================
async function _carregarJobs() {
  try {
    const res = await db._get('jobs','order=nome.asc','*');
    const el = document.getElementById('listaJobsAdmin');
    if (!el) return;
    if (!res || !res.length) { el.innerHTML='<div class="empty-msg">Nenhum job cadastrado.</div>'; return; }
    
    const filtroTipo = document.getElementById('filtroTipoJob')?.value || 'todos';
    const busca = (document.getElementById('buscaJobAdmin')?.value || '').toUpperCase();
    
    const filtrado = res.filter(j => {
      const sv = j.nome.toUpperCase().startsWith('SV') || j.nome.toUpperCase().startsWith('S/');
      if (filtroTipo==='molde' && sv) return false;
      if (filtroTipo==='servico' && !sv) return false;
      if (busca && !j.nome.toUpperCase().includes(busca)) return false;
      return true;
    });
    
    el.innerHTML = filtrado.map(j => `
      <div class="lista-item">
        <div class="lista-item-info">
          <div class="lista-item-nome">${j.nome}</div>
          <div class="lista-item-sub">${j.nome.toUpperCase().startsWith('SV')||j.nome.toUpperCase().startsWith('S/')?'Serviço':'Molde'}</div>
        </div>
        <div class="lista-item-acoes">
          <span class="${j.ativo?'badge-ativo':'badge-inativo'}">${j.ativo?'ATIVO':'INATIVO'}</span>
          <button class="btn-icon" title="Editar" onclick="editarJob(${j.id}, '${j.nome}')">✏️</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirJob(${j.id})">🗑️</button>
        </div>
      </div>`).join('');
  } catch(e) { toast('Erro ao carregar jobs.','erro'); }
}

function filtrarJobsAdmin() { _carregarJobs(); }

async function abrirFormJob() {
  const nome = prompt('Nome do Molde / Job ou Serviço (ex: MOL-001 ou SV-001):');
  if (!nome || !nome.trim()) return;
  try {
    await db._post('jobs', { nome: nome.trim(), ativo: true });
    toast('Adicionado!','sucesso');
    if (_listas) _listas.jobs = (_listas.jobs||[]).concat(nome.trim());
    inicializarAutocompletes();
    carregarJobsAdmin();
  } catch(e) { toast('Erro ao adicionar.','erro'); }
}

async function editarJob(id, nomeAtual) {
  const nome = prompt('Renomear Molde/Job ou Serviço:', nomeAtual);
  if (!nome || !nome.trim() || nome.trim() === nomeAtual) return;
  try {
    await db._patch('jobs', 'id=eq.'+id, { nome: nome.trim() });
    toast('Atualizado com sucesso!', 'sucesso');
    carregarJobsAdmin();
  } catch(e) { toast('Erro ao atualizar.', 'erro'); }
}

async function excluirJob(id) {
  confirmarExclusao('Remover este job/molde?', async () => {
    try { await db._patch('jobs','id=eq.'+id,{ativo:false}); toast('Removido!','sucesso'); carregarJobsAdmin(); }
    catch(e) { toast('Erro.','erro'); }
  });
}

// ==========================================
// ⚙️ ADMIN: MÁQUINAS (USINAGEM/BANCADA)
// ==========================================
async function _carregarMaquinasLista() {
  try {
    const res = await db.listarMaquinas();
    const el = document.getElementById('listaMaquinas');
    if (!el) return;
    el.innerHTML = (res||[]).map(m => `
      <div class="lista-item">
        <div class="lista-item-info">
          <div class="lista-item-nome">${m.nome}</div>
          <div class="lista-item-sub">Turno: ${m.turno||'ADM'} | Cap: ${m.cap_liquida||508} min/dia</div>
        </div>
        <div class="lista-item-acoes">
          <span class="${m.ativo?'badge-ativo':'badge-inativo'}">${m.ativo?'ATIVO':'INATIVO'}</span>
          <button class="btn-icon" title="Editar" onclick="editarMaquinaAdmin(${m.id}, '${m.nome}', '${m.turno||'ADM'}', ${m.cap_liquida||508})">✏️</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirMaquinaAdmin(${m.id})">🗑️</button>
        </div>
      </div>`).join('') || '<div class="empty-msg">Nenhuma máquina.</div>';
  } catch(e) { toast('Erro ao carregar.','erro'); }
}

async function abrirFormMaquina() {
  const nome = prompt('Nome da Máquina:');
  if (!nome||!nome.trim()) return;
  try { await db.salvarMaquina({nome:nome.trim(),turno:'ADM',ativo:true}); toast('Adicionada!','sucesso'); carregarMaquinasAdmin(); }
  catch(e) { toast('Erro.','erro'); }
}

async function editarMaquinaAdmin(id, nomeAtual, turnoAtual, capAtual) {
  const nome = prompt('Novo nome da Máquina:', nomeAtual);
  if (!nome || !nome.trim()) return;
  const turno = prompt('Turno (ex: ADM, 1T, 2T):', turnoAtual);
  const cap = prompt('Capacidade Líquida (min/dia):', capAtual);
  try { 
    await db._patch('maquinas', 'id=eq.'+id, { nome: nome.trim(), turno: turno, cap_liquida: parseInt(cap) || 508 }); 
    toast('Máquina atualizada!', 'sucesso'); 
    carregarMaquinasAdmin(); 
  } catch(e) { toast('Erro ao atualizar.', 'erro'); }
}

async function excluirMaquinaAdmin(id) {
  confirmarExclusao('Remover esta máquina?', async()=>{ try { await db.excluirMaquina(id); toast('Removida!','sucesso'); carregarMaquinasAdmin(); } catch(e){toast('Erro.','erro');} });
}

// ==========================================
// 🏭 ADMIN: INJETORAS (PRODUÇÃO)
// ==========================================
async function _carregarInjetorasLista() {
  try {
    const res = await db.listarProdInjetoras();
    const el = document.getElementById('listaInjetoras');
    if (!el) return;
    el.innerHTML = (res||[]).map(i => `
      <div class="lista-item">
        <div class="lista-item-info">
          <div class="lista-item-nome">${i.nome}</div>
          <div class="lista-item-sub">${i.tonelagem?i.tonelagem+' ton':'—'} | ${i.fabricante||'—'}</div>
        </div>
        <div class="lista-item-acoes">
          <span class="badge-ativo">ATIVO</span>
          <button class="btn-icon" title="Editar" onclick="editarInjetoraAdmin(${i.id}, '${i.nome}', '${i.tonelagem||''}', '${i.fabricante||''}')">✏️</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirInjetoraAdmin(${i.id})">🗑️</button>
        </div>
      </div>`).join('') || '<div class="empty-msg">Nenhuma injetora.</div>';
  } catch(e) { toast('Erro ao carregar.','erro'); }
}

async function abrirFormInjetora() {
  const nome = prompt('Nome da Injetora (ex: 160-01):');
  if (!nome||!nome.trim()) return;
  const ton  = prompt('Tonelagem (opcional):');
  const fab  = prompt('Fabricante (opcional):');
  try { await db.salvarProdInjetora({nome:nome.trim(),tonelagem:ton?parseInt(ton):null,fabricante:fab||null}); toast('Adicionada!','sucesso'); carregarInjetoras(); }
  catch(e) { toast('Erro.','erro'); }
}

async function editarInjetoraAdmin(id, nomeAtual, tonAtual, fabAtual) {
  const nome = prompt('Novo nome da Injetora:', nomeAtual);
  if (!nome || !nome.trim()) return;
  const ton = prompt('Tonelagem:', tonAtual);
  const fab = prompt('Fabricante:', fabAtual);
  try { 
    await db._patch('prod_injetoras', 'id=eq.'+id, { nome: nome.trim(), tonelagem: ton ? parseInt(ton) : null, fabricante: fab || null }); 
    toast('Injetora atualizada!', 'sucesso'); 
    carregarInjetoras(); 
  } catch(e) { toast('Erro ao atualizar.', 'erro'); }
}

async function excluirInjetoraAdmin(id) {
  confirmarExclusao('Remover esta injetora?', async()=>{ try { await db.excluirProdInjetora(id); toast('Removida!','sucesso'); carregarInjetoras(); } catch(e){toast('Erro.','erro');} });
}

// ==========================================
// 🏷️ ADMIN: CATEGORIAS E SETORES (DINÂMICO)
// ==========================================
async function _carregarCategoriasLista() {
  try {
    const res = await db.listarProdCategorias();
    const el = document.getElementById('painelCategorias');
    if (!el) return;
    
    // Agrupa as categorias de forma totalmente dinâmica pelo Tipo/Setor
    const grupos = {};
    (res||[]).forEach(c => { 
      if (!grupos[c.tipo]) grupos[c.tipo]=[]; 
      grupos[c.tipo].push(c); 
    });
    
    const paletaCores = ['#0056b3', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#0891b2', '#ec4899', '#14b8a6'];
    let corIndex = 0;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
        <p style="font-size:13px; color:var(--cinza);">Crie os Setores (Ex: Usinagem) e adicione as subcategorias dentro deles.</p>
        <button class="btn-primary" onclick="criarNovoGrupoCategoria()">+ Novo Grupo / Setor</button>
      </div>
      <div class="cards-row" style="flex-wrap:wrap; align-items:flex-start">
    `;

    Object.entries(grupos).forEach(([tipo, cats]) => {
      const cor = paletaCores[corIndex % paletaCores.length];
      corIndex++;
      
      html += `
        <div class="card" style="flex:1; min-width:280px; margin-bottom: 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--borda);">
            <span style="background:${cor}20;color:${cor};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700">${tipo}</span>
            <button class="btn-secondary" style="padding:6px 12px;font-size:11px" onclick="adicionarCategoria('${tipo}')">+ Subcategoria</button>
          </div>
          ${cats.map(c => `
            <div class="lista-item" style="padding:10px 0; border-bottom: 1px dashed #f1f5f9;">
              <div class="lista-item-nome" style="font-size:13px; font-weight:500;">• ${c.atividade}</div>
              <div class="lista-item-acoes">
                <button class="btn-icon" title="Editar" onclick="editarCategoria(${c.id}, '${c.atividade}')">✏️</button>
                <button class="btn-icon danger" title="Excluir" onclick="excluirCategoria(${c.id})">🗑️</button>
              </div>
            </div>`).join('')}
        </div>`;
    });
    
    html += '</div>';
    el.innerHTML = html;
  } catch(e) { toast('Erro ao carregar categorias.','erro'); }
}

async function criarNovoGrupoCategoria() {
  const tipo = prompt('Qual será o nome do Novo Grupo ou Setor?\n(Exemplo: Usinagem, Bancada, Produção - Preventiva)');
  if (!tipo || !tipo.trim()) return;
  adicionarCategoria(tipo.trim()); // Pede logo a primeira subcategoria para o grupo existir
}

async function adicionarCategoria(tipo) {
  const ativ = prompt(`Nome da nova atividade/subcategoria para o grupo [${tipo}]:`);
  if (!ativ || !ativ.trim()) return;
  try { 
    await db.salvarProdCategoria({tipo: tipo, atividade: ativ.trim(), ativo: true}); 
    toast('Adicionada com sucesso!', 'sucesso'); 
    carregarCategorias(); 
  } catch(e) { toast('Erro ao adicionar.', 'erro'); }
}

async function editarCategoria(id, ativAtual) {
  const ativ = prompt('Renomear subcategoria:', ativAtual);
  if (!ativ || !ativ.trim() || ativ.trim() === ativAtual) return;
  try {
    await db._patch('prod_categorias', 'id=eq.'+id, { atividade: ativ.trim() });
    toast('Categoria atualizada!', 'sucesso');
    carregarCategorias();
  } catch(e) { toast('Erro ao atualizar.', 'erro'); }
}

async function excluirCategoria(id) {
  confirmarExclusao('Remover esta subcategoria?', async()=>{ 
    try { await db.excluirProdCategoria(id); toast('Removida!','sucesso'); carregarCategorias(); } 
    catch(e){toast('Erro.','erro');} 
  });
}
