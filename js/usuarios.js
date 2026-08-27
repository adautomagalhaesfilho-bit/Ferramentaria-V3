// ==========================================
// 👤 USUARIOS.JS — Com Permissões V3
// ==========================================

var _editandoUserId = null;

// ==========================================
// PERFIS E PERMISSÕES
// ==========================================
// operador    → só vê e lança no próprio setor
// tecnico     → lança em qualquer setor mas sem admin
// supervisor  → vê dashboard, moldes, histórico, edita lançamentos
// pcm         → acesso ao módulo PCM + ficha + moldes
// gestor      → tudo exceto usuários
// admin       → acesso total

const _PERFIS = ['operador','tecnico','supervisor','pcm','gestor','admin'];

const _SETORES = [
  '', 'Usinagem', 'Bancada', 'Projeto', 'Producao', 'PCM', 'Supervisão'
];

// Mapa de permissões por perfil
// Cada chave é um menu/funcionalidade; valor = perfis que TÊM acesso
const _PERMISSOES_PADRAO = {
  dashboard:    ['supervisor','pcm','gestor','admin'],
  usinagem:     ['operador','tecnico','supervisor','gestor','admin'],
  bancada:      ['operador','tecnico','supervisor','gestor','admin'],
  projeto:      ['operador','tecnico','supervisor','gestor','admin'],
  producao:     ['operador','tecnico','supervisor','gestor','admin'],
  moldes:       ['supervisor','pcm','gestor','admin'],
  ficha:        ['tecnico','supervisor','pcm','gestor','admin'],
  historico:    ['supervisor','pcm','gestor','admin'],
  pcm:          ['pcm','gestor','admin'],
  rh:           ['gestor','admin'],
  admin:        ['admin'],
  editar:       ['supervisor','gestor','admin'],
  competencias: ['supervisor','gestor','admin'],
  intervencoes: ['supervisor','gestor','pcm','admin'],
};

