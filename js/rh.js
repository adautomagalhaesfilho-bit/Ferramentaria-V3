// ==========================================
// 👥 RH.JS — Funcionários + RH V3
// ==========================================

// ==========================================
// 👥 FUNCIONÁRIOS ADMIN (lista limpa unificada)
// ==========================================
var _todosFuncionarios = [];

async function carregarFuncionariosRH() {
  const el = document.getElementById('listaFuncionarios');
  if (!el) return;
  el.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>';
  try {
    // Carrega ferramentaria + produção
    const [ferr, prod] = await Promise.all([
      db.listarFuncionarios(),
      db.listarProdTecnicos()
    ]);
    _todosFuncionarios = [
      ...(ferr||[]).map(f => ({ ...f, _origem:'Ferramentaria' })),
      ...(prod||[]).map(t => ({ id:t.id, nome:t.nome, setor:'Produção', turno:t.turno, supervisor:t.supervisor, ativo:t.ativo, _origem:'Producao' }))
    ];
    filtrarFuncionarios();
  } catch(e) {
    el.innerHTML='<div class="empty-msg">Erro ao carregar.</div>';
    toast('Erro ao carregar funcionários.','erro');
  }
}

function filtrarFuncionarios() {
  const el = document.getElementById('listaFuncionarios');
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

  const coresSe = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', Produção:'#10b981', 'Projeto / Desenvolvimento':'#8b5cf6' };
  el.innerHTML = filtrado.map(f => {
    const cor = coresSe[f.setor]||'#64748b';
    const sub = [f.setor, f.turno, f.supervisor?'Sup: '+f.supervisor:null].filter(Boolean).join(' | ');
    const acoes = f._origem==='Producao'
      ? `<button class="btn-icon danger" onclick="excluirFuncAdmin(${f.id},'Producao')">🗑️</button>`
      : `<button class="btn-icon" onclick="editarFuncAdmin(${JSON.stringify(f).replace(/"/g,'&quot;')})">✏️</button>
         <button class="btn-icon danger" onclick="excluirFuncAdmin(${f.id},'Ferramentaria')">🗑️</button>`;
    return `<div class="lista-item">
      <div class="lista-item-info">
        <div class="lista-item-nome">${f.nome}</div>
        <div class="lista-item-sub" style="display:flex;gap:8px;align-items:center;margin-top:3px">
          <span style="background:${cor}15;color:${cor};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">${f.setor||'—'}</span>
          <span style="font-size:11px;color:#94a3b8">${f.turno||''} ${f.supervisor?'| Sup: '+f.supervisor:''}</span>
        </div>
      </div>
      <div class="lista-item-acoes">
        <span class="${f.ativo?'badge-ativo':'badge-inativo'}">${f.ativo?'ATIVO':'INATIVO'}</span>
        ${acoes}
      </div>
    </div>`;
  }).join('');
}

function abrirFormFuncionario() {
  const setores = ['Usinagem','Bancada','Projeto / Desenvolvimento','Produção','Supervisão'];
  const turnos  = ['ADM','Turma A','Turma B','5x2','6x1','2x2'];
  const origem  = prompt('Origem:\n1 - Ferramentaria (Usinagem/Bancada/Projeto)\n2 - Produção\n\nDigite 1 ou 2:');
  if (!origem) return;

  if (origem.trim()==='2') {
    const nome = prompt('Nome do técnico:');
    if (!nome||!nome.trim()) return;
    const turno = prompt('Turno (5x2 / 6x1 / 2x2):') || '5x2';
    const sup   = prompt('Supervisor (opcional):') || null;
    db.salvarProdTecnico({ nome:nome.trim(), turno, supervisor:sup })
      .then(()=>{ toast('Adicionado!','sucesso'); carregarFuncionariosRH(); })
      .catch(()=>toast('Erro.','erro'));
  } else {
    const nome   = prompt('Nome completo:');
    if (!nome||!nome.trim()) return;
    const setor  = prompt('Setor:\n'+setores.join('\n')) || 'Usinagem';
    const turno  = prompt('Turno:\n'+turnos.join('\n'))  || 'ADM';
    const admiss = prompt('Data de admissão (AAAA-MM-DD):') || null;
    db.salvarFuncionario({ nome:nome.trim(), setor, turno, admissao:admiss, ativo:true })
      .then(()=>{ toast('Adicionado!','sucesso'); carregarFuncionariosRH(); })
      .catch(()=>toast('Erro.','erro'));
  }
}

function editarFuncAdmin(f) {
  const nome   = prompt('Nome:', f.nome);
  if (!nome) return;
  const setores = ['Usinagem','Bancada','Projeto / Desenvolvimento','Supervisão'];
  const setor  = prompt('Setor:\n'+setores.join('\n'), f.setor)||f.setor;
  const turno  = prompt('Turno (ADM / Turma A / Turma B):', f.turno)||f.turno;
  const dem    = prompt('Data desligamento (AAAA-MM-DD, deixe vazio se ativo):', f.demissao||'');
  db.salvarFuncionario({ id:f.id, nome:nome.trim(), setor, turno, admissao:f.admissao||null, demissao:dem||null, ativo:!dem })
    .then(()=>{ toast('Atualizado!','sucesso'); carregarFuncionariosRH(); })
    .catch(()=>toast('Erro.','erro'));
}

async function excluirFuncAdmin(id, origem) {
  confirmarExclusao('Remover este funcionário?', async () => {
    try {
      if (origem==='Producao') await db.excluirProdTecnico(id);
      else await db.excluirFuncionario(id);
      toast('Removido!','sucesso'); carregarFuncionariosRH();
    } catch(e) { toast('Erro.','erro'); }
  });
}

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
  if (aba==='feriados') carregarFeriados();
  else if (aba==='ausencias') carregarFerias();
  else if (aba==='parciais') carregarParciais();
}

