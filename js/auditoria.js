// ==========================================
// 📜 AUDITORIA.JS — Log de Alterações Administrativas
// ==========================================

// Registra uma alteração no log (chamado por outras funções)
async function registrarLog(tabela, registroId, acao, campo, valorAntigo, valorNovo) {
  try {
    await db._post('log_alteracoes', {
      tabela, registro_id: String(registroId), acao,
      campo: campo || null,
      valor_antigo: valorAntigo !== undefined && valorAntigo !== null ? String(valorAntigo) : null,
      valor_novo: valorNovo !== undefined && valorNovo !== null ? String(valorNovo) : null,
      usuario: _sessao?.nome || 'Desconhecido'
    });
  } catch(e) {
    console.error('Erro ao registrar log:', e);
    // Não bloqueia a ação principal se o log falhar
  }
}

// ==========================================
// 📋 TELA — LOG DE ALTERAÇÕES (só Admin)
// ==========================================
var _logsAuditoria = [];

async function carregarLogAlteracoes() {
  const el = document.getElementById('telaLogAuditoria');
  if (!el) return;
  el.innerHTML = `
  <div class="page-header"><h1>📜 Log de Alterações</h1></div>
  <div class="card">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <select id="logFiltroTabela" onchange="filtrarLogAuditoria()">
        <option value="Todos">Todas as Tabelas</option>
        <option value="jobs">🔩 Moldes/Jobs</option>
        <option value="maquinas">🤖 Máquinas</option>
        <option value="prod_injetoras">🏭 Injetoras</option>
        <option value="usuarios">👤 Usuários</option>
        <option value="prod_categorias">🗂️ Categorias</option>
        <option value="cargos">💼 Cargos</option>
      </select>
      <select id="logFiltroAcao" onchange="filtrarLogAuditoria()">
        <option value="Todos">Todas as Ações</option>
        <option value="criar">+ Criação</option>
        <option value="editar">✏️ Edição</option>
        <option value="excluir">🗑️ Exclusão</option>
      </select>
      <input type="text" id="logFiltroUsuario" placeholder="Filtrar por usuário..." oninput="filtrarLogAuditoria()" style="flex:1;min-width:180px">
    </div>
  </div>
  <div id="logLoader" class="loader-inline" style="display:none"><div class="spinner-sm"></div><span>Carregando...</span></div>
  <div class="card">
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Tabela</th><th>Item</th><th>Alteração</th></tr></thead>
        <tbody id="tbodyLogAuditoria"><tr><td colspan="6" class="empty-msg">Carregando...</td></tr></tbody>
      </table>
    </div>
  </div>`;

  const loader = document.getElementById('logLoader');
  if (loader) loader.style.display = 'flex';
  try {
    _logsAuditoria = await db._get('log_alteracoes', 'order=criado_em.desc&limit=500', '*') || [];
    filtrarLogAuditoria();
  } catch(e) {
    document.getElementById('tbodyLogAuditoria').innerHTML = '<tr><td colspan="6" class="empty-msg">Erro ao carregar.</td></tr>';
  }
  if (loader) loader.style.display = 'none';
}

function filtrarLogAuditoria() {
  const tabela = document.getElementById('logFiltroTabela')?.value || 'Todos';
  const acao   = document.getElementById('logFiltroAcao')?.value || 'Todos';
  const usr    = (document.getElementById('logFiltroUsuario')?.value || '').toUpperCase();

  const filtrado = _logsAuditoria.filter(l => {
    if (tabela !== 'Todos' && l.tabela !== tabela) return false;
    if (acao   !== 'Todos' && l.acao   !== acao)   return false;
    if (usr && !(l.usuario||'').toUpperCase().includes(usr)) return false;
    return true;
  });

  renderizarLogAuditoria(filtrado);
}

function renderizarLogAuditoria(logs) {
  const tbody = document.getElementById('tbodyLogAuditoria');
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Nenhum registro encontrado.</td></tr>';
    return;
  }

  const labelTabela = {
    jobs: '🔩 Molde/Job', maquinas: '🤖 Máquina', prod_injetoras: '🏭 Injetora',
    usuarios: '👤 Usuário', prod_categorias: '🗂️ Categoria', cargos: '💼 Cargo'
  };
  const corAcao = { criar:'#10b981', editar:'#f59e0b', excluir:'#ef4444' };
  const icoAcao = { criar:'+', editar:'✏️', excluir:'🗑️' };

  tbody.innerHTML = logs.map(l => {
    const dt = l.criado_em ? new Date(l.criado_em).toLocaleString('pt-BR') : '—';
    let alteracao = '—';
    if (l.acao === 'editar' && l.campo) {
      alteracao = `<b>${l.campo}</b>: "${l.valor_antigo||'—'}" → "${l.valor_novo||'—'}"`;
    } else if (l.acao === 'criar') {
      alteracao = l.valor_novo || 'Item criado';
    } else if (l.acao === 'excluir') {
      alteracao = l.valor_antigo || 'Item removido';
    }
    return `<tr>
      <td style="font-size:12px;white-space:nowrap">${dt}</td>
      <td><b>${l.usuario}</b></td>
      <td><span style="background:${corAcao[l.acao]}20;color:${corAcao[l.acao]};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${icoAcao[l.acao]} ${l.acao}</span></td>
      <td style="font-size:12px">${labelTabela[l.tabela]||l.tabela}</td>
      <td style="font-size:12px"><b>${l.registro_id}</b></td>
      <td style="font-size:12px;color:#64748b">${alteracao}</td>
    </tr>`;
  }).join('');
}

// ==========================================
// 📋 BUSCAR HISTÓRICO DE UM ITEM ESPECÍFICO
// (usado dentro de fichas — ex: Ficha da Injetora)
// ==========================================
async function buscarHistoricoItem(tabela, registroId) {
  try {
    return await db._get('log_alteracoes',
      'tabela=eq.' + tabela + '&registro_id=eq.' + encodeURIComponent(registroId) + '&order=criado_em.desc', '*') || [];
  } catch(e) { return []; }
}

function renderizarHistoricoItemHTML(logs) {
  if (!logs.length) return '<div style="color:#94a3b8;font-size:12px">Nenhuma alteração registrada.</div>';
  const corAcao = { criar:'#10b981', editar:'#f59e0b', excluir:'#ef4444' };
  const icoAcao = { criar:'+', editar:'✏️', excluir:'🗑️' };
  return logs.map(l => {
    const dt = l.criado_em ? new Date(l.criado_em).toLocaleString('pt-BR') : '—';
    let alteracao = l.acao==='editar' && l.campo ? `${l.campo}: "${l.valor_antigo||'—'}" → "${l.valor_novo||'—'}"` : (l.valor_novo||l.valor_antigo||'');
    return `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed #f1f5f9;font-size:11px">
      <span style="background:${corAcao[l.acao]}20;color:${corAcao[l.acao]};padding:1px 6px;border-radius:6px;font-weight:700;white-space:nowrap">${icoAcao[l.acao]}</span>
      <span style="color:#64748b">${alteracao}</span>
      <span style="margin-left:auto;color:#94a3b8;white-space:nowrap">${l.usuario} · ${dt}</span>
    </div>`;
  }).join('');
}
