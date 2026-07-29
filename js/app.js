// ==========================================
// 🚀 APP.JS — Inicialização e Navegação V3
// ==========================================

var _telaAtual = null;
var _excluirCallback = null;

// ==========================================
// 🔄 AUTO-ATUALIZAÇÃO — evita lançamento em data errada quando a aba fica
// aberta por dias sem F5 (ex: abre segunda de manhã e só fecha sexta)
// ==========================================
var _dataAoCarregarPagina = new Date().toISOString().split('T')[0];

function _existeModalAberto() {
  if (document.querySelector('.modal-form-overlay.aberto')) return true;
  if (document.querySelector('.modal-overlay[style*="display: block"], .modal-overlay[style*="display:block"]')) return true;
  return false;
}

function _checarDataEAtualizarPagina() {
  const dataAtual = new Date().toISOString().split('T')[0];
  if (dataAtual !== _dataAoCarregarPagina && !_existeModalAberto()) {
    location.reload();
  }
}

// Checa a cada 15 minutos — se a data virou e não tem nada aberto, recarrega sozinho
setInterval(_checarDataEAtualizarPagina, 15 * 60 * 1000);
// Checa também quando a aba volta a ficar visível (ex: reabrir o notebook na segunda de manhã)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') _checarDataEAtualizarPagina();
});

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  if (!carregarSessao()) return;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const elSauda = document.getElementById('saudacaoTitulo');
  if (elSauda) elSauda.innerText = saudacao + ', ' + (_sessao?.nome || '') + '!';

  const hoje = new Date();
  const diasSem = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const elData = document.getElementById('topbarData');
  if (elData) elData.innerText = diasSem[hoje.getDay()] + ', ' + hoje.toLocaleDateString('pt-BR');

  try {
    _listas = await db.obterListas();
    inicializarAutocompletes();
  } catch(e) {
    console.error('Erro ao carregar listas:', e);
    toast('Erro ao carregar dados do sistema.', 'erro');
  }

  aplicarPermissoes();

  const fDate = d => d.toISOString().split('T')[0];
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dashIni = document.getElementById('dashIni');
  const dashFim = document.getElementById('dashFim');
  const dashMes = document.getElementById('dashMes');
  if (dashIni) dashIni.value = fDate(ini);
  if (dashFim) dashFim.value = fDate(hoje);
  if (dashMes) dashMes.value = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');

  if (typeof verificarQRCodeURL === 'function') verificarQRCodeURL();

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
  ficha:        'telaFicha',
  historico:    'telaHistorico',
  funcionarios: 'telaFuncionarios',
  jobsAdmin:    'telaJobsAdmin',
  maquinasAdmin:'telaMaquinasAdmin',
  injetoras:    'telaInjetoras',
  categorias:   'telaCategorias',
  feriados:     'telaFeriados',
  usuarios:     'telaUsuarios',
  pcm:          'telaPCM',
  ram:          'telaRAM',
  auditoria:    'telaAuditoria',
  fichaFuncionario: 'telaFichaFuncionario',
  competencias: 'telaCompetencias',
  programacaoFerias: 'telaFeriasCalendario',
};

var _mapaTitulos = {
  dashboard:    'BI / Dashboard',
  usinagem:     'Usinagem',
  bancada:      'Bancada',
  projeto:      'Projeto',
  producao:     'Produção / Setup',
  ficha:        'Ficha do Molde',
  historico:    'Histórico',
  funcionarios: 'Funcionários',
  jobsAdmin:    'Moldes / Jobs',
  maquinasAdmin:'Máquinas',
  injetoras:    'Injetoras',
  categorias:   'Categorias',
  feriados:     'Gestão e RH',
  usuarios:     'Usuários',
  pcm:          'PCM — Controle de Moldes',
  ram:          'RAM — Registros de Alteração/Modificação',
  auditoria:    'Log de Alterações',
  fichaFuncionario: 'Ficha do Funcionário',
  competencias: 'Matriz de Competência',
  programacaoFerias: 'Programação de Férias',
};

function irPara(tela, elMenu) {
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
  if (window.innerWidth <= 768) document.getElementById('sidebar')?.classList.remove('open');
  fecharModalForm();
  setTimeout(() => {
    if (['usinagem','bancada','projeto'].includes(tela)) { abrirSetor(tela); }
    else if (tela === 'producao')     { inicializarProducao(); }
    else if (tela === 'dashboard')    { carregarDashboard(); }
    else if (tela === 'historico')    { inicializarHistorico(); }
    else if (tela === 'feriados')     { inicializarRH(); }
    else if (tela === 'usuarios')     { carregarUsuarios(); }
    else if (tela === 'funcionarios') { carregarFuncionariosAdmin(); }
    else if (tela === 'jobsAdmin')    { carregarJobsAdmin(); }
    else if (tela === 'maquinasAdmin'){ carregarMaquinasAdmin(); }
    else if (tela === 'injetoras')    { carregarInjetoras(); }
    else if (tela === 'categorias')   { carregarCategorias(); }
    else if (tela === 'pcm')          { inicializarPCM(); }
    else if (tela === 'ram')          { inicializarPainelRAM(); }
    else if (tela === 'auditoria')    { carregarLogAlteracoes(); }
    else if (tela === 'competencias') { if (typeof inicializarCompetencias==='function') inicializarCompetencias(); }
    else if (tela === 'programacaoFerias') { if (typeof inicializarProgramacaoFerias==='function') inicializarProgramacaoFerias(); }
  }, 50);
}

