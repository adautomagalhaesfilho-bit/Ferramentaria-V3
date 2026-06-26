// ==========================================
// 👥 RH.JS — Funcionários + RH V3
// ==========================================

var _todosFuncionarios = [];
var _turnos = ['5x2','Turma A','Turma B','6x1','Estágio'];
var _setores = ['Usinagem','Bancada','Projeto','Projeto / Desenvolvimento','Produção','Supervisão'];
var _cargos  = ['Ferramenteiro','Técnico de Ferramentaria','Torneiro Mecânico','Fresador',
                'Retificador','Operador de Injetora','Estagiário','Supervisor','Encarregado','Outros'];

// ==========================================
// 👥 LISTA DE FUNCIONÁRIOS
// ==========================================
async function carregarFuncionariosRH() {
  const el = document.getElementById('listaFuncionarios');
  if (!el) return;
  el.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>';
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
        <button class="btn-icon" onclick="event.stopPropagation();abrirFichaFuncionario(${f.id},'${f._origem}')">👁️</button>
        <button class="btn-icon danger" onclick="event.stopPropagation();excluirFuncConfirm(${f.id},'${f._origem}')">🗑️</button>
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
  <div class="modal" style="display:block;max-width:560px">
    <div class="modal-header">
      <h3>👤 Novo Funcionário</h3>
      <button onclick="fecharModalFunc()">✕</button>
    </div>
    <div class="modal-body">
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
        <div class="form-group">
          <label>Origem</label>
          <select id="fnOrigem">
            <option value="Ferramentaria">Ferramentaria</option>
            <option value="Producao">Produção</option>
          </select>
        </div>
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
  const origem   = document.getElementById('fnOrigem')?.value;

  if (!nome) return toast('Informe o nome.','erro');

  try {
    if (origem === 'Producao') {
      await db.salvarProdTecnico({ nome, turno, supervisor:sup, ativo:true });
    } else {
      await db.salvarFuncionario({ nome, setor, turno, cargo, supervisor:sup,
        matricula, admissao, ativo:true });
    }
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
async function abrirFichaFuncionario(id, origem) {
  const div = document.createElement('div');
  div.id = 'modalFichaFuncWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharFichaFunc()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:620px;max-height:90vh;overflow-y:auto">
    <div class="modal-header">
      <h3>👤 Ficha do Funcionário</h3>
      <button onclick="fecharFichaFunc()">✕</button>
    </div>
    <div class="modal-body" id="fichaFuncCorpo">
      <div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>
    </div>
  </div>`;
  document.body.appendChild(div);

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

    if (!f) { document.getElementById('fichaFuncCorpo').innerHTML='<div class="empty-msg">Não encontrado.</div>'; return; }

    // Busca histórico de turno
    let histTurno = [];
    try {
      histTurno = await db._get('funcionario_turno_historico',
        'funcionario_id=eq.' + id + '&order=data_inicio.desc', '*') || [];
    } catch(e) {}

    const cor = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6',
      Produção:'#10b981', Supervisão:'#f59e0b' }[f.setor] || '#64748b';

    const fmtDt = d => d ? d.split('-').reverse().join('/') : '—';
    const editando = f._origem === 'Ferramentaria';

    document.getElementById('fichaFuncCorpo').innerHTML = `
    <!-- CABEÇALHO -->
    <div style="background:linear-gradient(135deg,${cor}20,${cor}05);border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid ${cor}30">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:22px;font-weight:700;color:#1e3a5f">${f.nome}</div>
          ${f.matricula?`<div style="font-size:13px;color:#64748b;margin-top:2px">Matrícula: <b>#${f.matricula}</b></div>`:''}
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <span style="background:${cor}20;color:${cor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700">${f.setor||'—'}</span>
            <span style="background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600">⏰ ${f.turno||'—'}</span>
            <span class="${f.ativo?'badge-ativo':'badge-inativo'}">${f.ativo?'ATIVO':'INATIVO'}</span>
          </div>
        </div>
        ${editando ? `<button class="btn-primary" style="font-size:12px;padding:8px 14px" onclick="abrirEdicaoFuncionario(${JSON.stringify(f).replace(/"/g,'&quot;')})">✏️ Editar</button>` : ''}
      </div>
    </div>

    <!-- DADOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
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
        ${editando ? `<button class="btn-secondary" style="margin-top:10px;font-size:11px;padding:5px 10px" onclick="abrirModalTrocaTurno(${id},'${f.turno||''}')">🔄 Registrar Mudança de Turno</button>` : ''}
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
    </div>`;

  } catch(e) {
    document.getElementById('fichaFuncCorpo').innerHTML = '<div class="empty-msg">Erro ao carregar.</div>';
    console.error(e);
  }
}

function fecharFichaFunc() {
  document.getElementById('modalFichaFuncWrap')?.remove();
}

// ==========================================
// ✏️ EDITAR FUNCIONÁRIO
// ==========================================
function abrirEdicaoFuncionario(f) {
  const div = document.createElement('div');
  div.id = 'modalEditFuncWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoFunc()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:560px">
    <div class="modal-header">
      <h3>✏️ Editar — ${f.nome}</h3>
      <button onclick="fecharEdicaoFunc()">✕</button>
    </div>
    <div class="modal-body">
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

  if (!nome) return toast('Informe o nome.','erro');
  try {
    await db.salvarFuncionario({ id, nome, setor, turno, cargo, supervisor:sup,
      matricula, admissao, demissao: demissao||null, ativo });
    toast('Funcionário atualizado!','sucesso');
    fecharEdicaoFunc();
    fecharFichaFunc();
    carregarFuncionariosRH();
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

async function excluirFuncConfirm(id, origem) {
  confirmarExclusao('Remover este funcionário?', async () => {
    try {
      if (origem==='Producao') await db.excluirProdTecnico(id);
      else await db.excluirFuncionario(id);
      toast('Removido!','sucesso');
      carregarFuncionariosRH();
    } catch(e) { toast('Erro.','erro'); }
  });
}

// Mantém compatibilidade com chamada antiga
function editarFuncAdmin(f) { abrirEdicaoFuncionario(f); }
async function excluirFuncAdmin(id, origem) { excluirFuncConfirm(id, origem); }

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
  if (aba==='feriados')       carregarFeriados();
  else if (aba==='ausencias') carregarFerias();
  else if (aba==='parciais')  carregarParciais();
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
          <td><b>${f.funcionario}</b></td>
          <td>${f.inicio?f.inicio.split('-').reverse().join('/'):'—'}</td>
          <td>${f.fim?f.fim.split('-').reverse().join('/'):'—'}</td>
          <td style="color:${f.motivo?.includes('Falta')?'#ef4444':'#059669'};font-weight:600">${f.motivo}</td>
          <td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirFeriasConfirm(${f.id})">🗑️</button></td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="empty-msg">Nenhum registro.</td></tr>';
  } catch(e) {}
}

async function salvarFerias() {
  const func=document.getElementById('ferFunc')?.value, ini=document.getElementById('ferIni')?.value,
        fim=document.getElementById('ferFim')?.value, motivo=document.getElementById('ferMotivo')?.value;
  if (!func||!ini||!fim) return toast('Preencha todos os campos.','erro');
  try { await db.salvarFerias({funcionario:func,inicio:ini,fim,motivo}); toast('Registrado!','sucesso'); carregarFerias(); }
  catch(e) { toast('Erro.','erro'); }
}

function excluirFeriasConfirm(id) {
  confirmarExclusao('Excluir este registro?', async()=>{
    try { await db.excluirFerias(id); toast('Removido!','sucesso'); carregarFerias(); } catch(e){}
  });
}

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
          <td>${p.funcionario}</td>
          <td>${p.inicio?p.inicio.substring(0,5):'—'}</td>
          <td>${p.fim?p.fim.substring(0,5):'—'}</td>
          <td style="color:${p.motivo?.includes('Injustificado')?'#ef4444':'#ca8a04'};font-weight:600">${p.motivo||'—'}</td>
          <td style="font-size:12px;color:#64748b">${p.obs||'—'}</td>
          <td>${p.imagem_url
            ? `<a href="${p.imagem_url}" target="_blank"><img src="${p.imagem_url}" style="width:48px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;cursor:pointer"></a>`
            : '<span style="color:#94a3b8;font-size:11px">—</span>'}</td>
          <td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirParcialConfirm(${p.id})">🗑️</button></td>
        </tr>`).join('')
      : '<tr><td colspan="8" class="empty-msg">Nenhum registro.</td></tr>';
  } catch(e) {}
}

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
    await db.salvarParcial({ funcionario:func, data:dt, inicio:ini||null, fim:fim||null,
      motivo, obs:document.getElementById('parcObs')?.value||null, imagem_url:imagemUrl });
    toast('Registrado!','sucesso');
    ['parcFunc','parcData','parcIni','parcFim','parcObs'].forEach(id=>{ const el=document.getElementById(id); if(el){if(el.tagName==='SELECT') el.selectedIndex=0; else el.value='';} });
    removerImagemParcial();
    await _renderizarParciais();
  } catch(e) { toast('Erro ao registrar.','erro'); console.error(e); }
  if (btn) { btn.disabled=false; btn.innerText='+ Registrar Ocorrência'; }
}

function excluirParcialConfirm(id) {
  confirmarExclusao('Excluir este registro?', async()=>{
    try { await db.excluirParcial(id); toast('Removido!','sucesso'); await _renderizarParciais(); }
    catch(e) { toast('Erro.','erro'); }
  });
}

// Compatibilidade
async function excluirParcial(id) { excluirParcialConfirm(id); }
async function excluirFeriado(id) { excluirFeriadoConfirm(id); }
async function excluirFerias(id)  { excluirFeriasConfirm(id); }
