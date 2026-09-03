// ==========================================
// 👥 RH.JS — Funcionários + RH V3
// ==========================================

var _todosFuncionarios = [];
var _turnos = ['5x2','Turma A','Turma B','6x1','Estágio'];
var _setores = ['Usinagem','Bancada','Projeto','Projeto / Desenvolvimento','Produção','Supervisão'];
var _cargos  = []; // carregado dinamicamente do Supabase — ver carregarCargosGlobal()

async function carregarCargosGlobal() {
  try {
    const res = await db.listarCargos();
    _cargos = (res || []).map(c => c.nome);
  } catch(e) { console.error('Erro ao carregar cargos:', e); }
}

// ==========================================
// 💼 CARGOS — Aba dentro de Gestão e RH
// ==========================================
var _todosCargosAdmin = [];

// Atalho usado no botão da tela Funcionários — leva direto para a aba Cargos em RH
function abrirGerenciarCargos() {
  irPara('feriados', document.getElementById('menuFeriados'));
  setTimeout(() => {
    const btnCargos = document.querySelector('.tab-rh[onclick*="cargos"]');
    mudarTabRH('cargos', btnCargos);
  }, 100);
}

async function carregarCargosPainelRH() {
  const el = document.getElementById('painelCargos');
  if (!el) return;
  el.innerHTML = `<div class="card">
    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:20px">
      <div class="form-group" style="flex:2;min-width:220px"><label>Novo Cargo</label><input type="text" id="novoCargoInput" placeholder="Ex: Ferramenteiro, Torneiro Mecânico..."></div>
      <button class="btn-success" onclick="adicionarCargo()">+ Adicionar</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Cargo</th><th>Ação</th></tr></thead>
    <tbody id="tbodyCargos"><tr><td colspan="2" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>`;
  await _renderizarCargosPainelRH();
}