// ==========================================
// 🔒 ADMIN RECOLHÍVEL
// ==========================================
function toggleAdmin() {
  document.getElementById('adminLabel')?.classList.toggle('aberto');
  document.getElementById('adminItems')?.classList.toggle('aberto');
}

// ==========================================
// 📋 AUTOCOMPLETES GLOBAIS
// ==========================================
function inicializarAutocompletes() {
  if (!_listas) return;
  const jobs = _listas.jobs || [];

  // formJob — ao selecionar job na Usinagem, preenche descrição automaticamente
  setupAC('formJob', 'formJobList', jobs, val => {
    if (typeof aoSelecionarJob === 'function') aoSelecionarJob(val);
  });

  setupAC('fichaJobInput',        'fichaJobList',        jobs, val => {
    if (typeof buscarFicha === 'function') buscarFicha();
  });
  setupAC('histJob',              'histJobList',         jobs);
  setupAC('prodFormMolde',        'prodFormMoldeList',   jobs);

  // Busca de funcionário na página da Ficha do Funcionário
  const nomesFuncionarios = [...new Set([
    ...(_listas.funcionarios||[]), ...(_listas.funcBancada||[]),
    ...(_listas.funcProjeto||[]), ...(_listas.funcProducao||[]),
    ...(_listas.funcSupervisores||[])
  ])].sort();
  setupAC('fichaFuncNomeInput', 'fichaFuncNomeList', nomesFuncionarios, val => {
    if (typeof carregarFichaFuncionarioPorNome === 'function') carregarFichaFuncionarioPorNome(val);
  });
}

