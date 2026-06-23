// ==========================================
// 🚀 APP.JS — Inicialização e Navegação
// ==========================================

var _telaAtual = null;
var _excluirCallback = null;

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  if (!carregarSessao()) return;

  // Data na topbar
  const hoje = new Date();
  const diasSem = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  document.getElementById('topbarData').innerText =
    diasSem[hoje.getDay()] + ', ' + hoje.toLocaleDateString('pt-BR');

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

  // Inicializa datas do dashboard
  const fDate = d => d.toISOString().split('T')[0];
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  document.getElementById('dashIni').value = fDate(ini);
  document.getElementById('dashFim').value = fDate(hoje);
  document.getElementById('dashMes').value =
    hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
});

// ==========================================
// 🧭 NAVEGAÇÃO
// ==========================================
function irPara(tela, elMenu) {
  // Esconde todas as telas
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

  // Mapa tela → elemento HTML
  const mapa = {
    dashboard: 'telaDashboard',
    usinagem:  'telaApontamentos',
    bancada:   'telaApontamentos',
    projeto:   'telaApontamentos',
    producao:  'telaProducao',
    moldes:    'telaMoldes',
    ficha:     'telaFicha',
    historico: 'telaHistorico',
    rh:        'telaRH',
    usuarios:  'telaUsuarios',
  };

  const titulos = {
    dashboard: 'BI / Dashboard',
    usinagem:  'Usinagem',
    bancada:   'Bancada',
    projeto:   'Projeto',
    producao:  'Produção / Setup',
    moldes:    'Gestão de Moldes',
    ficha:     'Ficha do Molde',
    historico: 'Histórico',
    rh:        'Gestão e RH',
    usuarios:  'Usuários',
  };

  _telaAtual = tela;
  const idTela = mapa[tela];
  if (idTela) document.getElementById(idTela)?.classList.add('ativa');
  if (elMenu) elMenu.classList.add('active');

  document.getElementById('topbarTitulo').innerText = titulos[tela] || tela;

  // Fechar sidebar no mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('overlayMobile')?.classList.remove('active');
  }

  // Ações automáticas ao navegar
  setTimeout(() => {
    if (tela === 'usinagem' || tela === 'bancada' || tela === 'projeto') {
      abrirSetor(tela);
    } else if (tela === 'producao') {
      inicializarProducao();
    } else if (tela === 'dashboard') {
      carregarDashboard();
    } else if (tela === 'moldes') {
      carregarMoldes();
    } else if (tela === 'historico') {
      inicializarHistorico();
    } else if (tela === 'rh') {
      inicializarRH();
    } else if (tela === 'usuarios') {
      carregarUsuarios();
    }
  }, 50);
}

// ==========================================
// 📋 AUTOCOMPLETES GLOBAIS
// ==========================================
function inicializarAutocompletes() {
  if (!_listas) return;
  const jobs = _listas.jobs || [];
  setupAC('formJob', 'formJobList', jobs);
  setupAC('fichaJobInput', 'fichaJobList', jobs);
  setupAC('histJob', 'histJobList', jobs);
  setupAC('prodFormMolde', 'prodFormMoldeList', jobs);
  setupAC('formTipoBancadaInput', 'formTipoBancadaList', _listas.tiposBancada || [], val => {
    document.getElementById('formTipoBancada').value = val;
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
    if (btn) { btn.style.borderColor = ''; btn.style.background = ''; btn.className = 'btn-status'; }
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
  ['And','Paus','Fin'].forEach(s => {
    const btn = document.getElementById('modalBtn' + s);
    if (btn) btn.className = 'btn-status';
  });
  const btn = document.getElementById('modalBtn' + mapBtn[status]);
  if (btn) btn.className = 'btn-status ' + (status==='Finalizado' ? 'ativo-fin' : 'ativo-and');
  const conf = document.getElementById('btnConfirmarStatus');
  conf.style.opacity = '1'; conf.style.pointerEvents = 'auto';
  document.getElementById('modalDescWrap').style.display = (status==='Pausado'||status==='Finalizado') ? 'block' : 'none';
  document.getElementById('modalDataFimWrap').style.display = status==='Finalizado' ? 'block' : 'none';
}

async function confirmarStatus() {
  if (!_jobAtual || !_statusAtual) return;
  const btn = document.getElementById('btnConfirmarStatus');
  btn.disabled = true; btn.innerText = 'Salvando...';
  const desc   = document.getElementById('modalDesc').value.trim();
  const dataFim = document.getElementById('modalDataFim').value;
  const job = _jobAtual; const status = _statusAtual;
  fecharModalStatus();
  try {
    await db.salvarStatusJob(job, status, desc, dataFim);
    toast('Status atualizado!', 'sucesso');
    if (typeof carregarMoldes === 'function') await carregarMoldes();
  } catch(e) {
    toast('Erro ao salvar status.', 'erro');
  }
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
  const ranges = {
    1: [1,7], 2: [8,14], 3: [15,21], 4: [22, new Date(ano,mes+1,0).getDate()]
  };
  const [d1, d2] = ranges[n];
  const fDate = d => new Date(ano,mes,d).toISOString().split('T')[0];
  document.getElementById('dashIni').value = fDate(d1);
  document.getElementById('dashFim').value = fDate(d2);
  carregarDashboard();
}

function selecionarMesDash() {
  const val = document.getElementById('dashMes').value;
  if (!val) return;
  const [ano, mes] = val.split('-').map(Number);
  const ini = new Date(ano, mes-1, 1);
  const fim = new Date(ano, mes, 0);
  const fDate = d => d.toISOString().split('T')[0];
  document.getElementById('dashIni').value = fDate(ini);
  document.getElementById('dashFim').value = fDate(fim);
  carregarDashboard();
}

function mudarTabDash(aba, elBtn) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('ativo'));
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('ativa'));
  document.getElementById('dash' + aba.charAt(0).toUpperCase() + aba.slice(1))?.classList.add('ativo');
  if (elBtn) elBtn.classList.add('ativa');
  renderizarDashAtivo(aba);
}

// ==========================================
// 📱 SIDEBAR MOBILE
// ==========================================
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlayMobile');
  const main     = document.getElementById('main');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('collapsed');
  }
  if (overlay) overlay.classList.toggle('active');
}

// ==========================================
// 🛠️ HELPERS
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
  return s === 'Finalizado' ? '#10b981' : s === 'Pausado' ? '#f59e0b' : '#f97316';
}
function icoStatus(s) {
  return s === 'Finalizado' ? '🟢' : s === 'Pausado' ? '🟡' : '🟠';
}