// FERIADOS
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
      ? res.map(f=>`<tr><td><b>${f.data?f.data.split('-').reverse().join('/'):'—'}</b></td><td>${f.nome}</td><td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirFeriado(${f.id})">X</button></td></tr>`).join('')
      : '<tr><td colspan="3" class="empty-msg">Nenhum feriado.</td></tr>';
  } catch(e) {}
}
async function salvarFeriado() {
  const dt=document.getElementById('ferData')?.value, nm=document.getElementById('ferNome')?.value;
  if (!dt||!nm) return toast('Preencha data e nome.','erro');
  try { await db.salvarFeriado(dt,nm); toast('Adicionado!','sucesso'); document.getElementById('ferNome').value=''; carregarFeriados(); }
  catch(e) { toast('Erro.','erro'); }
}
async function excluirFeriado(id) { confirmarExclusao('Excluir este feriado?',async()=>{ try{await db.excluirFeriado(id);toast('Removido!','sucesso');carregarFeriados();}catch(e){} }); }

// AUSÊNCIAS
async function carregarFerias() {
  const el = document.getElementById('painelAusencias');
  if (!el) return;
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[]).concat(_listas?.funcProjeto||[]).filter((v,i,a)=>a.indexOf(v)===i);
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
      ? res.map(f=>`<tr><td><b>${f.funcionario}</b></td><td>${f.inicio?f.inicio.split('-').reverse().join('/'):'—'}</td><td>${f.fim?f.fim.split('-').reverse().join('/'):'—'}</td><td style="color:${f.motivo?.includes('Falta')?'#ef4444':'#059669'};font-weight:600">${f.motivo}</td><td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirFerias(${f.id})">X</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty-msg">Nenhum registro.</td></tr>';
  } catch(e) {}
}
async function salvarFerias() {
  const func=document.getElementById('ferFunc')?.value,ini=document.getElementById('ferIni')?.value,fim=document.getElementById('ferFim')?.value,motivo=document.getElementById('ferMotivo')?.value;
  if (!func||!ini||!fim) return toast('Preencha todos os campos.','erro');
  try { await db.salvarFerias({funcionario:func,inicio:ini,fim,motivo}); toast('Registrado!','sucesso'); carregarFerias(); }
  catch(e) { toast('Erro.','erro'); }
}
async function excluirFerias(id) { confirmarExclusao('Excluir este registro?',async()=>{ try{await db.excluirFerias(id);toast('Removido!','sucesso');carregarFerias();}catch(e){} }); }

// PARCIAIS
async function carregarParciais() {
  const el = document.getElementById('painelParciais');
  if (!el) return;
  const funcs = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[]).concat(_listas?.funcProjeto||[]).filter((v,i,a)=>a.indexOf(v)===i);
  const motivos = ['Atraso Justificado','Atraso Injustificado','Saída Antecipada','Exame / Médico','Banco de Horas','Outros'];
  el.innerHTML = `<div class="card" style="background:#fefce8">
    <div class="form-row">
      <div class="form-group"><label>Técnico</label><select id="parcFunc"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></div>
      <div class="form-group"><label>Data</label><input type="date" id="parcData"></div>
      <div class="form-group"><label>Saída</label><input type="time" id="parcIni"></div>
      <div class="form-group"><label>Retorno</label><input type="time" id="parcFim"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Motivo</label><select id="parcMotivo">${motivos.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="form-group" style="flex:2"><label>Observação</label><input type="text" id="parcObs"></div>
    </div>
    <button class="btn-warning" onclick="salvarParcial()" style="margin-bottom:16px">+ Registrar</button>
  </div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Data</th><th>Técnico</th><th>Saída</th><th>Retorno</th><th>Motivo</th><th>Obs</th><th>Ação</th></tr></thead>
  <tbody id="tbodyParciais"><tr><td colspan="7" class="empty-msg">Carregando...</td></tr></tbody></table></div></div>`;
  try {
    const res = await db.listarParciais();
    document.getElementById('tbodyParciais').innerHTML = res.length
      ? res.map(p=>`<tr><td><b>${p.data?p.data.split('-').reverse().join('/'):'—'}</b></td><td>${p.funcionario}</td><td>${p.inicio?p.inicio.substring(0,5):'—'}</td><td>${p.fim?p.fim.substring(0,5):'—'}</td><td style="color:${p.motivo?.includes('Injustificado')?'#ef4444':'#ca8a04'};font-weight:600">${p.motivo||'—'}</td><td>${p.obs||'—'}</td><td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirParcial(${p.id})">X</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="empty-msg">Nenhum registro.</td></tr>';
  } catch(e) {}
}
async function salvarParcial() {
  const func=document.getElementById('parcFunc')?.value,dt=document.getElementById('parcData')?.value,ini=document.getElementById('parcIni')?.value,fim=document.getElementById('parcFim')?.value,motivo=document.getElementById('parcMotivo')?.value;
  if (!func||!dt||!ini||!fim) return toast('Preencha funcionário, data e horários.','erro');
  try { await db.salvarParcial({funcionario:func,data:dt,inicio:ini,fim,motivo,obs:document.getElementById('parcObs')?.value}); toast('Registrado!','sucesso'); carregarParciais(); }
  catch(e) { toast('Erro.','erro'); }
}
async function excluirParcial(id) { confirmarExclusao('Excluir este registro?',async()=>{ try{await db.excluirParcial(id);toast('Removido!','sucesso');carregarParciais();}catch(e){} }); }