function setupAC(inputId, listaId, dados, onSelect) {
  const input = document.getElementById(inputId);
  const lista = document.getElementById(listaId);
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
      div.onclick = () => { input.value = item; lista.style.display = 'none'; if (onSelect) onSelect(item); };
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
// 🪟 MODAIS
// ==========================================
function abrirModalForm() {
  const o = document.getElementById('modalFormOverlay');
  if (o) { o.classList.add('aberto'); document.body.style.overflow = 'hidden'; }
}
function fecharModalForm() {
  const o = document.getElementById('modalFormOverlay');
  if (o) { o.classList.remove('aberto'); document.body.style.overflow = ''; }
}
function abrirModalFormProd() {
  const o = document.getElementById('modalFormProdOverlay');
  if (o) { o.classList.add('aberto'); document.body.style.overflow = 'hidden'; }
}
function fecharModalFormProd() {
  const o = document.getElementById('modalFormProdOverlay');
  if (o) { o.classList.remove('aberto'); document.body.style.overflow = ''; }
}

// Os modais de lançamento (Usinagem/Bancada/Projeto e Produção) NÃO fecham mais
// ao clicar fora — operadores estavam perdendo informações digitadas ao clicar
// sem querer fora da área do formulário. Fecham só pelo X ou botão Cancelar.

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

// ==========================================
// 🔑 TROCAR SENHA
// ==========================================
function abrirTrocaSenha() {
  const div = document.createElement('div');
  div.id = 'modalTrocaSenhaWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharTrocaSenha()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>🔑 Trocar Senha</h3><button onclick="fecharTrocaSenha()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Senha Atual *</label><input type="password" id="tsSenhaAtual" placeholder="Digite sua senha atual"></div>
      <div class="form-group"><label>Nova Senha *</label><input type="password" id="tsSenhaNova" placeholder="Mínimo 4 caracteres"></div>
      <div class="form-group"><label>Confirmar Nova Senha *</label><input type="password" id="tsSenhaConfirma" placeholder="Repita a nova senha"
        onkeydown="if(event.key==='Enter') salvarTrocaSenha()"></div>
      <div id="tsErro" style="display:none;background:#fee2e2;border:1px solid #fecaca;color:#dc2626;padding:10px 12px;border-radius:8px;font-size:12px;margin-top:6px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" id="btnSalvarTrocaSenha" onclick="salvarTrocaSenha()">💾 Salvar Nova Senha</button>
      <button class="btn-secondary" onclick="fecharTrocaSenha()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('tsSenhaAtual')?.focus(), 50);
}

function fecharTrocaSenha() {
  document.getElementById('modalTrocaSenhaWrap')?.remove();
}

function _mostrarErroTrocaSenha(msg) {
  const el = document.getElementById('tsErro');
  if (el) { el.innerText = msg; el.style.display = 'block'; }
}

async function salvarTrocaSenha() {
  const atual    = document.getElementById('tsSenhaAtual')?.value || '';
  const nova     = document.getElementById('tsSenhaNova')?.value || '';
  const confirma = document.getElementById('tsSenhaConfirma')?.value || '';
  const errEl = document.getElementById('tsErro');
  if (errEl) errEl.style.display = 'none';

  if (!atual || !nova || !confirma) return _mostrarErroTrocaSenha('Preencha todos os campos.');
  if (nova.length < 4) return _mostrarErroTrocaSenha('A nova senha deve ter pelo menos 4 caracteres.');
  if (nova !== confirma) return _mostrarErroTrocaSenha('A nova senha e a confirmação não coincidem.');
  if (!_sessao?.id) return _mostrarErroTrocaSenha('Sessão inválida. Faça login novamente.');

  const btn = document.getElementById('btnSalvarTrocaSenha');
  if (btn) { btn.disabled = true; btn.innerText = 'Salvando...'; }
  try {
    const res = await db.trocarPropriaSenha(_sessao.id, atual, nova);
    if (!res.ok) {
      _mostrarErroTrocaSenha('Senha atual incorreta.');
    } else {
      toast('Senha atualizada com sucesso!', 'sucesso');
      fecharTrocaSenha();
    }
  } catch(e) {
    _mostrarErroTrocaSenha('Erro ao trocar senha. Tente novamente.');
    console.error(e);
  }
  if (btn) { btn.disabled = false; btn.innerText = '💾 Salvar Nova Senha'; }
}
function executarExclusao() {
  const cb = _excluirCallback;
  fecharModalConf();
  if (cb) cb();
}

// ==========================================
// 🔩 MODAL STATUS JOB
// ==========================================
var _jobAtual = null;
var _statusAtual = null;

function abrirModalStatus(job) {
  _jobAtual = job; _statusAtual = null;
  document.getElementById('modalJobNome').innerText = job;
  ['And','Paus','Fin'].forEach(s => { const b=document.getElementById('modalBtn'+s); if(b) b.className='btn-status'; });
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
  ['And','Paus','Fin'].forEach(s => { document.getElementById('modalBtn'+s).className='btn-status'; });
  const btn = document.getElementById('modalBtn'+mapBtn[status]);
  if (btn) btn.className = 'btn-status '+(status==='Finalizado'?'ativo-fin':'ativo-and');
  const conf = document.getElementById('btnConfirmarStatus');
  conf.style.opacity = '1'; conf.style.pointerEvents = 'auto';
  document.getElementById('modalDescWrap').style.display = (status==='Pausado'||status==='Finalizado')?'block':'none';
  document.getElementById('modalDataFimWrap').style.display = status==='Finalizado'?'block':'none';
}
async function confirmarStatus() {
  if (!_jobAtual || !_statusAtual) return;
  const btn = document.getElementById('btnConfirmarStatus');
  btn.disabled = true; btn.innerText = 'Salvando...';
  const desc = document.getElementById('modalDesc').value.trim();
  const dataFim = document.getElementById('modalDataFim').value;
  const job = _jobAtual; const status = _statusAtual;
  fecharModalStatus();
  try {
    await db.salvarStatusJob(job, status, desc, dataFim);
    toast('Status atualizado!','sucesso');
  } catch(e) { toast('Erro ao salvar status.','erro'); }
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
  const dias = new Date(ano,mes+1,0).getDate();
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
  const fDate = d => d.toISOString().split('T')[0];
  document.getElementById('dashIni').value = fDate(new Date(ano,mes-1,1));
  document.getElementById('dashFim').value = fDate(new Date(ano,mes,0));
  carregarDashboard();
}
function mudarTabDash(aba, elBtn) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('ativo'));
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('ativa'));
  document.getElementById('dash'+aba.charAt(0).toUpperCase()+aba.slice(1))?.classList.add('ativo');
  if (elBtn) elBtn.classList.add('ativa');
  renderizarDashAtivo(aba);
}

// ==========================================
// 📱 SIDEBAR
// ==========================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  if (window.innerWidth <= 768) { sidebar.classList.toggle('open'); }
  else { sidebar.classList.toggle('collapsed'); main.classList.toggle('collapsed'); }
}

// ==========================================
// 🛠️ HELPERS GLOBAIS
// ==========================================
function fmtData(d) { return d ? d.split('-').reverse().join('/') : '-'; }
function fmtMin(mins) {
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+'h';
}
function corStatus(s) { return s==='Finalizado'?'#10b981':s==='Pausado'?'#f59e0b':'#f97316'; }
function icoStatus(s) { return s==='Finalizado'?'🟢':s==='Pausado'?'🟡':'🟠'; }