async function _renderizarCargosPainelRH() {
  try {
    _todosCargosAdmin = await db.listarCargos();
    const tbody = document.getElementById('tbodyCargos');
    if (!tbody) return;
    tbody.innerHTML = _todosCargosAdmin.length
      ? _todosCargosAdmin.map(c => `<tr>
          <td><b>${c.nome}</b></td>
          <td>
            <button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="abrirEdicaoCargo(${c.id},'${c.nome.replace(/'/g,"\\'")}')">✏️</button>
            <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirCargoConfirm(${c.id},'${c.nome.replace(/'/g,"\\'")}')">🗑️</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="2" class="empty-msg">Nenhum cargo cadastrado.</td></tr>';
  } catch(e) { toast('Erro ao carregar cargos.','erro'); }
}

async function adicionarCargo() {
  const nome = document.getElementById('novoCargoInput')?.value?.trim();
  if (!nome) return toast('Informe o nome do cargo.','erro');
  try {
    const res = await db.salvarCargo({ nome, ativo: true });
    if (typeof registrarLog === 'function') await registrarLog('cargos', res?.[0]?.id || nome, 'criar', null, null, nome);
    toast('Cargo adicionado!','sucesso');
    document.getElementById('novoCargoInput').value = '';
    await _renderizarCargosPainelRH();
    await carregarCargosGlobal();
  } catch(e) { toast('Erro ao adicionar. Talvez já exista.','erro'); }
}

function abrirEdicaoCargo(id, nomeAtual) {
  const div = document.createElement('div');
  div.id = 'modalEditCargoWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoCargo()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:400px">
    <div class="modal-header"><h3>✏️ Editar Cargo</h3><button onclick="fecharEdicaoCargo()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Nome do Cargo *</label><input type="text" id="editCargoNome" value="${nomeAtual.replace(/"/g,'&quot;')}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoCargo(${id},'${nomeAtual.replace(/'/g,"\\'")}')">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoCargo()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarEdicaoCargo(id, nomeAntigo) {
  const novoNome = document.getElementById('editCargoNome')?.value?.trim();
  if (!novoNome) return toast('Informe o nome.','erro');
  try {
    await db.salvarCargo({ id, nome: novoNome });
    if (typeof registrarLog === 'function' && novoNome !== nomeAntigo) {
      await registrarLog('cargos', id, 'editar', 'nome', nomeAntigo, novoNome);
    }
    toast('Cargo atualizado!','sucesso');
    fecharEdicaoCargo();
    await _renderizarCargosPainelRH();
    await carregarCargosGlobal();
  } catch(e) { toast('Erro ao salvar. Talvez já exista outro cargo com esse nome.','erro'); }
}

function fecharEdicaoCargo() { document.getElementById('modalEditCargoWrap')?.remove(); }

function excluirCargoConfirm(id, nome) {
  confirmarExclusao('Remover o cargo "' + nome + '"?', async () => {
    try {
      await db.excluirCargo(id);
      if (typeof registrarLog === 'function') await registrarLog('cargos', id, 'excluir', null, nome, null);
      toast('Cargo removido!','sucesso');
      await _renderizarCargosPainelRH();
      await carregarCargosGlobal();
    } catch(e) { toast('Erro ao remover.','erro'); }
  });
}

// ==========================================
// 👥 LISTA DE FUNCIONÁRIOS
// ==========================================
async function carregarFuncionariosRH() {
  const el = document.getElementById('listaFuncionarios');
  if (!el) return;
  el.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>';
  if (!_cargos.length) await carregarCargosGlobal();
  try {
    const [ferr, prod] = await Promise.all([
      db.listarFuncionarios(),
      db.listarProdTecnicos()
    ]);
    _todosFuncionarios = [
      ...(ferr||[]).map(f => ({ ...f, _origem:'Ferramentaria' })),
      ...(prod||[]).map(t => ({ id:t.id, nome:t.nome, setor:'Produção', turno:t.turno,
        supervisor:t.supervisor, ativo:t.ativo, _origem:'Producao' }))
    ];
    filtrarFuncionarios();
  } catch(e) {
    el.innerHTML='<div class="empty-msg">Erro ao carregar.</div>';
    toast('Erro ao carregar funcionários.','erro');
  }
}

function filtrarFuncionarios() {
  const el     = document.getElementById('listaFuncionarios');
  if (!el) return;
  const busca  = (document.getElementById('buscaFunc')?.value||'').toUpperCase();
  const setor  = document.getElementById('filtroSetorFunc')?.value||'Todos';
  const status = document.getElementById('filtroStatusFunc')?.value||'ativos';

  const filtrado = _todosFuncionarios.filter(f => {
    if (busca && !f.nome.toUpperCase().includes(busca)) return false;
    if (setor!=='Todos' && f.setor!==setor) return false;
    if (status==='ativos'   && !f.ativo)  return false;
    if (status==='inativos' &&  f.ativo)  return false;
    return true;
  });

  if (!filtrado.length) { el.innerHTML='<div class="empty-msg">Nenhum funcionário encontrado.</div>'; return; }

  const coresSe = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6',
    Produção:'#10b981', 'Projeto / Desenvolvimento':'#8b5cf6', Supervisão:'#f59e0b' };

  el.innerHTML = filtrado.map(f => {
    const cor = coresSe[f.setor]||'#64748b';
    return `<div class="lista-item" style="cursor:pointer" onclick="abrirFichaFuncionario(${f.id},'${f._origem}')">
      <div class="lista-item-info">
        <div class="lista-item-nome">${f.nome} ${f.matricula?`<span style="font-size:11px;color:#94a3b8;font-weight:400">#${f.matricula}</span>`:''}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:3px;flex-wrap:wrap">
          <span style="background:${cor}15;color:${cor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${f.setor||'—'}</span>
          <span style="font-size:11px;color:#94a3b8">${f.turno||''} ${f.cargo?'· '+f.cargo:''} ${f.supervisor?'· Sup: '+f.supervisor:''}</span>
        </div>
      </div>
      <div class="lista-item-acoes">
        <span class="${f.ativo?'badge-ativo':'badge-inativo'}">${f.ativo?'ATIVO':'INATIVO'}</span>
      </div>
    </div>`;
  }).join('');
}

// ==========================================
// ➕ NOVO FUNCIONÁRIO — Modal
// ==========================================
function abrirFormFuncionario() {
  const div = document.createElement('div');
  div.id = 'modalFuncWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalFunc()" style="display:block"></div>
  <div class="modal" style="display:flex;flex-direction:column;max-width:560px;max-height:85vh">
    <div class="modal-header">
      <h3>👤 Novo Funcionário</h3>
      <button onclick="fecharModalFunc()">✕</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;flex:1">
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Nome Completo *</label>
          <input type="text" id="fnNome" placeholder="Nome do funcionário">
        </div>
        <div class="form-group">
          <label>Matrícula</label>
          <input type="text" id="fnMatricula" placeholder="Ex: 0042">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Setor *</label>
          <select id="fnSetor">
            ${_setores.map(s=>`<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Turno *</label>
          <select id="fnTurno">
            ${_turnos.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cargo</label>
          <select id="fnCargo">
            <option value="">Selecione...</option>
            ${_cargos.map(c=>`<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Supervisor</label>
          <input type="text" id="fnSupervisor" placeholder="Nome do supervisor">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Data de Admissão</label>
          <input type="date" id="fnAdmissao">
        </div>
      </div>
      <div class="form-group">
        <label>Setor Extra de Apontamento (opcional)</label>
        <select id="fnSetorExtra">
          <option value="">Nenhum</option>
          <option value="Usinagem">Usinagem</option>
          <option value="Bancada">Bancada</option>
          <option value="Projeto">Projeto</option>
          <option value="Producao">Produção</option>
        </select>
        <div style="font-size:11px;color:#64748b;margin-top:4px">Use quando o funcionário pertence a um setor, mas também precisa ser lançado por outro (ex: técnico da Bancada que opera solda na Usinagem).</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovoFuncionario()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalFunc()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarNovoFuncionario() {
  const nome     = document.getElementById('fnNome')?.value?.trim();
  const setor    = document.getElementById('fnSetor')?.value;
  const turno    = document.getElementById('fnTurno')?.value;
  const cargo    = document.getElementById('fnCargo')?.value || null;
  const sup      = document.getElementById('fnSupervisor')?.value?.trim() || null;
  const admissao = document.getElementById('fnAdmissao')?.value || null;
  const matricula= document.getElementById('fnMatricula')?.value?.trim() || null;
  const setorExtra = document.getElementById('fnSetorExtra')?.value || null;

  if (!nome) return toast('Informe o nome.','erro');

  try {
    await db.salvarFuncionario({ nome, setor, turno, cargo, supervisor:sup,
      matricula, admissao, ativo:true, setor_apontamento_extra: setorExtra });
    toast('Funcionário adicionado!','sucesso');
    fecharModalFunc();
    carregarFuncionariosRH();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

function fecharModalFunc() {
  document.getElementById('modalFuncWrap')?.remove();
}

// ==========================================
// 👁️ FICHA DO FUNCIONÁRIO
// ==========================================
// ==========================================
// 👤 FICHA DO FUNCIONÁRIO — Página própria (como Ficha do Molde)
// ==========================================
var _fichaFuncAtual = null; // { id, origem, nome } do funcionário atualmente exibido
var _fichaFuncCompleto = null; // objeto completo do funcionário exibido, usado pelo Editar

// ==========================================
// 🔗 ATALHO GLOBAL — clicar no nome do técnico em qualquer lugar do sistema
// ==========================================
function _podeVerFichaFuncionario() {
  return typeof _temPermissao === 'function' && (_temPermissao('rh') || _temPermissao('admin'));
}

function abrirFichaTecnico(nome) {
  if (!nome) return;
  if (!_podeVerFichaFuncionario()) return;
  irPara('fichaFuncionario', document.getElementById('menuFichaFuncionario'));
  setTimeout(() => carregarFichaFuncionarioPorNome(nome), 150);
}

// Retorna o nome como span clicável (se o usuário tiver permissão) ou texto simples
function nomeTecnicoClicavel(nome) {
  if (!nome) return '—';
  const nomeUpper = String(nome).toUpperCase();
  if (nomeUpper.includes('SEM OPERADOR') || nomeUpper === '—') return nome;
  if (!_podeVerFichaFuncionario()) return nome;
  const nomeEsc = String(nome).replace(/'/g, "\\'");
  return `<span style="cursor:pointer;color:#0056b3;text-decoration:underline dotted" onclick="event.stopPropagation();abrirFichaTecnico('${nomeEsc}')">${nome}</span>`;
}

// Chamada pela lista de Funcionários (mantém compatibilidade com onclick existente)
async function abrirFichaFuncionario(id, origem) {
  irPara('fichaFuncionario', document.getElementById('menuFichaFuncionario'));
  setTimeout(() => carregarFichaFuncionarioPorId(id, origem), 100);
}

// Chamada pela busca dentro da própria página da ficha
async function buscarFichaFuncionarioPagina() {
  const nome = document.getElementById('fichaFuncNomeInput')?.value?.trim();
  if (!nome) return toast('Digite o nome do funcionário.','erro');
  await carregarFichaFuncionarioPorNome(nome);
}

async function carregarFichaFuncionarioPorNome(nome) {
  try {
    let todos = await db.listarFuncionarios();
    let f = todos.find(t => t.nome === nome);
    let origem = 'Ferramentaria';
    if (!f) {
      const todosProd = await db.listarProdTecnicos();
      f = todosProd.find(t => t.nome === nome);
      origem = 'Producao';
    }
    if (!f) {
      document.getElementById('fichaFuncPaginaConteudo').style.display = 'none';
      document.getElementById('fichaFuncPaginaVazio').style.display = 'block';
      document.getElementById('fichaFuncPaginaVazio').innerHTML = '<div style="font-size:48px">🔍</div><div>Funcionário "' + nome + '" não encontrado.</div>';
      return;
    }
    await carregarFichaFuncionarioPorId(f.id, origem);
  } catch(e) { toast('Erro ao buscar funcionário.','erro'); console.error(e); }
}

async function carregarFichaFuncionarioPorId(id, origem) {
  const conteudo = document.getElementById('fichaFuncPaginaConteudo');
  const vazio    = document.getElementById('fichaFuncPaginaVazio');
  if (!conteudo) return;
  vazio.style.display = 'none';
  conteudo.style.display = 'block';
  conteudo.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando ficha...</span></div>';

  try {
    let f;
    if (origem === 'Producao') {
      const todos = await db.listarProdTecnicos();
      f = todos.find(t => t.id === id);
      if (f) f = { ...f, setor:'Produção', _origem:'Producao' };
    } else {
      const todos = await db.listarFuncionarios();
      f = todos.find(t => t.id === id);
      if (f) f = { ...f, _origem:'Ferramentaria' };
    }

    if (!f) { conteudo.innerHTML='<div class="empty-msg">Funcionário não encontrado.</div>'; return; }

    _fichaFuncAtual = { id: f.id, origem: f._origem, nome: f.nome };
    _fichaFuncCompleto = f; // objeto completo, usado pelo botão Editar (evita serializar em JSON no HTML)
    const elBusca = document.getElementById('fichaFuncNomeInput');
    if (elBusca) elBusca.value = f.nome;

    // Busca histórico de turno
    let histTurno = [];
    try {
      histTurno = await db._get('funcionario_turno_historico',
        'funcionario_id=eq.' + id + '&order=data_inicio.desc', '*') || [];
    } catch(e) {}

    const cor = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6',
      Produção:'#10b981', Supervisão:'#f59e0b' }[f.setor] || '#64748b';

    const fmtDt = d => d ? d.split('-').reverse().join('/') : '—';

    conteudo.innerHTML = `
    <!-- CABEÇALHO -->
    <div class="card" style="background:linear-gradient(135deg,${cor}20,${cor}05);border:1px solid ${cor}30">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:6px">FICHA DO FUNCIONÁRIO</div>
          <div style="font-size:24px;font-weight:700;color:#1e3a5f">${f.nome}</div>
          ${f.matricula?`<div style="font-size:13px;color:#64748b;margin-top:2px">Matrícula: <b>#${f.matricula}</b></div>`:''}
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <span style="background:${cor}20;color:${cor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700">${f.setor||'—'}</span>
            <span style="background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">⏰ ${f.turno||'—'}</span>
            <span class="${f.ativo?'badge-ativo':'badge-inativo'}">${f.ativo?'ATIVO':'INATIVO'}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-primary" style="font-size:12px;padding:8px 14px" onclick="abrirEdicaoFuncionario(_fichaFuncCompleto)">✏️ Editar</button>
          ${typeof isAdmin === 'function' && isAdmin() ? `<button class="btn-danger" style="font-size:12px;padding:8px 14px" onclick="excluirFuncConfirm(${f.id},'${f._origem}','${(f.nome||'').replace(/'/g,"\\'")}')">🗑️ Excluir</button>` : ''}
        </div>
      </div>
    </div>

    <!-- DADOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="card" style="margin:0;padding:14px">
        <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px">INFORMAÇÕES</div>
        <div style="font-size:13px;line-height:2">
          <div>💼 <b>Cargo:</b> ${f.cargo||'—'}</div>
          <div>👤 <b>Supervisor:</b> ${f.supervisor||'—'}</div>
          <div>📅 <b>Admissão:</b> ${fmtDt(f.admissao)}</div>
          ${f.demissao?`<div style="color:#ef4444">🚪 <b>Desligamento:</b> ${fmtDt(f.demissao)}</div>`:''}
        </div>
      </div>
      <div class="card" style="margin:0;padding:14px">
        <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px">TURNO ATUAL</div>
        <div style="font-size:24px;font-weight:700;color:#0056b3;margin-bottom:4px">${f.turno||'—'}</div>
        <div style="font-size:12px;color:#64748b">
          ${f.turno==='5x2'?'07:30 → 17:28 | Seg-Sex | 528 min':
            f.turno==='Turma A'||f.turno==='Turma B'?'07:30 → 19:30 | Rodízio 2x2 | 660 min':
            f.turno==='6x1'?'07:30 → 16:00 | Seg-Sab | 440 min':
            f.turno==='Estágio'?'07:30 → 16:00 | Seg-Sex | 440 min':'—'}
        </div>
        <button class="btn-secondary" style="margin-top:10px;font-size:11px;padding:5px 10px" onclick="abrirModalTrocaTurno(${id},'${f.turno||''}')">🔄 Registrar Mudança de Turno</button>
      </div>
      <div class="card" style="margin:0;padding:14px" id="fichaFuncSaldoBH">
        <div style="font-size:12px;color:#94a3b8">Calculando saldo do banco de horas...</div>
      </div>
    </div>

    <!-- HISTÓRICO DE TURNO -->
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:12px">📋 Histórico de Turno</div>
      ${histTurno.length ? `
        <div style="position:relative;padding-left:24px">
          ${histTurno.map((h,i) => `
            <div style="position:relative;margin-bottom:12px">
              <div style="position:absolute;left:-24px;top:4px;width:12px;height:12px;border-radius:50%;background:#0056b3;border:2px solid #fff;box-shadow:0 0 0 2px #0056b3"></div>
              <div style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;border-left:3px solid #0056b3;padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                  <span style="font-size:13px;font-weight:700;color:#0056b3">${h.turno}</span>
                  <span style="font-size:11px;color:#94a3b8">
                    ${fmtDt(h.data_inicio)} ${h.data_fim?' → '+fmtDt(h.data_fim):'→ atual'}
                  </span>
                </div>
                ${h.motivo?`<div style="font-size:12px;color:#64748b;margin-top:4px">📝 ${h.motivo}</div>`:''}
              </div>
            </div>`).join('')}
        </div>` :
        '<div style="color:#94a3b8;font-size:13px">Nenhuma mudança de turno registrada.</div>'
      }
    </div>

    <!-- HISTÓRICO DE LANÇAMENTOS -->
    <div class="card">
      <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:12px">📊 Histórico de Lançamentos e Produtividade</div>
      <div id="fichaFuncHistorico">
        <div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>
      </div>
    </div>`;

    if (typeof renderizarHistoricoNaFicha === 'function') {
      renderizarHistoricoNaFicha(f.nome, 'fichaFuncHistorico');
    }
    if (typeof renderizarSaldoBancoHorasNaFicha === 'function') {
      renderizarSaldoBancoHorasNaFicha(f.nome, 'fichaFuncSaldoBH');
    }

  } catch(e) {
    conteudo.innerHTML = '<div class="empty-msg">Erro ao carregar ficha.</div>';
    console.error(e);
  }
}

// Mantido por compatibilidade — não faz mais nada (não há modal para fechar)
function fecharFichaFunc() {}

// ==========================================
// ✏️ EDITAR FUNCIONÁRIO
// ==========================================
function abrirEdicaoFuncionario(f) {
  const div = document.createElement('div');
  div.id = 'modalEditFuncWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoFunc()" style="display:block"></div>
  <div class="modal" style="display:flex;flex-direction:column;max-width:560px;max-height:85vh">
    <div class="modal-header">
      <h3>✏️ Editar — ${f.nome}</h3>
      <button onclick="fecharEdicaoFunc()">✕</button>
    </div>
    <div class="modal-body" style="overflow-y:auto;flex:1">
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Nome Completo *</label>
          <input type="text" id="efNome" value="${f.nome||''}">
        </div>
        <div class="form-group">
          <label>Matrícula</label>
          <input type="text" id="efMatricula" value="${f.matricula||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Setor *</label>
          <select id="efSetor">
            ${_setores.map(s=>`<option value="${s}" ${f.setor===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Turno *</label>
          <select id="efTurno">
            ${_turnos.map(t=>`<option value="${t}" ${f.turno===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cargo</label>
          <select id="efCargo">
            <option value="">Selecione...</option>
            ${_cargos.map(c=>`<option value="${c}" ${f.cargo===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Supervisor</label>
          <input type="text" id="efSupervisor" value="${f.supervisor||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Admissão</label>
          <input type="date" id="efAdmissao" value="${f.admissao||''}">
        </div>
        <div class="form-group">
          <label>Desligamento</label>
          <input type="date" id="efDemissao" value="${f.demissao||''}">
        </div>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="efAtivo" ${f.ativo!==false?'checked':''}> Funcionário Ativo
        </label>
      </div>
      <div class="form-group">
        <label>Setor Extra de Apontamento (opcional)</label>
        <select id="efSetorExtra">
          <option value="">Nenhum</option>
          <option value="Usinagem" ${f.setor_apontamento_extra==='Usinagem'?'selected':''}>Usinagem</option>
          <option value="Bancada" ${f.setor_apontamento_extra==='Bancada'?'selected':''}>Bancada</option>
          <option value="Projeto" ${f.setor_apontamento_extra==='Projeto'?'selected':''}>Projeto</option>
          <option value="Producao" ${(f.setor_apontamento_extra==='Producao'||f.setor_apontamento_extra==='Produção')?'selected':''}>Produção</option>
        </select>
        <div style="font-size:11px;color:#64748b;margin-top:4px">Use quando o funcionário pertence a um setor, mas também precisa ser lançado por outro (ex: técnico da Bancada que opera solda na Usinagem).</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoFuncionario(${f.id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoFunc()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarEdicaoFuncionario(id) {
  const nome      = document.getElementById('efNome')?.value?.trim();
  const setor     = document.getElementById('efSetor')?.value;
  const turno     = document.getElementById('efTurno')?.value;
  const cargo     = document.getElementById('efCargo')?.value || null;
  const sup       = document.getElementById('efSupervisor')?.value?.trim() || null;
  const admissao  = document.getElementById('efAdmissao')?.value || null;
  const demissao  = document.getElementById('efDemissao')?.value || null;
  const matricula = document.getElementById('efMatricula')?.value?.trim() || null;
  const ativo     = document.getElementById('efAtivo')?.checked ?? true;
  const setorExtra = document.getElementById('efSetorExtra')?.value || null;

  if (!nome) return toast('Informe o nome.','erro');

  const nomeAntigo = _fichaFuncCompleto?.nome;
  const nomeMudou = nomeAntigo && nomeAntigo !== nome;
  const aindaSoEmProdTecnicos = _fichaFuncCompleto?._origem === 'Producao';

  if (aindaSoEmProdTecnicos) {
    // Pessoa ainda não migrada — em vez de tentar editar em prod_tecnicos
    // (perpetuando a divisão), migra ela pra funcionarios agora, completando
    // a unificação, e desativa o registro antigo
    if (nomeMudou) {
      const ok = confirm(`Você está renomeando "${nomeAntigo}" para "${nome}".\n\nIsso vai atualizar TODOS os lançamentos já registrados no nome antigo, pra manter o histórico ligado a essa pessoa.\n\nConfirma a renomeação?`);
      if (!ok) return;
    }
    try {
      const res = await db.salvarFuncionario({ nome, setor, turno, cargo, supervisor:sup,
        matricula, admissao, demissao: demissao||null, ativo, setor_apontamento_extra: setorExtra });
      const novoId = res && res[0] ? res[0].id : null;
      await db.excluirProdTecnico(id); // desativa o registro antigo em prod_tecnicos

      if (nomeMudou) {
        // Religa o histórico (lancamentos/banco de horas/faltas/férias usam nome
        // ainda, então religa pelo nome antigo) e prod_lancamentos (texto solto)
        await db._patch('lancamentos',  'funcionario=eq.' + encodeURIComponent(nomeAntigo), { funcionario: nome, funcionario_id: novoId });
        await db._patch('banco_horas',  'funcionario=eq.' + encodeURIComponent(nomeAntigo), { funcionario: nome, funcionario_id: novoId });
        await db._patch('rh_parciais',  'funcionario=eq.' + encodeURIComponent(nomeAntigo), { funcionario: nome, funcionario_id: novoId });
        await db._patch('ferias',       'funcionario=eq.' + encodeURIComponent(nomeAntigo), { funcionario: nome, funcionario_id: novoId });
        try {
          const prodAfetados = await db._get('prod_lancamentos',
            'tecnicos=ilike.*' + encodeURIComponent(nomeAntigo) + '*', 'id,tecnicos');
          for (const p of (prodAfetados||[])) {
            const nomes = (p.tecnicos||'').split(',').map(n=>n.trim());
            if (!nomes.includes(nomeAntigo)) continue;
            await db._patch('prod_lancamentos', 'id=eq.'+p.id, { tecnicos: nomes.map(n=>n===nomeAntigo?nome:n).join(', ') });
          }
        } catch(e) { console.error('Erro ao atualizar prod_lancamentos', e); }
      } else if (novoId) {
        // Nome não mudou, mas agora existe um ID de verdade — liga o histórico já existente
        await db._patch('lancamentos',  'funcionario=eq.' + encodeURIComponent(nome), { funcionario_id: novoId });
        await db._patch('banco_horas',  'funcionario=eq.' + encodeURIComponent(nome), { funcionario_id: novoId });
        await db._patch('rh_parciais',  'funcionario=eq.' + encodeURIComponent(nome), { funcionario_id: novoId });
        await db._patch('ferias',       'funcionario=eq.' + encodeURIComponent(nome), { funcionario_id: novoId });
      }

      if (typeof registrarLog === 'function') await registrarLog('funcionarios', novoId||id, 'editar', 'migracao', 'prod_tecnicos', 'funcionarios (unificado)');
      toast('Funcionário atualizado e unificado ao cadastro principal!','sucesso');
      fecharEdicaoFunc();
      if (_fichaFuncAtual && _fichaFuncAtual.id === id && novoId) {
        await carregarFichaFuncionarioPorId(novoId, 'Ferramentaria');
      }
    } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
    return;
  }

  // Se o nome mudou, precisa confirmar antes — a mudança será propagada pros
  // lançamentos/banco de horas/férias/faltas já registrados, senão o histórico
  // dessa pessoa fica "órfão" (ligado ao nome antigo)
  if (nomeMudou) {
    const ok = confirm(`Você está renomeando "${nomeAntigo}" para "${nome}".\n\nIsso vai atualizar TODOS os lançamentos, banco de horas, férias e faltas já registrados no nome antigo, pra manter o histórico ligado a essa pessoa.\n\nConfirma a renomeação?`);
    if (!ok) return;
  }

  try {
    await db.salvarFuncionario({ id, nome, setor, turno, cargo, supervisor:sup,
      matricula, admissao, demissao: demissao||null, ativo, setor_apontamento_extra: setorExtra });

    if (nomeMudou) {
      await db._patch('lancamentos',  'funcionario_id=eq.' + id, { funcionario: nome });
      await db._patch('banco_horas',  'funcionario_id=eq.' + id, { funcionario: nome });
      await db._patch('rh_parciais',  'funcionario_id=eq.' + id, { funcionario: nome });
      await db._patch('ferias',       'funcionario_id=eq.' + id, { funcionario: nome });

      // prod_lancamentos guarda vários nomes juntos numa célula de texto
      // (ex: "João, Maria") — não dá pra usar ID, então troca só o nome exato
      // dentro da lista, preservando os outros nomes do mesmo lançamento
      try {
        const prodAfetados = await db._get('prod_lancamentos',
          'tecnicos=ilike.*' + encodeURIComponent(nomeAntigo) + '*', 'id,tecnicos');
        for (const p of (prodAfetados||[])) {
          const nomes = (p.tecnicos||'').split(',').map(n=>n.trim());
          if (!nomes.includes(nomeAntigo)) continue; // evita trocar por engano um nome parecido
          const novosNomes = nomes.map(n => n === nomeAntigo ? nome : n);
          await db._patch('prod_lancamentos', 'id=eq.'+p.id, { tecnicos: novosNomes.join(', ') });
        }
      } catch(e) { console.error('Erro ao atualizar prod_lancamentos na renomeação', e); }

      if (typeof registrarLog === 'function') await registrarLog('funcionarios', id, 'editar', 'nome', nomeAntigo, nome);
      toast('Funcionário renomeado! Histórico atualizado.','sucesso');
    } else {
      toast('Funcionário atualizado!','sucesso');
    }
    fecharEdicaoFunc();
    // Se estiver na página da ficha, recarrega os dados atualizados
    if (_fichaFuncAtual && _fichaFuncAtual.id === id) {
      await carregarFichaFuncionarioPorId(id, _fichaFuncAtual.origem);
    }
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

function fecharEdicaoFunc() {
  document.getElementById('modalEditFuncWrap')?.remove();
}

// ==========================================
// 🔄 TROCA DE TURNO
// ==========================================
function abrirModalTrocaTurno(id, turnoAtual) {
  const div = document.createElement('div');
  div.id = 'modalTrocaTurnoWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalTrocaTurno()" style="display:block;z-index:9998"></div>
  <div class="modal" style="display:block;max-width:420px;z-index:9999">
    <div class="modal-header">
      <h3>🔄 Registrar Mudança de Turno</h3>
      <button onclick="fecharModalTrocaTurno()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Turno Atual</label>
        <input type="text" value="${turnoAtual}" disabled style="background:#f1f5f9;color:#64748b">
      </div>
      <div class="form-group">
        <label>Novo Turno *</label>
        <select id="novoTurno">
          ${_turnos.filter(t=>t!==turnoAtual).map(t=>`<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data de Início *</label>
        <input type="date" id="trocaTurnoData" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Motivo</label>
        <input type="text" id="trocaTurnoMotivo" placeholder="Ex: Promoção, transferência de setor...">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarTrocaTurno(${id},'${turnoAtual}')">💾 Confirmar</button>
      <button class="btn-secondary" onclick="fecharModalTrocaTurno()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarTrocaTurno(id, turnoAnterior) {
  const novoTurno = document.getElementById('novoTurno')?.value;
  const data      = document.getElementById('trocaTurnoData')?.value;
  const motivo    = document.getElementById('trocaTurnoMotivo')?.value?.trim() || null;

  if (!novoTurno || !data) return toast('Preencha o novo turno e a data.','erro');

  try {
    // Fecha o histórico anterior
    const hist = await db._get('funcionario_turno_historico',
      'funcionario_id=eq.' + id + '&data_fim=is.null&order=data_inicio.desc&limit=1', '*');
    if (hist && hist.length > 0) {
      await db._patch('funcionario_turno_historico', 'id=eq.' + hist[0].id,
        { data_fim: data });
    }
    // Cria novo registro
    await db._post('funcionario_turno_historico', {
      funcionario_id: id, turno: novoTurno,
      data_inicio: data, motivo,
      registrado_por: _sessao?.nome || null
    });
    // Atualiza turno no funcionário
    await db.salvarFuncionario({ id, turno: novoTurno });

    toast('Turno atualizado!','sucesso');
    fecharModalTrocaTurno();
    fecharFichaFunc();
    // Reabre a ficha atualizada
    setTimeout(() => abrirFichaFuncionario(id, 'Ferramentaria'), 300);
  } catch(e) { toast('Erro ao registrar.','erro'); console.error(e); }
}

function fecharModalTrocaTurno() {
  document.getElementById('modalTrocaTurnoWrap')?.remove();
}

async function excluirFuncConfirm(id, origem, nome) {
  if (typeof isAdmin !== 'function' || !isAdmin()) {
    toast('Apenas administradores podem excluir funcionários.','erro');
    return;
  }
  confirmarExclusao('Remover este funcionário?', async () => {
    try {
      if (origem==='Producao') await db.excluirProdTecnico(id);
      else await db.excluirFuncionario(id);
      if (typeof registrarLog === 'function') {
        await registrarLog(origem==='Producao' ? 'prod_tecnicos' : 'funcionarios', id, 'excluir', null, nome || null, null);
      }
      toast('Removido!','sucesso');
      // Se a exclusão veio da página da ficha, volta para a lista de Funcionários
      if (_fichaFuncAtual && _fichaFuncAtual.id === id) {
        _fichaFuncAtual = null;
        irPara('funcionarios', document.getElementById('menuFuncionarios'));
        setTimeout(() => carregarFuncionariosRH(), 100);
      } else {
        carregarFuncionariosRH();
      }
    } catch(e) { toast('Erro.','erro'); }
  });
}

// Mantém compatibilidade com chamada antiga
function editarFuncAdmin(f) { abrirEdicaoFuncionario(f); }
async function excluirFuncAdmin(id, origem, nome) { excluirFuncConfirm(id, origem, nome); }

// ==========================================
// 📅 RH (Feriados / Ausências / Atrasos)
// ==========================================
function inicializarRH() { carregarPainelRH('feriados'); }

function mudarTabRH(aba, elBtn) {
  document.querySelectorAll('.painel-rh').forEach(p=>p.classList.remove('ativo'));
  document.querySelectorAll('.tab-rh').forEach(b=>b.classList.remove('ativa'));
  document.getElementById('painel'+aba.charAt(0).toUpperCase()+aba.slice(1))?.classList.add('ativo');
  if (elBtn) elBtn.classList.add('ativa');
  carregarPainelRH(aba);
}

function carregarPainelRH(aba) {
  if (aba==='feriados')         carregarFeriados();
  else if (aba==='ausencias')   carregarFerias();
  else if (aba==='parciais')    carregarParciais();
  else if (aba==='bancoHoras')  { if (typeof inicializarBancoHoras==='function') inicializarBancoHoras(); }
  else if (aba==='cargos')      { if (typeof carregarCargosPainelRH==='function') carregarCargosPainelRH(); }
}

// ==========================================
// 📅 FERIADOS
// ==========================================
async function carregarFeriados() {
  const el = document.getElementById('painelFeriados');
  if (!el) return;
  el.innerHTML = `<div class="card">
    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:20px">
      <div class="form-group" style="min-width:150px"><label>Data</label><input type="date" id="ferData"></div>
      <div class="form-group" style="flex:2;min-width:200px"><label>Nome</label><input type="text" id="ferNome" placeholder="Ex: Sexta-Feira Santa"></div>
      <button class="btn-success" onclick="salvarFeriado()">+ Adicionar</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Nome</th><th>Ação</th></tr></thead>
    <tbody id="tbodyFeriados"><tr><td colspan="3" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>`;
  try {
    const res = await db.listarFeriados();
    document.getElementById('tbodyFeriados').innerHTML = res.length
      ? res.map(f=>`<tr>
          <td><b>${f.data?f.data.split('-').reverse().join('/'):'—'}</b></td>
          <td>${f.nome}</td>
          <td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirFeriadoConfirm(${f.id})">🗑️</button></td>
        </tr>`).join('')
      : '<tr><td colspan="3" class="empty-msg">Nenhum feriado.</td></tr>';
  } catch(e) {}
}

async function salvarFeriado() {
  const dt=document.getElementById('ferData')?.value, nm=document.getElementById('ferNome')?.value;
  if (!dt||!nm) return toast('Preencha data e nome.','erro');
  try { await db.salvarFeriado(dt,nm); toast('Adicionado!','sucesso'); document.getElementById('ferNome').value=''; carregarFeriados(); }
  catch(e) { toast('Erro.','erro'); }
}

function excluirFeriadoConfirm(id) {
  confirmarExclusao('Excluir este feriado?', async()=>{
    try { await db.excluirFeriado(id); toast('Removido!','sucesso'); carregarFeriados(); } catch(e){}
  });
}

// ==========================================
// 🏖️ AUSÊNCIAS
// ==========================================
async function carregarFerias() {
  const el = document.getElementById('painelAusencias');
  if (!el) return;
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[]).filter((v,i,a)=>a.indexOf(v)===i);
  const motivos = ['Atestado Médico','Falta Injustificada','Férias','Folga Compensatória','Licença / Outros'];
  el.innerHTML = `<div class="card">
    <div class="form-row">
      <div class="form-group"><label>Técnico</label><select id="ferFunc"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></div>
      <div class="form-group"><label>Início</label><input type="date" id="ferIni"></div>
      <div class="form-group"><label>Fim</label><input type="date" id="ferFim"></div>
      <div class="form-group"><label>Motivo</label><select id="ferMotivo">${motivos.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div>
    </div>
    <button class="btn-success" onclick="salvarFerias()" style="margin-bottom:16px">+ Registrar</button>
    <div class="table-wrap"><table><thead><tr><th>Técnico</th><th>Início</th><th>Fim</th><th>Motivo</th><th>Ação</th></tr></thead>
    <tbody id="tbodyFerias"><tr><td colspan="5" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>`;
  try {
    const res = await db.listarFerias();
    document.getElementById('tbodyFerias').innerHTML = res.length
      ? res.map(f=>`<tr>
          <td><b>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(f.funcionario):f.funcionario}</b></td>
          <td>${f.inicio?f.inicio.split('-').reverse().join('/'):'—'}</td>
          <td>${f.fim?f.fim.split('-').reverse().join('/'):'—'}</td>
          <td style="color:${f.motivo?.includes('Falta')?'#ef4444':'#059669'};font-weight:600">${f.motivo}</td>
          <td>
            <button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick='abrirEdicaoFerias(${JSON.stringify(f).replace(/'/g,"&apos;")})'>✏️</button>
            <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirFeriasConfirm(${f.id})">🗑️</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="empty-msg">Nenhum registro.</td></tr>';
  } catch(e) {}
}

async function salvarFerias() {
  const func=document.getElementById('ferFunc')?.value, ini=document.getElementById('ferIni')?.value,
        fim=document.getElementById('ferFim')?.value, motivo=document.getElementById('ferMotivo')?.value;
  if (!func||!ini||!fim) return toast('Preencha todos os campos.','erro');
  try {
    const res = await db.salvarFerias({funcionario:func,inicio:ini,fim,motivo});
    toast('Registrado!','sucesso');
    if (motivo === 'Folga Compensatória' && typeof registrarDebitoFolgaCompensatoria === 'function') {
      const novoId = res && res[0] ? res[0].id : null;
      await registrarDebitoFolgaCompensatoria(func, ini, fim, novoId);
    }
    carregarFerias();
  }
  catch(e) { toast('Erro.','erro'); }
}

function excluirFeriasConfirm(id) {
  confirmarExclusao('Excluir este registro?', async()=>{
    try { await db.excluirFerias(id); toast('Removido!','sucesso'); carregarFerias(); } catch(e){}
  });
}

// ==========================================
// ✏️ EDITAR AUSÊNCIA / FÉRIAS
// ==========================================
function abrirEdicaoFerias(f) {
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[]).concat(_listas?.funcProducao||[])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();
  const motivos = ['Atestado Médico','Falta Injustificada','Férias','Folga Compensatória','Licença / Outros'];
  const div = document.createElement('div');
  div.id = 'modalEditFeriasWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoFerias()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px">
    <div class="modal-header"><h3>✏️ Editar Ausência</h3><button onclick="fecharEdicaoFerias()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Técnico *</label>
        <select id="efFerFunc">${funcs.map(fn=>`<option value="${fn}" ${f.funcionario===fn?'selected':''}>${fn}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Início *</label><input type="date" id="efFerIni" value="${f.inicio||''}"></div>
        <div class="form-group"><label>Fim *</label><input type="date" id="efFerFim" value="${f.fim||''}"></div>
      </div>
      <div class="form-group"><label>Motivo *</label>
        <select id="efFerMotivo">${motivos.map(m=>`<option value="${m}" ${f.motivo===m?'selected':''}>${m}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoFerias(${f.id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoFerias()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarEdicaoFerias(id) {
  const funcionario = document.getElementById('efFerFunc')?.value;
  const inicio      = document.getElementById('efFerIni')?.value;
  const fim         = document.getElementById('efFerFim')?.value;
  const motivo      = document.getElementById('efFerMotivo')?.value;
  if (!funcionario || !inicio || !fim) return toast('Preencha todos os campos.','erro');
  try {
    await db.salvarFerias({ id, funcionario, inicio, fim, motivo });
    toast('Atualizado!','sucesso');
    fecharEdicaoFerias();
    carregarFerias();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

function fecharEdicaoFerias() { document.getElementById('modalEditFeriasWrap')?.remove(); }

// ==========================================
// ⏱️ PARCIAIS / ATRASOS
// ==========================================
async function carregarParciais() {
  const el = document.getElementById('painelParciais');
  if (!el) return;
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[]).filter((v,i,a)=>a.indexOf(v)===i);
  const motivos = ['Atraso Justificado','Atraso Injustificado','Saída Antecipada','Exame / Médico','Banco de Horas','Outros'];

  el.innerHTML = `
  <div class="card" style="background:#fefce8;border-color:#fde68a">
    <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:16px">⏱️ Registrar Ocorrência</div>
    <div class="form-row">
      <div class="form-group"><label>Técnico *</label><select id="parcFunc"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></div>
      <div class="form-group"><label>Data *</label><input type="date" id="parcData"></div>
      <div class="form-group"><label>Saída</label><input type="time" id="parcIni"></div>
      <div class="form-group"><label>Retorno</label><input type="time" id="parcFim"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Motivo *</label><select id="parcMotivo">${motivos.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="form-group" style="flex:2"><label>Observação</label><input type="text" id="parcObs" placeholder="Detalhes adicionais..."></div>
    </div>
    <div style="border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:16px;background:#fff">
      <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:10px">📎 Anexo / Comprovante (opcional)</div>
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <label style="cursor:pointer;display:flex;align-items:center;gap:8px;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;color:#64748b"
          onmouseover="this.style.borderColor='#0056b3';this.style.color='#0056b3'"
          onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#64748b'">
          📷 Selecionar Imagem
          <input type="file" id="parcImagem" accept="image/*" style="display:none" onchange="previewImagemParcial(this)">
        </label>
        <div id="parcImagemPreview" style="display:none;position:relative">
          <img id="parcImagemImg" style="max-width:120px;max-height:90px;border-radius:8px;border:2px solid #e2e8f0;object-fit:cover">
          <button onclick="removerImagemParcial()" style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:14px;cursor:pointer">×</button>
        </div>
        <div id="parcUploadStatus" style="font-size:12px;color:#64748b;align-self:center"></div>
      </div>
    </div>
    <button class="btn-warning" onclick="salvarParcial()">+ Registrar Ocorrência</button>
  </div>
  <div class="card">
    <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:16px">📋 Registros</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Técnico</th><th>Saída</th><th>Retorno</th><th>Motivo</th><th>Obs</th><th>Anexo</th><th>Ação</th></tr></thead>
        <tbody id="tbodyParciais"><tr><td colspan="8" class="empty-msg">Carregando...</td></tr></tbody>
      </table>
    </div>
  </div>`;

  await _renderizarParciais();
}

async function _renderizarParciais() {
  try {
    const res = await db.listarParciais();
    const tbody = document.getElementById('tbodyParciais');
    if (!tbody) return;
    tbody.innerHTML = res.length
      ? res.map(p=>`<tr>
          <td><b>${p.data?p.data.split('-').reverse().join('/'):'—'}</b></td>
          <td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(p.funcionario):p.funcionario}</td>
          <td>${p.inicio?p.inicio.substring(0,5):'—'}</td>
          <td>${p.fim?p.fim.substring(0,5):'—'}</td>
          <td style="color:${p.motivo?.includes('Injustificado')?'#ef4444':'#ca8a04'};font-weight:600">${p.motivo||'—'}</td>
          <td style="font-size:12px;color:#64748b">${p.obs||'—'}</td>
          <td>${p.imagem_url
            ? `<a href="${p.imagem_url}" target="_blank"><img src="${p.imagem_url}" style="width:48px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;cursor:pointer"></a>`
            : '<span style="color:#94a3b8;font-size:11px">—</span>'}</td>
          <td>
            <button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick='abrirEdicaoParcial(${JSON.stringify(p).replace(/'/g,"&apos;")})'>✏️</button>
            <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirParcialConfirm(${p.id})">🗑️</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="8" class="empty-msg">Nenhum registro.</td></tr>';
  } catch(e) {}
}

// ==========================================
// ✏️ EDITAR ATRASO / PARCIAL
// ==========================================
function abrirEdicaoParcial(p) {
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[]).concat(_listas?.funcProducao||[])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();
  const motivos = ['Atraso Justificado','Atraso Injustificado','Saída Antecipada','Exame / Médico','Banco de Horas','Outros'];
  const div = document.createElement('div');
  div.id = 'modalEditParcialWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoParcial()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px">
    <div class="modal-header"><h3>✏️ Editar Ocorrência</h3><button onclick="fecharEdicaoParcial()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Técnico *</label>
        <select id="efParcFunc">${funcs.map(fn=>`<option value="${fn}" ${p.funcionario===fn?'selected':''}>${fn}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Data *</label><input type="date" id="efParcData" value="${p.data||''}"></div>
      <div class="form-row">
        <div class="form-group"><label>Saída</label><input type="time" id="efParcIni" value="${p.inicio?p.inicio.substring(0,5):''}"></div>
        <div class="form-group"><label>Retorno</label><input type="time" id="efParcFim" value="${p.fim?p.fim.substring(0,5):''}"></div>
      </div>
      <div class="form-group"><label>Motivo *</label>
        <select id="efParcMotivo">${motivos.map(m=>`<option value="${m}" ${p.motivo===m?'selected':''}>${m}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Observação</label><input type="text" id="efParcObs" value="${(p.obs||'').replace(/"/g,'&quot;')}"></div>
      ${p.imagem_url ? `<div style="font-size:11px;color:#64748b">📎 Anexo atual será mantido (edição de imagem não suportada aqui — exclua e recrie se precisar trocar).</div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoParcial(${p.id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoParcial()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarEdicaoParcial(id) {
  const funcionario = document.getElementById('efParcFunc')?.value;
  const data        = document.getElementById('efParcData')?.value;
  const inicio      = document.getElementById('efParcIni')?.value || null;
  const fim         = document.getElementById('efParcFim')?.value || null;
  const motivo      = document.getElementById('efParcMotivo')?.value;
  const obs         = document.getElementById('efParcObs')?.value?.trim() || null;
  if (!funcionario || !data || !motivo) return toast('Preencha técnico, data e motivo.','erro');
  try {
    await db.salvarParcial({ id, funcionario, data, inicio, fim, motivo, obs });
    toast('Atualizado!','sucesso');
    if (typeof sincronizarDebitoParcial === 'function') {
      await sincronizarDebitoParcial({ id, funcionario, data, inicio, fim, motivo });
    }
    fecharEdicaoParcial();
    await _renderizarParciais();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

function fecharEdicaoParcial() { document.getElementById('modalEditParcialWrap')?.remove(); }

function previewImagemParcial(input) {
  const file = input.files[0]; if (!file) return;
  const wrap = document.getElementById('parcImagemPreview');
  const img  = document.getElementById('parcImagemImg');
  const status = document.getElementById('parcUploadStatus');
  const reader = new FileReader();
  reader.onload = e => { img.src=e.target.result; wrap.style.display='block'; status.innerText=`${file.name} (${(file.size/1024).toFixed(0)} KB)`; };
  reader.readAsDataURL(file);
}

function removerImagemParcial() {
  document.getElementById('parcImagem').value = '';
  document.getElementById('parcImagemPreview').style.display = 'none';
  document.getElementById('parcImagemImg').src = '';
  document.getElementById('parcUploadStatus').innerText = '';
}

async function _comprimirImagem(file, maxWidth=800, qualidade=0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w=img.width, h=img.height;
        if (w>maxWidth) { h=Math.round(h*maxWidth/w); w=maxWidth; }
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(blob=>{ if(!blob) return reject(new Error('Falha')); resolve(blob); },'image/jpeg',qualidade);
      };
      img.onerror=reject; img.src=e.target.result;
    };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}

async function _uploadImagemParcial(file, funcionario, data) {
  const status = document.getElementById('parcUploadStatus');
  if (status) status.innerText='Comprimindo imagem...';
  const blob = await _comprimirImagem(file);
  if (status) status.innerText=`Enviando... (${(blob.size/1024).toFixed(0)} KB)`;
  const ts   = Date.now();
  const nome = `parciais/${data}_${funcionario.replace(/\s/g,'_')}_${ts}.jpg`;
  const url  = `${SUPABASE_URL}/storage/v1/object/rh-anexos/${nome}`;
  const res  = await fetch(url, {
    method:'POST',
    headers:{ 'apikey':SUPABASE_KEY, 'Authorization':'Bearer '+SUPABASE_KEY, 'Content-Type':'image/jpeg', 'x-upsert':'true' },
    body: blob
  });
  if (!res.ok) throw new Error('Upload falhou: '+(await res.text()));
  return `${SUPABASE_URL}/storage/v1/object/public/rh-anexos/${nome}`;
}

async function salvarParcial() {
  const func=document.getElementById('parcFunc')?.value;
  const dt=document.getElementById('parcData')?.value;
  const ini=document.getElementById('parcIni')?.value;
  const fim=document.getElementById('parcFim')?.value;
  const motivo=document.getElementById('parcMotivo')?.value;
  if (!func||!dt||!motivo) return toast('Preencha funcionário, data e motivo.','erro');

  const btn=document.querySelector('#painelParciais .btn-warning');
  if (btn) { btn.disabled=true; btn.innerText='Salvando...'; }

  try {
    let imagemUrl=null;
    const file=document.getElementById('parcImagem')?.files[0];
    if (file) {
      try { imagemUrl=await _uploadImagemParcial(file,func,dt); const s=document.getElementById('parcUploadStatus'); if(s) s.innerText='✅ Enviada!'; }
      catch(e) { console.error(e); toast('Imagem não enviada, mas registro salvo.','erro'); }
    }
    const res = await db.salvarParcial({ funcionario:func, data:dt, inicio:ini||null, fim:fim||null,
      motivo, obs:document.getElementById('parcObs')?.value||null, imagem_url:imagemUrl });
    toast('Registrado!','sucesso');
    if (typeof sincronizarDebitoParcial === 'function') {
      const novoId = res && res[0] ? res[0].id : null;
      if (novoId) await sincronizarDebitoParcial({ id:novoId, funcionario:func, data:dt, inicio:ini||null, fim:fim||null, motivo });
    }
    ['parcFunc','parcData','parcIni','parcFim','parcObs'].forEach(id=>{ const el=document.getElementById(id); if(el){if(el.tagName==='SELECT') el.selectedIndex=0; else el.value='';} });
    removerImagemParcial();
    await _renderizarParciais();
  } catch(e) { toast('Erro ao registrar.','erro'); console.error(e); }
  if (btn) { btn.disabled=false; btn.innerText='+ Registrar Ocorrência'; }
}

function excluirParcialConfirm(id) {
  confirmarExclusao('Excluir este registro?', async()=>{
    try {
      await db.excluirParcial(id);
      if (typeof removerDebitoParcial === 'function') await removerDebitoParcial(id);
      toast('Removido!','sucesso'); await _renderizarParciais();
    }
    catch(e) { toast('Erro.','erro'); }
  });
}

// Compatibilidade
async function excluirParcial(id) { excluirParcialConfirm(id); }
async function excluirFeriado(id) { excluirFeriadoConfirm(id); }
async function excluirFerias(id)  { excluirFeriasConfirm(id); }
