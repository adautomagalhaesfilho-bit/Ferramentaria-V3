// ==========================================
// 👤 USUARIOS.JS
// ==========================================

var _editandoUserId = null;

async function carregarUsuarios() {
  const tbody = document.getElementById('tbodyUsuarios');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Carregando...</td></tr>';
  try {
    const res = await db.listarUsuarios();
    tbody.innerHTML = res.length ? res.map(u => `<tr>
      <td><b>${u.nome}</b></td>
      <td><span style="background:#e8f0fe;color:#0056b3;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600">${u.perfil}</span></td>
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
  const perfis = ['operador','supervisor','gestor','admin'];
  const setores = ['','Usinagem','Bancada','Projeto','Producao'];
  const el = document.getElementById('formUsuario');
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <h3 style="color:#1e3a5f">${user?'Editar':'Novo'} Usuário</h3>
    <button class="btn-secondary" onclick="fecharFormUsuario()">← Cancelar</button>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Nome de Usuário *</label><input type="text" id="uNome" value="${user?.nome||''}" placeholder="Ex: João Silva"></div>
    <div class="form-group"><label>Senha *</label><input type="text" id="uSenha" value="${user?.senha||''}" placeholder="Ex: Senha@123"></div>
    <div class="form-group"><label>Perfil *</label><select id="uPerfil">${perfis.map(p=>`<option value="${p}" ${user?.perfil===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Setor</label><select id="uSetor">${setores.map(s=>`<option value="${s}" ${user?.setor===s?'selected':''}>${s||'Nenhum'}</option>`).join('')}</select></div>
  </div>
  <div class="form-row" style="align-items:center">
    <label class="checkbox-label"><input type="checkbox" id="uAtivo" ${user?.ativo!==false?'checked':''}> Usuário Ativo</label>
  </div>
  <button class="btn-primary" style="margin-top:16px" onclick="salvarUsuario()">💾 Salvar Usuário</button>`;
  el.style.display = 'block';
  el.scrollIntoView({ behavior:'smooth' });
}

function fecharFormUsuario() {
  document.getElementById('formUsuario').style.display = 'none';
  _editandoUserId = null;
}

function editarUsuario(u) { abrirFormUsuario(u); }

async function salvarUsuario() {
  const nome  = document.getElementById('uNome').value.trim();
  const senha = document.getElementById('uSenha').value.trim();
  if (!nome||!senha) return toast('Preencha nome e senha.','erro');
  const dados = {
    nome, senha,
    perfil:  document.getElementById('uPerfil').value,
    setor:   document.getElementById('uSetor').value || null,
    ativo:   document.getElementById('uAtivo').checked
  };
  if (_editandoUserId) dados.id = _editandoUserId;
  try {
    await db.salvarUsuario(dados);
    toast(_editandoUserId?'Usuário atualizado!':'Usuário criado!','sucesso');
    fecharFormUsuario();
    carregarUsuarios();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

async function excluirUsuario(id) {
  try { await db.excluirUsuario(id); toast('Usuário removido!','sucesso'); carregarUsuarios(); }
  catch(e) { toast('Erro ao excluir.','erro'); }
}