// ==========================================
// 🗂️ ADMIN: STUBS
// ==========================================
function carregarFuncionariosAdmin() { if(typeof carregarFuncionariosRH==='function') carregarFuncionariosRH(); }
function carregarJobsAdmin()      { const el=document.getElementById('listaJobsAdmin');   if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarJobs(); }
function carregarMaquinasAdmin()  { const el=document.getElementById('listaMaquinas');    if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarMaquinasLista(); }
function carregarInjetoras()      { const el=document.getElementById('listaInjetoras');   if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarInjetorasLista(); }
function carregarCategorias()     { const el=document.getElementById('painelCategorias'); if(el) el.innerHTML='<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>'; _carregarCategoriasLista(); }

// ==========================================
// 🗂️ JOBS / MOLDES
// ==========================================
var _todosJobsAdmin = [];

async function _carregarJobs() {
  try {
    const res = await db._get('jobs','order=nome.asc','*');
    _todosJobsAdmin = res || [];
    const el = document.getElementById('listaJobsAdmin');
    if (!el) return;
    const filtroTipo = document.getElementById('filtroTipoJob')?.value || 'todos';
    const busca = (document.getElementById('buscaJobAdmin')?.value||'').toUpperCase();
    const filtrado = _todosJobsAdmin.filter(j => {
      const sv = j.nome.toUpperCase().startsWith('SV')||j.nome.toUpperCase().startsWith('S/');
      if (filtroTipo==='molde' && sv) return false;
      if (filtroTipo==='servico' && !sv) return false;
      if (busca && !j.nome.toUpperCase().includes(busca)) return false;
      return true;
    });
    el.innerHTML = filtrado.map(j => `<div class="lista-item">
      <div class="lista-item-info">
        <div class="lista-item-nome">${j.nome}</div>
        <div class="lista-item-sub">${j.nome.toUpperCase().startsWith('SV')||j.nome.toUpperCase().startsWith('S/')?'Serviço':'Molde'}${j.num_cavidades?' · '+j.num_cavidades+' cavidade'+(j.num_cavidades>1?'s':''):''}</div>
      </div>
      <div class="lista-item-acoes">
        <span class="${j.ativo?'badge-ativo':'badge-inativo'}">${j.ativo?'ATIVO':'INATIVO'}</span>
        <button class="btn-icon" onclick="abrirEdicaoJob(${j.id})">✏️</button>
        <button class="btn-icon danger" onclick="excluirJob(${j.id})">🗑️</button>
      </div>
    </div>`).join('') || '<div class="empty-msg">Nenhum job.</div>';
  } catch(e) { toast('Erro ao carregar jobs.','erro'); }
}
function filtrarJobsAdmin() { _carregarJobs(); }

async function abrirFormJob() {
  const nome = prompt('Nome do Molde / Job (ex: MOL-001 ou SV-001):');
  if (!nome||!nome.trim()) return;
  try {
    const res = await db._post('jobs',{nome:nome.trim(),ativo:true});
    toast('Adicionado!','sucesso');
    if (_listas) _listas.jobs=(_listas.jobs||[]).concat(nome.trim());
    inicializarAutocompletes(); carregarJobsAdmin();
    await registrarLog('jobs', res?.[0]?.id || nome.trim(), 'criar', null, null, nome.trim());
  } catch(e) { toast('Erro.','erro'); }
}