async function carregarUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Carregando...</td></tr>';
  try {
    const res = await db.listarUsuarios();
    tbody.innerHTML = res.length ? res.map(u => `<tr>
      <td><b>${u.nome}</b></td>
      <td><span style="background:${_corPerfil(u.perfil)}20;color:${_corPerfil(u.perfil)};padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600">${_labelPerfil(u.perfil)}</span></td>
      <td>${u.setor||'—'}</td>
      <td><span style="background:${u.ativo?'#d1fae5':'#fee2e2'};color:${u.ativo?'#059669':'#b91c1c'};padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600">${u.ativo?'Ativo':'Inativo'}</span></td>
      <td>
        <button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarUsuario(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="confirmarExclusao('Excluir usuário ${u.nome}?',()=>excluirUsuario(${u.id}))">🗑️</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty-msg">Nenhum usuário.</td></tr>';
  } catch(e) { tbody.innerHTML='<tr><td colspan="5" class="empty-msg">Erro ao carregar.</td></tr>'; }
}

function abrirFormUsuario(user) {
  _editandoUserId = user?.id || null;
  const perms = user?.permissoes || {};
  const el = document.getElementById('formUsuario');

  // Monta checkboxes de permissões por funcionalidade
  const permItems = [
    { key:'dashboard',  label:'📊 Dashboard / BI' },
    { key:'usinagem',   label:'⚙️ Usinagem' },
    { key:'bancada',    label:'🛠️ Bancada' },
    { key:'projeto',    label:'📐 Projeto' },
    { key:'producao',   label:'🏭 Produção / Setup' },
    { key:'moldes',     label:'🔩 Gestão de Moldes' },
    { key:'ficha',      label:'📄 Ficha do Molde' },
    { key:'historico',  label:'🔎 Histórico' },
    { key:'pcm',        label:'🗂️ PCM' },
    { key:'rh',         label:'👥 RH / Feriados' },
    { key:'admin',      label:'⚙️ Administração' },
    { key:'editar',     label:'✏️ Pode Editar/Excluir Lançamentos' },
    { key:'competencias', label:'🎯 Matriz de Competência' },
    { key:'intervencoes', label:'📝 Registrar Intervenções' },
  ];

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3 style="color:#1e3a5f;font-size:16px">${user?'Editar':'Novo'} Usuário</h3>
      <button class="btn-secondary" onclick="fecharFormUsuario()">← Cancelar</button>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Nome de Usuário *</label>
        <input type="text" id="uNome" value="${user?.nome||''}" placeholder="Ex: João Silva">
      </div>
      <div class="form-group">
        <label>Senha ${user?'':'*'}</label>
        <input type="text" id="uSenha" value="" placeholder="${user?'Deixe em branco para manter a senha atual':'Ex: Senha@123'}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>Perfil *</label>
        <select id="uPerfil" onchange="aplicarPermissoesPadrao()">
          ${_PERFIS.map(p=>`<option value="${p}" ${user?.perfil===p?'selected':''}>${_labelPerfil(p)}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:#64748b;margin-top:4px" id="descPerfil">${_descPerfil(user?.perfil||'operador')}</div>
      </div>
      <div class="form-group">
        <label>Setor Principal</label>
        <select id="uSetor">
          ${_SETORES.map(s=>`<option value="${s}" ${user?.setor===s?'selected':''}>${s||'Nenhum (todos)'}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- PERMISSÕES POR FUNCIONALIDADE -->
    <div style="border:1px solid var(--borda);border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--azul);letter-spacing:1px;text-transform:uppercase">🔐 Permissões de Acesso</div>
        <button type="button" class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="aplicarPermissoesPadrao()">↺ Aplicar Padrão do Perfil</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">
        ${permItems.map(item => {
          // Valor padrão: usa permissão salva ou calcula pelo perfil
          const perfilAtual = user?.perfil || 'operador';
          const temAcesso = perms[item.key] !== undefined
            ? perms[item.key]
            : _PERMISSOES_PADRAO[item.key]?.includes(perfilAtual);
          return `<label class="checkbox-label" style="background:#f8fafc;border:1px solid var(--borda);border-radius:8px;padding:8px 12px;font-size:12px;font-weight:500">
            <input type="checkbox" id="perm_${item.key}" ${temAcesso?'checked':''}>
            ${item.label}
          </label>`;
        }).join('')}
      </div>
    </div>

    <div class="form-row" style="align-items:center">
      <label class="checkbox-label">
        <input type="checkbox" id="uAtivo" ${user?.ativo!==false?'checked':''}> Usuário Ativo
      </label>
    </div>

    <button class="btn-primary" style="margin-top:16px;width:100%;padding:14px;font-size:15px" onclick="salvarUsuario()">
      💾 Salvar Usuário
    </button>`;

  el.style.display = 'block';
  el.scrollIntoView({ behavior:'smooth' });

  // Atualiza desc do perfil ao mudar
  document.getElementById('uPerfil').addEventListener('change', function() {
    document.getElementById('descPerfil').innerText = _descPerfil(this.value);
  });
}

function aplicarPermissoesPadrao() {
  const perfil = document.getElementById('uPerfil')?.value || 'operador';
  document.getElementById('descPerfil').innerText = _descPerfil(perfil);
  const permItems = ['dashboard','usinagem','bancada','projeto','producao','moldes','ficha','historico','pcm','rh','admin','editar','competencias','intervencoes'];
  permItems.forEach(key => {
    const el = document.getElementById('perm_' + key);
    if (el) el.checked = !!_PERMISSOES_PADRAO[key]?.includes(perfil);
  });
}

function fecharFormUsuario() {
  document.getElementById('formUsuario').style.display = 'none';
  _editandoUserId = null;
}

function editarUsuario(u) { abrirFormUsuario(u); }

async function salvarUsuario() {
  const nome  = document.getElementById('uNome')?.value.trim();
  const senha = document.getElementById('uSenha')?.value.trim();
  const isEdicao = !!_editandoUserId;
  if (!nome) return toast('Preencha o nome.','erro');
  if (!isEdicao && !senha) return toast('Preencha a senha do novo usuário.','erro');

  // Coleta permissões
  const permItems = ['dashboard','usinagem','bancada','projeto','producao','moldes','ficha','historico','pcm','rh','admin','editar','competencias','intervencoes'];
  const permissoes = {};
  permItems.forEach(key => {
    const el = document.getElementById('perm_' + key);
    if (el) permissoes[key] = el.checked;
  });

  const dados = {
    nome,
    perfil:     document.getElementById('uPerfil').value,
    setor:      document.getElementById('uSetor').value || null,
    ativo:      document.getElementById('uAtivo').checked,
    permissoes: permissoes
  };
  // Só manda a senha se foi preenchida — em branco na edição significa "manter a atual"
  if (senha) dados.senha = senha;
  if (isEdicao) dados.id = _editandoUserId;

  try {
    const res = await db.salvarUsuario(dados);
    const idLog = isEdicao ? _editandoUserId : (res?.[0]?.id || nome);
    if (typeof registrarLog === 'function') {
      await registrarLog('usuarios', idLog, isEdicao ? 'editar' : 'criar', isEdicao ? 'dados' : null,
        isEdicao ? 'Atualização de usuário' : null, `${nome} (${dados.perfil})`);
    }
    toast(isEdicao ? 'Usuário atualizado!' : 'Usuário criado!', 'sucesso');
    fecharFormUsuario();
    carregarUsuarios();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

async function excluirUsuario(id) {
  try {
    await db.excluirUsuario(id);
    if (typeof registrarLog === 'function') await registrarLog('usuarios', id, 'excluir', null, 'Usuário #'+id, null);
    toast('Usuário removido!','sucesso');
    carregarUsuarios();
  } catch(e) { toast('Erro ao excluir.','erro'); }
}

// ==========================================
// HELPERS DE PERFIL
// ==========================================
function _labelPerfil(p) {
  const map = {
    operador:'Operador', tecnico:'Técnico', supervisor:'Supervisor',
    pcm:'PCM', gestor:'Gestor', admin:'Administrador'
  };
  return map[p] || p;
}

function _corPerfil(p) {
  const map = {
    operador:'#64748b', tecnico:'#0891b2', supervisor:'#8b5cf6',
    pcm:'#f59e0b', gestor:'#10b981', admin:'#ef4444'
  };
  return map[p] || '#64748b';
}

function _descPerfil(p) {
  const map = {
    operador:   'Acessa apenas o setor vinculado. Só lança apontamentos.',
    tecnico:    'Lança em qualquer setor. Sem acesso a relatórios ou admin.',
    supervisor: 'Vê dashboard, moldes e histórico. Pode editar lançamentos.',
    pcm:        'Acessa PCM, ficha do molde e gestão de moldes.',
    gestor:     'Acesso completo exceto gestão de usuários.',
    admin:      'Acesso total ao sistema.',
  };
  return map[p] || '';
}
