// ==========================================
// 🔐 AUTH.JS — Autenticação e Sessão
// ==========================================

var _sessao = null;
var _listas = null;

function getSessao() { return _sessao; }
function getListas()  { return _listas;  }

function podeEditar()    { return _sessao && ['supervisor','gestor','admin'].includes(_sessao.perfil); }
function podeVerDash()   { return _sessao && ['supervisor','gestor','admin'].includes(_sessao.perfil); }
function podeVerRH()     { return _sessao && ['gestor','admin'].includes(_sessao.perfil); }
function podeVerMoldes() { return _sessao && ['supervisor','gestor','admin'].includes(_sessao.perfil); }
function isAdmin()       { return _sessao && _sessao.perfil === 'admin'; }

function fazerLogout() {
  sessionStorage.removeItem('ferramentaria_user');
  window.location.href = 'index.html';
}

function carregarSessao() {
  const dados = sessionStorage.getItem('ferramentaria_user');
  if (!dados) { window.location.href = 'index.html'; return false; }
  try {
    _sessao = JSON.parse(dados);
    return true;
  } catch(e) {
    window.location.href = 'index.html';
    return false;
  }
}

function aplicarPermissoes() {
  if (!_sessao) return;
  const p = _sessao.perfil;
  const s = _sessao.setor || '';

  // Avatar e nome
  const avatares = { operador:'👷', supervisor:'👨‍🔧', gestor:'🏢', admin:'⚙️' };
  document.getElementById('userAvatar').innerText  = avatares[p] || '👤';
  document.getElementById('userNome').innerText    = _sessao.nome;
  document.getElementById('userPerfil').innerText  = p.charAt(0).toUpperCase() + p.slice(1) + (s ? ' · ' + s : '');

  // Menus visíveis
  const menus = {
    menuDashboard: podeVerDash(),
    menuUsinagem:  p==='admin' || p==='gestor' || (p==='supervisor'&&s==='Usinagem') || (p==='operador'&&s==='Usinagem'),
    menuBancada:   p==='admin' || p==='gestor' || (p==='supervisor'&&s==='Bancada')  || (p==='operador'&&s==='Bancada'),
    menuProjeto:   p==='admin' || p==='gestor' || (p==='supervisor'&&s==='Projeto')  || (p==='operador'&&s==='Projeto'),
    menuProducao:  p==='admin' || p==='gestor' || s==='Producao',
    menuMoldes:    podeVerMoldes(),
    menuFicha:     p !== 'operador',
    menuHistorico: p !== 'operador',
    menuRH:        podeVerRH() || p==='supervisor',
    menuUsuarios:  isAdmin(),
  };

  Object.entries(menus).forEach(([id, visivel]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visivel ? '' : 'none';
  });

  // Redireciona após login
  if (p === 'operador') {
    const setorMap = { Usinagem: 'usinagem', Bancada: 'bancada', Projeto: 'projeto', Producao: 'producao' };
    const dest = setorMap[s] || 'usinagem';
    irPara(dest, document.getElementById('menu' + (s||'Usinagem')));
  } else {
    irPara('dashboard', document.getElementById('menuDashboard'));
  }
}