function abrirEdicaoJob(id) {
  const job = _todosJobsAdmin.find(j => j.id === id);
  if (!job) return;
  const div = document.createElement('div');
  div.id = 'modalEditJobWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoJob()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:440px">
    <div class="modal-header"><h3>✏️ Editar Molde/Job</h3><button onclick="fecharEdicaoJob()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nome *</label>
        <input type="text" id="editJobNome" value="${job.nome.replace(/"/g,'&quot;')}">
      </div>
      <div class="form-group">
        <label>Número de Cavidades</label>
        <input type="number" id="editJobCavidades" min="1" value="${job.num_cavidades||''}" placeholder="Ex: 4">
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">Usado no controle de peso e balanceamento (uma medição por cavidade)</div>
      </div>
      <div class="form-group">
        <label class="checkbox-label"><input type="checkbox" id="editJobAtivo" ${job.ativo?'checked':''}> Ativo</label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoJob(${id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoJob()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharEdicaoJob() { document.getElementById('modalEditJobWrap')?.remove(); }

async function salvarEdicaoJob(id) {
  const job = _todosJobsAdmin.find(j => j.id === id);
  const novoNome      = document.getElementById('editJobNome')?.value?.trim();
  const novoAtivo     = document.getElementById('editJobAtivo')?.checked;
  const cavidadesVal  = document.getElementById('editJobCavidades')?.value;
  const novasCavidades = cavidadesVal ? parseInt(cavidadesVal) : null;
  if (!novoNome) return toast('Informe o nome.','erro');
  if (novasCavidades !== null && novasCavidades < 1) return toast('Número de cavidades deve ser pelo menos 1.','erro');
  try {
    await db._patch('jobs', 'id=eq.'+id, { nome: novoNome, ativo: novoAtivo, num_cavidades: novasCavidades });
    if (job.nome !== novoNome) await registrarLog('jobs', id, 'editar', 'nome', job.nome, novoNome);
    if (job.ativo !== novoAtivo) await registrarLog('jobs', id, 'editar', 'ativo', job.ativo?'Ativo':'Inativo', novoAtivo?'Ativo':'Inativo');
    if ((job.num_cavidades||null) !== novasCavidades) await registrarLog('jobs', id, 'editar', 'num_cavidades', job.num_cavidades||'—', novasCavidades||'—');
    toast('Atualizado!','sucesso');
    fecharEdicaoJob();
    if (_listas) { _listas.jobs = (_listas.jobs||[]).map(j => j===job.nome ? novoNome : j); inicializarAutocompletes(); }
    carregarJobsAdmin();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

async function excluirJob(id) {
  const job = _todosJobsAdmin.find(j => j.id === id);
  confirmarExclusao('Remover este job?', async()=>{
    try {
      await db._patch('jobs','id=eq.'+id,{ativo:false});
      await registrarLog('jobs', id, 'excluir', null, job?.nome || id, null);
      toast('Removido!','sucesso'); carregarJobsAdmin();
    } catch(e){ toast('Erro.','erro'); }
  });
}

// ==========================================
// 🤖 MÁQUINAS
// ==========================================
var _todasMaquinasAdmin = [];

async function _carregarMaquinasLista() {
  try {
    const res = await db.listarMaquinas();
    _todasMaquinasAdmin = res || [];
    const el = document.getElementById('listaMaquinas');
    if (!el) return;
    el.innerHTML = _todasMaquinasAdmin.map(m=>`<div class="lista-item">
      <div class="lista-item-info">
        <div class="lista-item-nome">${m.nome} ${(m.tipo==='Secundaria') ? '<span style="font-size:10px;background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:8px;font-weight:700;margin-left:4px">SECUNDÁRIA</span>' : ''}</div>
        <div class="lista-item-sub">Turno: ${m.turno||'ADM'} | Cap: ${m.cap_liquida||508} min/dia</div>
      </div>
      <div class="lista-item-acoes">
        <span class="${m.ativo?'badge-ativo':'badge-inativo'}">${m.ativo?'ATIVO':'INATIVO'}</span>
        <button class="btn-icon" onclick="abrirEdicaoMaquina(${m.id})">✏️</button>
        <button class="btn-icon danger" onclick="excluirMaquinaAdmin(${m.id})">🗑️</button>
      </div>
    </div>`).join('')||'<div class="empty-msg">Nenhuma máquina.</div>';
  } catch(e) { toast('Erro.','erro'); }
}

async function abrirFormMaquina() {
  const nome = prompt('Nome da Máquina:');
  if (!nome||!nome.trim()) return;
  try {
    const res = await db.salvarMaquina({nome:nome.trim(),turno:'ADM',ativo:true});
    toast('Adicionada!','sucesso'); carregarMaquinasAdmin();
    await registrarLog('maquinas', res?.[0]?.id || nome.trim(), 'criar', null, null, nome.trim());
  } catch(e){ toast('Erro.','erro'); }
}

function abrirEdicaoMaquina(id) {
  const m = _todasMaquinasAdmin.find(x => x.id === id);
  if (!m) return;
  const div = document.createElement('div');
  div.id = 'modalEditMaqWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoMaquina()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:440px">
    <div class="modal-header"><h3>✏️ Editar Máquina</h3><button onclick="fecharEdicaoMaquina()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Nome *</label><input type="text" id="editMaqNome" value="${m.nome.replace(/"/g,'&quot;')}"></div>
      <div class="form-group"><label>Turno</label>
        <select id="editMaqTurno">
          ${['5x2','Turma A','Turma B','6x1','Estágio','ADM'].map(t=>`<option value="${t}" ${m.turno===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Capacidade Líquida (min/dia)</label><input type="number" id="editMaqCap" value="${m.cap_liquida||508}"></div>
      <div class="form-group"><label>Tipo</label>
        <select id="editMaqTipo">
          <option value="Principal" ${(m.tipo||'Principal')==='Principal'?'selected':''}>Principal</option>
          <option value="Secundaria" ${m.tipo==='Secundaria'?'selected':''}>Secundária</option>
        </select>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">Secundária não segue meta de ocupação diária — só mede horas de uso no mês</div>
      </div>
      <div class="form-group"><label class="checkbox-label"><input type="checkbox" id="editMaqAtivo" ${m.ativo?'checked':''}> Ativa</label></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoMaquina(${id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoMaquina()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharEdicaoMaquina() { document.getElementById('modalEditMaqWrap')?.remove(); }

async function salvarEdicaoMaquina(id) {
  const m = _todasMaquinasAdmin.find(x => x.id === id);
  const novoNome  = document.getElementById('editMaqNome')?.value?.trim();
  const novoTurno = document.getElementById('editMaqTurno')?.value;
  const novaCap   = parseInt(document.getElementById('editMaqCap')?.value) || 508;
  const novoTipo  = document.getElementById('editMaqTipo')?.value || 'Principal';
  const novoAtivo = document.getElementById('editMaqAtivo')?.checked;
  if (!novoNome) return toast('Informe o nome.','erro');
  try {
    await db.salvarMaquina({ id, nome: novoNome, turno: novoTurno, cap_liquida: novaCap, tipo: novoTipo, ativo: novoAtivo });
    if (m.nome !== novoNome) await registrarLog('maquinas', id, 'editar', 'nome', m.nome, novoNome);
    if (m.turno !== novoTurno) await registrarLog('maquinas', id, 'editar', 'turno', m.turno, novoTurno);
    if (m.cap_liquida !== novaCap) await registrarLog('maquinas', id, 'editar', 'capacidade', m.cap_liquida, novaCap);
    if ((m.tipo||'Principal') !== novoTipo) await registrarLog('maquinas', id, 'editar', 'tipo', m.tipo||'Principal', novoTipo);
    if (m.ativo !== novoAtivo) await registrarLog('maquinas', id, 'editar', 'ativo', m.ativo?'Ativa':'Inativa', novoAtivo?'Ativa':'Inativa');
    toast('Atualizada!','sucesso');
    fecharEdicaoMaquina(); carregarMaquinasAdmin();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

async function excluirMaquinaAdmin(id) {
  const m = _todasMaquinasAdmin.find(x => x.id === id);
  confirmarExclusao('Remover esta máquina?', async()=>{
    try {
      await db.excluirMaquina(id);
      await registrarLog('maquinas', id, 'excluir', null, m?.nome || id, null);
      toast('Removida!','sucesso'); carregarMaquinasAdmin();
    } catch(e){ toast('Erro.','erro'); }
  });
}

// ==========================================
// 🏭 INJETORAS
// ==========================================
var _todasInjetorasAdmin = [];

async function _carregarInjetorasLista() {
  try {
    const res = await db.listarProdInjetoras();
    _todasInjetorasAdmin = res || [];
    const el = document.getElementById('listaInjetoras');
    if (!el) return;
    el.innerHTML = _todasInjetorasAdmin.map(i=>`<div class="lista-item">
      <div class="lista-item-info">
        <div class="lista-item-nome" style="cursor:pointer" onclick="abrirFichaInjetora('${i.nome.replace(/'/g,"\\'")}')">${i.nome}</div>
        <div class="lista-item-sub">${i.tonelagem?i.tonelagem+' ton':'—'} | ${i.fabricante||'—'}</div>
      </div>
      <div class="lista-item-acoes">
        <span class="badge-ativo">ATIVO</span>
        <button class="btn-icon" onclick="abrirEdicaoInjetora(${i.id})">✏️</button>
        <button class="btn-icon danger" onclick="excluirInjetoraAdmin(${i.id})">🗑️</button>
      </div>
    </div>`).join('')||'<div class="empty-msg">Nenhuma injetora.</div>';
  } catch(e){ toast('Erro.','erro'); }
}

async function abrirFormInjetora() {
  const nome = prompt('Nome da Injetora (ex: 160-01):');
  if (!nome||!nome.trim()) return;
  const ton = prompt('Tonelagem (opcional):');
  const fab = prompt('Fabricante (opcional):');
  try {
    const res = await db.salvarProdInjetora({nome:nome.trim(),tonelagem:ton?parseInt(ton):null,fabricante:fab||null});
    toast('Adicionada!','sucesso'); carregarInjetoras();
    await registrarLog('prod_injetoras', res?.[0]?.id || nome.trim(), 'criar', null, null, nome.trim());
  } catch(e){ toast('Erro.','erro'); }
}

function abrirEdicaoInjetora(id) {
  const i = _todasInjetorasAdmin.find(x => x.id === id);
  if (!i) return;
  const div = document.createElement('div');
  div.id = 'modalEditInjWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoInjetora()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:440px">
    <div class="modal-header"><h3>✏️ Editar Injetora</h3><button onclick="fecharEdicaoInjetora()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Nome *</label><input type="text" id="editInjNome" value="${i.nome.replace(/"/g,'&quot;')}"></div>
      <div class="form-group"><label>Tonelagem</label><input type="number" id="editInjTon" value="${i.tonelagem||''}"></div>
      <div class="form-group"><label>Fabricante</label><input type="text" id="editInjFab" value="${i.fabricante||''}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoInjetora(${id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoInjetora()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharEdicaoInjetora() { document.getElementById('modalEditInjWrap')?.remove(); }

async function salvarEdicaoInjetora(id) {
  const i = _todasInjetorasAdmin.find(x => x.id === id);
  const novoNome = document.getElementById('editInjNome')?.value?.trim();
  const novoTon  = document.getElementById('editInjTon')?.value;
  const novoFab  = document.getElementById('editInjFab')?.value?.trim();
  if (!novoNome) return toast('Informe o nome.','erro');
  try {
    await db.salvarProdInjetora({ id, nome: novoNome, tonelagem: novoTon?parseInt(novoTon):null, fabricante: novoFab||null });
    if (i.nome !== novoNome) await registrarLog('prod_injetoras', id, 'editar', 'nome', i.nome, novoNome);
    toast('Atualizada!','sucesso');
    fecharEdicaoInjetora(); carregarInjetoras();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

async function excluirInjetoraAdmin(id) {
  const i = _todasInjetorasAdmin.find(x => x.id === id);
  confirmarExclusao('Remover esta injetora?', async()=>{
    try {
      await db.excluirProdInjetora(id);
      await registrarLog('prod_injetoras', id, 'excluir', null, i?.nome || id, null);
      toast('Removida!','sucesso'); carregarInjetoras();
    } catch(e){ toast('Erro.','erro'); }
  });
}

// ==========================================
// 🏷️ CATEGORIAS
// ==========================================
const _SETORES_CAT = ['Usinagem','Bancada','Projeto','Producao'];
const _CORES_CAT = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', Producao:'#10b981' };
const _ICOS_CAT  = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐', Producao:'🏭' };
var _abaSetorAtiva = 'Usinagem';

async function _carregarCategoriasLista() {
  try {
    const todas = await db.listarProdCategorias();
    const el = document.getElementById('painelCategorias');
    if (!el) return;
    const porSetor = {};
    _SETORES_CAT.forEach(s => porSetor[s] = {});
    (todas||[]).forEach(c => {
      const s = c.setor || 'Producao';
      if (!porSetor[s]) porSetor[s] = {};
      if (!porSetor[s][c.tipo]) porSetor[s][c.tipo] = [];
      porSetor[s][c.tipo].push(c);
    });
    const cor = _CORES_CAT[_abaSetorAtiva];
    const grupos = porSetor[_abaSetorAtiva] || {};
    const total  = Object.values(grupos).flat().length;

    let html = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
      ${_SETORES_CAT.map(s => {
        const t = Object.values(porSetor[s]||{}).flat().length;
        const ativo = s === _abaSetorAtiva;
        const c = _CORES_CAT[s];
        return `<button onclick="_mudarAbaCategoria('${s}')"
          style="padding:8px 18px;border-radius:20px;border:2px solid ${ativo?c:'#e2e8f0'};
          background:${ativo?c:'#fff'};color:${ativo?'#fff':c};font-weight:700;font-size:13px;
          cursor:pointer;transition:all 0.2s">
          ${_ICOS_CAT[s]} ${s}
          <span style="background:${ativo?'rgba(255,255,255,0.3)':'#f1f5f9'};padding:2px 7px;border-radius:10px;font-size:11px">${t}</span>
        </button>`;
      }).join('')}
    </div>`;

    html += `<div class="card" style="border-left:4px solid ${cor};margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e3a5f">${_ICOS_CAT[_abaSetorAtiva]} ${_abaSetorAtiva}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${total} tipo(s) cadastrado(s)</div>
        </div>
        <button class="btn-primary" onclick="abrirModalCategoria()">+ Nova Categoria</button>
      </div>
    </div>`;

    if (!Object.keys(grupos).length) {
      html += `<div class="empty-state">
        <div style="font-size:40px">${_ICOS_CAT[_abaSetorAtiva]}</div>
        <div>Nenhuma categoria para ${_abaSetorAtiva}.</div>
        <div style="margin-top:12px"><button class="btn-primary" onclick="abrirModalCategoria()">+ Adicionar primeira categoria</button></div>
      </div>`;
    } else {
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">`;
      Object.entries(grupos).forEach(([tipo, cats]) => {
        const tipoEsc = tipo.replace(/'/g,"\\'");
        html += `<div class="card" style="border-top:3px solid ${cor}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--borda)">
            <span style="background:${cor}15;color:${cor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700">${tipo} (${cats.length})</span>
            <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="abrirModalCategoria('${tipoEsc}')">+ Atividade</button>
          </div>
          ${cats.map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px dashed #f1f5f9">
              <span style="font-size:13px;color:#334155">• ${c.atividade}</span>
              <div style="display:flex;gap:4px">
                <button class="btn-icon" onclick="editarCategoria(${c.id},'${c.atividade.replace(/'/g,"\\'")}')">✏️</button>
                <button class="btn-icon danger" onclick="excluirCategoria(${c.id})">🗑️</button>
              </div>
            </div>`).join('')}
        </div>`;
      });
      html += `</div>`;
    }
    html += `<div id="modalCatWrap"></div>`;
    el.innerHTML = html;
  } catch(e) { toast('Erro ao carregar categorias.','erro'); console.error(e); }
}

function _mudarAbaCategoria(setor) { _abaSetorAtiva = setor; carregarCategorias(); }

function abrirModalCategoria(tipoPre) {
  const tiposExistentes = _listas?.todasCategorias
    ? [...new Set(_listas.todasCategorias.filter(c=>c.setor===_abaSetorAtiva).map(c=>c.tipo))]
    : [];
  document.getElementById('modalCatWrap').innerHTML = `
  <div class="modal-overlay" onclick="fecharModalCategoria()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px">
    <div class="modal-header">
      <h3>+ Nova Categoria — ${_ICOS_CAT[_abaSetorAtiva]} ${_abaSetorAtiva}</h3>
      <button onclick="fecharModalCategoria()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Grupo / Tipo *</label>
        <select id="catTipoSel" onchange="
          const v=this.value;
          document.getElementById('catTipoNovoWrap').style.display=v==='__novo'?'block':'none';
          if(v!=='__novo') document.getElementById('catTipoInput').value=v;
        ">
          <option value="">— Selecione grupo existente —</option>
          ${tiposExistentes.map(t=>`<option value="${t}" ${t===tipoPre?'selected':''}>${t}</option>`).join('')}
          <option value="__novo">+ Criar novo grupo...</option>
        </select>
        <div id="catTipoNovoWrap" style="display:${tipoPre&&!tiposExistentes.includes(tipoPre)?'block':'none'};margin-top:8px">
          <input type="text" id="catTipoInput" placeholder="Nome do novo grupo..." value="${tipoPre||''}">
        </div>
      </div>
      <div class="form-group">
        <label>Atividade / Serviço *</label>
        <input type="text" id="catAtivInput" placeholder="Ex: Troca de copo, Retífica plana...">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarCategoria()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalCategoria()">Cancelar</button>
    </div>
  </div>`;
  if (tipoPre && tiposExistentes.includes(tipoPre)) {
    const sel = document.getElementById('catTipoSel');
    for (let i=0;i<sel.options.length;i++) if(sel.options[i].value===tipoPre){sel.selectedIndex=i;break;}
    document.getElementById('catTipoInput').value = tipoPre;
  }
}

function fecharModalCategoria() {
  const w = document.getElementById('modalCatWrap');
  if (w) w.innerHTML = '';
}

async function salvarCategoria() {
  const sel  = document.getElementById('catTipoSel');
  const isNovo = sel?.value === '__novo';
  const tipo = isNovo
    ? document.getElementById('catTipoInput')?.value?.trim()
    : (document.getElementById('catTipoInput')?.value?.trim() || sel?.value);
  const ativ = document.getElementById('catAtivInput')?.value?.trim();
  if (!tipo) return toast('Informe o grupo/tipo.','erro');
  if (!ativ) return toast('Informe a atividade.','erro');
  try {
    const res = await db.salvarProdCategoria({ tipo, atividade:ativ, setor:_abaSetorAtiva, ativo:true });
    await registrarLog('prod_categorias', res?.[0]?.id || ativ, 'criar', null, null, `${_abaSetorAtiva} / ${tipo} / ${ativ}`);
    toast('Categoria adicionada!','sucesso');
    fecharModalCategoria();
    const cats = await db.listarProdCategorias();
    if (_listas) {
      _listas.todasCategorias = cats;
      _listas.tipos        = [...new Set(cats.filter(c=>c.setor==='Usinagem').map(c=>c.atividade))];
      _listas.tiposBancada = [...new Set(cats.filter(c=>c.setor==='Bancada').map(c=>c.atividade))];
      _listas.areasProj    = [...new Set(cats.filter(c=>c.setor==='Projeto').map(c=>c.tipo))];
      _listas.categoriasProj=[...new Set(cats.filter(c=>c.setor==='Projeto').map(c=>c.atividade))];
      _listas.mapaBancada  = {};
      cats.filter(c=>c.setor==='Bancada').forEach(c=>{_listas.mapaBancada[c.atividade]=c.tipo||c.atividade;});
      inicializarAutocompletes();
    }
    carregarCategorias();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

async function editarCategoria(id, ativAtual) {
  const ativ = prompt('Renomear atividade:', ativAtual);
  if (!ativ||!ativ.trim()||ativ.trim()===ativAtual) return;
  try {
    await db._patch('prod_categorias','id=eq.'+id,{atividade:ativ.trim()});
    toast('Atualizado!','sucesso'); carregarCategorias();
  } catch(e){ toast('Erro.','erro'); }
}

async function excluirCategoria(id) {
  confirmarExclusao('Remover esta categoria?', async()=>{
    try {
      await db.excluirProdCategoria(id);
      await registrarLog('prod_categorias', id, 'excluir', null, 'Categoria #'+id, null);
      toast('Removida!','sucesso'); carregarCategorias();
    }
    catch(e){ toast('Erro.','erro'); }
  });
}

async function adicionarCategoria(tipo) { abrirModalCategoria(tipo); }
async function criarNovoGrupoCategoria() { abrirModalCategoria(); }
