// ==========================================
// 🔐 AUTH.JS — Autenticação e Sessão V3
// ==========================================

var _sessao = null;
var _listas = null;

function getSessao()    { return _sessao; }
function getListas()    { return _listas; }

// Verifica permissão individual (usa permissoes salvas ou fallback por perfil)
function _temPermissao(key) {
  if (!_sessao) return false;
  // Admin sempre tem tudo
  if (_sessao.perfil === 'admin') return true;
  // Verifica permissões customizadas salvas no usuário
  if (_sessao.permissoes && _sessao.permissoes[key] !== undefined) {
    return !!_sessao.permissoes[key];
  }
  // Fallback: permissões padrão por perfil
  const _PERM_PADRAO = {
    dashboard:  ['supervisor','pcm','gestor','admin'],
    usinagem:   ['operador','tecnico','supervisor','gestor','admin'],
    bancada:    ['operador','tecnico','supervisor','gestor','admin'],
    projeto:    ['operador','tecnico','supervisor','gestor','admin'],
    producao:   ['operador','tecnico','supervisor','gestor','admin'],
    moldes:     ['supervisor','pcm','gestor','admin'],
    ficha:      ['tecnico','supervisor','pcm','gestor','admin'],
    historico:  ['supervisor','pcm','gestor','admin'],
    pcm:        ['pcm','gestor','admin'],
    rh:         ['gestor','admin'],
    admin:      ['admin'],
    editar:     ['supervisor','gestor','admin'],
    competencias: ['supervisor','gestor','admin'],
    intervencoes: ['supervisor','gestor','pcm','admin'],
  };
  return !!_PERM_PADRAO[key]?.includes(_sessao.perfil);
}

// Funções de conveniência usadas em outros módulos
function podeEditar()     { return _temPermissao('editar'); }
function podeVerDash()    { return _temPermissao('dashboard'); }
function podeVerRH()      { return _temPermissao('rh'); }
function podeVerMoldes()  { return _temPermissao('moldes'); }
function isAdmin()        { return _sessao?.perfil === 'admin'; }
function isPCM()          { return _sessao?.perfil === 'pcm' || isAdmin(); }

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
  const avatares = {
    operador:'👷', tecnico:'🔧', supervisor:'👨‍🔧',
    pcm:'🗂️', gestor:'🏢', admin:'⚙️'
  };
  document.getElementById('userAvatar').innerText = avatares[p] || '👤';
  document.getElementById('userNome').innerText   = _sessao.nome;
  document.getElementById('userPerfil').innerText =
    (p.charAt(0).toUpperCase() + p.slice(1)) + (s ? ' · ' + s : '');

  // Menus: visibilidade baseada em permissões customizadas
  const menus = {
    menuDashboard:    _temPermissao('dashboard'),
    menuUsinagem:     _temPermissao('usinagem') && (p!=='operador' || s==='Usinagem'),
    menuBancada:      _temPermissao('bancada')  && (p!=='operador' || s==='Bancada'),
    menuProjeto:      _temPermissao('projeto')  && (p!=='operador' || s==='Projeto'),
    menuProducao:     _temPermissao('producao') && (p!=='operador' || s==='Producao'),
    // menuMoldes removido — tela de moldes descontinuada
    menuFicha:        _temPermissao('ficha'),
    menuHistorico:    _temPermissao('historico'),
    menuPCM:          _temPermissao('pcm'),
    menuFuncionarios: _temPermissao('rh') || _temPermissao('admin'),
    menuFichaFuncionario: _temPermissao('rh') || _temPermissao('admin'),
    menuCompetencias: _temPermissao('competencias'),
    menuJobsAdmin:    _temPermissao('admin'),
    menuMaquinasAdmin:_temPermissao('admin'),
    menuInjetoras:    _temPermissao('admin'),
    menuCategorias:   _temPermissao('admin'),
    menuFeriados:     _temPermissao('rh') || _temPermissao('admin'),
    menuProgramacaoFerias: _temPermissao('rh') || _temPermissao('admin'),
    menuUsuarios:     isAdmin(),
    menuAuditoria:    isAdmin(),
    adminSection:     _temPermissao('admin') || _temPermissao('rh') || _temPermissao('competencias'),
  };

  Object.entries(menus).forEach(([id, visivel]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visivel ? '' : 'none';
  });

  // Redireciona após login
  if (_temPermissao('dashboard')) {
    irPara('dashboard', document.getElementById('menuDashboard'));
  } else if (_temPermissao('pcm')) {
    irPara('pcm', document.getElementById('menuPCM'));
  } else {
    // Vai direto para o setor do operador/técnico
    const setorMap = {
      Usinagem:'usinagem', Bancada:'bancada',
      Projeto:'projeto', Producao:'producao', PCM:'pcm'
    };
    const dest = setorMap[s] || 'usinagem';
    irPara(dest, document.getElementById('menu' + (s||'Usinagem')));
  }
}
