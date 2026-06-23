// ==========================================
// 👥 RH.JS — Gestão e RH
// ==========================================

function inicializarRH() { carregarPainelRH('feriados'); }

function mudarTabRH(aba, elBtn) {
  document.querySelectorAll('.painel-rh').forEach(p => p.classList.remove('ativo'));
  document.querySelectorAll('.tab-rh').forEach(b => b.classList.remove('ativa'));
  document.getElementById('painel' + aba.charAt(0).toUpperCase() + aba.slice(1))?.classList.add('ativo');
  if (elBtn) elBtn.classList.add('ativa');
  carregarPainelRH(aba);
}

function carregarPainelRH(aba) {
  if (aba==='feriados') carregarFeriados();
  else if (aba==='funcionarios') carregarFuncionariosRH();
  else if (aba==='ausencias') carregarFerias();
  else if (aba==='parciais') carregarParciais();
  else if (aba==='maquinas') carregarMaquinasRH();
  else if (aba==='prodAdmin') carregarProdAdmin();
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
  const dt=document.getElementById('ferData').value, nm=document.getElementById('ferNome').value;
  if (!dt||!nm) return toast('Preencha data e nome.','erro');
  try { await db.salvarFeriado(dt,nm); toast('Feriado adicionado!','sucesso'); document.getElementById('ferNome').value=''; carregarFeriados(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirFeriado(id) { confirmarExclusao('Excluir este feriado?', async()=>{ try { await db.excluirFeriado(id); toast('Removido!','sucesso'); carregarFeriados(); } catch(e){} }); }

// FUNCIONÁRIOS
async function carregarFuncionariosRH() {
  const el = document.getElementById('painelFuncionarios');
  if (!el) return;
  const setores = ['Usinagem','Bancada','Projeto / Desenvolvimento','Supervisão','Outros'];
  const turnos  = ['ADM','Turma A','Turma B'];
  const funcOpts = (_listas?.funcionarios||[]).concat(_listas?.funcBancada||[]).concat(_listas?.funcProjeto||[]).filter((v,i,a)=>a.indexOf(v)===i);
  el.innerHTML = `<div class="card">
    <div class="form-row">
      <div class="form-group"><label>Técnico</label><select id="rhFunc"><option value="">Selecione...</option>${funcOpts.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></div>
      <div class="form-group"><label>Setor</label><select id="rhSetor">${setores.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
      <div class="form-group"><label>Turno</label><select id="rhTurno">${turnos.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Admissão</label><input type="date" id="rhAdm"></div>
      <div class="form-group"><label>Desligamento</label><input type="date" id="rhDem"></div>
      <button class="btn-success" onclick="salvarFuncionarioRH()">Salvar</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Setor</th><th>Turno</th><th>Período</th><th>Ações</th></tr></thead>
    <tbody id="tbodyFuncRH"><tr><td colspan="5" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>`;
  try {
    const res = await db.listarFuncionarios();
    document.getElementById('tbodyFuncRH').innerHTML = res.length
      ? res.map(f=>`<tr style="${f.demissao?'opacity:0.5':''}"><td><b>${f.nome}</b>${f.demissao?'<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px">Desligado</span>':''}</td><td>${f.setor||'—'}</td><td><span style="background:#e8f0fe;padding:3px 8px;border-radius:6px;font-size:12px;color:#0056b3;font-weight:600">${f.turno||'ADM'}</span></td><td style="font-size:11px;color:#64748b">${f.admissao?f.admissao.split('-').reverse().join('/'):'—'} ${f.demissao?' até '+f.demissao.split('-').reverse().join('/'):'- Atual'}</td><td><button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarFuncRH(${JSON.stringify(f).replace(/"/g,'&quot;')})">✏️</button><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirFuncRH(${f.id})">🗑️</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty-msg">Nenhum funcionário.</td></tr>';
  } catch(e) {}
}
function editarFuncRH(f) {
  const sel = document.getElementById('rhFunc');
  if (sel) for (let i=0;i<sel.options.length;i++) if (sel.options[i].value===f.nome) { sel.selectedIndex=i; break; }
  const ss = document.getElementById('rhSetor'); if (ss) for (let i=0;i<ss.options.length;i++) if (ss.options[i].value===f.setor) { ss.selectedIndex=i; break; }
  const st = document.getElementById('rhTurno'); if (st) for (let i=0;i<st.options.length;i++) if (st.options[i].value===f.turno) { st.selectedIndex=i; break; }
  const a=document.getElementById('rhAdm'); if (a) a.value=f.admissao||'';
  const d=document.getElementById('rhDem'); if (d) d.value=f.demissao||'';
}
async function salvarFuncionarioRH() {
  const nome=document.getElementById('rhFunc').value; if (!nome) return toast('Selecione o técnico.','erro');
  try { await db.salvarFuncionario({ nome, setor:document.getElementById('rhSetor').value, turno:document.getElementById('rhTurno').value, admissao:document.getElementById('rhAdm').value||null, demissao:document.getElementById('rhDem').value||null, ativo:!document.getElementById('rhDem').value }); toast('Salvo!','sucesso'); carregarFuncionariosRH(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirFuncRH(id) { confirmarExclusao('Remover este registro?', async()=>{ try { await db.excluirFuncionario(id); toast('Removido!','sucesso'); carregarFuncionariosRH(); } catch(e){} }); }

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
      <button class="btn-success" onclick="salvarFerias()">+ Registar</button>
    </div>
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
  const func=document.getElementById('ferFunc').value, ini=document.getElementById('ferIni').value, fim=document.getElementById('ferFim').value, motivo=document.getElementById('ferMotivo').value;
  if (!func||!ini||!fim) return toast('Preencha todos os campos.','erro');
  try { await db.salvarFerias({funcionario:func,inicio:ini,fim,motivo}); toast('Registado!','sucesso'); carregarFerias(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirFerias(id) { confirmarExclusao('Excluir este registro?', async()=>{ try { await db.excluirFerias(id); toast('Removido!','sucesso'); carregarFerias(); } catch(e){} }); }

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
      <button class="btn-warning" onclick="salvarParcial()" style="background:#eab308">+ Registar</button>
    </div>
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
  const func=document.getElementById('parcFunc').value, dt=document.getElementById('parcData').value, ini=document.getElementById('parcIni').value, fim=document.getElementById('parcFim').value, motivo=document.getElementById('parcMotivo').value;
  if (!func||!dt||!ini||!fim) return toast('Preencha funcionário, data e horários.','erro');
  try { await db.salvarParcial({funcionario:func,data:dt,inicio:ini,fim,motivo,obs:document.getElementById('parcObs').value}); toast('Registado!','sucesso'); carregarParciais(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirParcial(id) { confirmarExclusao('Excluir este registro?', async()=>{ try { await db.excluirParcial(id); toast('Removido!','sucesso'); carregarParciais(); } catch(e){} }); }

// MÁQUINAS
async function carregarMaquinasRH() {
  const el = document.getElementById('painelMaquinas');
  if (!el) return;
  const maqOpts = (_listas?.maquinas||[]).filter(m=>m!=='Sem Máquina');
  const turnos  = ['ADM','Turma A','Turma B'];
  el.innerHTML = `<div class="card">
    <div class="form-row">
      <div class="form-group"><label>Máquina</label><select id="maqNome"><option value="">Selecione...</option>${maqOpts.map(m=>`<option value="${m}">${m}</option>`).join('')}</select></div>
      <div class="form-group"><label>Turno</label><select id="maqTurno">${turnos.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Em Operação</label><input type="date" id="maqAdm"></div>
      <div class="form-group"><label>Desativação</label><input type="date" id="maqDes"></div>
      <button class="btn-success" onclick="salvarMaquinaRH()">Salvar</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Máquina</th><th>Turno</th><th>Cap./Dia</th><th>Período</th><th>Ações</th></tr></thead>
    <tbody id="tbodyMaquinas"><tr><td colspan="5" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>`;
  try {
    const res = await db.listarMaquinas();
    document.getElementById('tbodyMaquinas').innerHTML = res.length
      ? res.map(m=>`<tr style="${m.desativacao?'opacity:0.5':''}"><td><b>${m.nome}</b>${m.desativacao?'<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px">Desativada</span>':''}</td><td><span style="background:#e8f0fe;padding:3px 8px;border-radius:6px;font-size:12px;color:#0056b3;font-weight:600">${m.turno||'ADM'}</span></td><td style="font-weight:bold;color:#0056b3">${m.cap_liquida||508} min/dia</td><td style="font-size:11px;color:#64748b">${m.admissao?m.admissao.split('-').reverse().join('/'):'—'} ${m.desativacao?' até '+m.desativacao.split('-').reverse().join('/'):'- Atual'}</td><td><button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarMaqRH(${JSON.stringify(m).replace(/"/g,'&quot;')})">✏️</button><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirMaqRH(${m.id})">🗑️</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty-msg">Nenhuma máquina.</td></tr>';
  } catch(e) {}
}
function editarMaqRH(m) {
  const sel=document.getElementById('maqNome'); if(sel) for(let i=0;i<sel.options.length;i++) if(sel.options[i].value===m.nome){sel.selectedIndex=i;break;}
  const st=document.getElementById('maqTurno'); if(st) for(let i=0;i<st.options.length;i++) if(st.options[i].value===m.turno){st.selectedIndex=i;break;}
  const a=document.getElementById('maqAdm'); if(a) a.value=m.admissao||'';
  const d=document.getElementById('maqDes'); if(d) d.value=m.desativacao||'';
}
async function salvarMaquinaRH() {
  const nm=document.getElementById('maqNome').value; if(!nm) return toast('Selecione a máquina.','erro');
  try { await db.salvarMaquina({nome:nm,turno:document.getElementById('maqTurno').value,admissao:document.getElementById('maqAdm').value||null,desativacao:document.getElementById('maqDes').value||null,ativo:!document.getElementById('maqDes').value}); toast('Salvo!','sucesso'); carregarMaquinasRH(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirMaqRH(id) { confirmarExclusao('Remover esta máquina?', async()=>{ try { await db.excluirMaquina(id); toast('Removido!','sucesso'); carregarMaquinasRH(); } catch(e){} }); }

// PRODUÇÃO ADMIN
async function carregarProdAdmin() {
  const el = document.getElementById('painelProdAdmin');
  if (!el) return;
  el.innerHTML = `<div class="card">
    <h3 style="margin-bottom:16px;color:#1e3a5f">🏭 Gestão de Técnicos de Produção</h3>
    <div class="form-row">
      <div class="form-group"><label>Nome</label><input type="text" id="prodTecNome" placeholder="Nome do técnico"></div>
      <div class="form-group"><label>Turno</label><select id="prodTecTurno"><option value="5x2">5x2</option><option value="6x1">6x1</option><option value="2x2">2x2</option></select></div>
      <div class="form-group"><label>Supervisor</label><input type="text" id="prodTecSup" placeholder="Nome do supervisor"></div>
      <button class="btn-success" onclick="salvarProdTecnico()">+ Adicionar</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Turno</th><th>Supervisor</th><th>Ação</th></tr></thead>
    <tbody id="tbodyProdTec"><tr><td colspan="4" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>
  <div class="card" style="margin-top:0">
    <h3 style="margin-bottom:16px;color:#1e3a5f">🏭 Gestão de Injetoras</h3>
    <div class="form-row">
      <div class="form-group"><label>Nome</label><input type="text" id="injNome" placeholder="Ex: 160-01"></div>
      <div class="form-group"><label>Tonelagem</label><input type="number" id="injTon" placeholder="Ex: 160"></div>
      <div class="form-group"><label>Fabricante</label><input type="text" id="injFab" placeholder="Ex: Romi"></div>
      <button class="btn-success" onclick="salvarInjetora()">+ Adicionar</button>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Ton.</th><th>Fabricante</th><th>Ação</th></tr></thead>
    <tbody id="tbodyInjetoras"><tr><td colspan="4" class="empty-msg">Carregando...</td></tr></tbody></table></div>
  </div>`;
  try {
    const tecs = await db.listarProdTecnicos();
    document.getElementById('tbodyProdTec').innerHTML = tecs.length ? tecs.map(t=>`<tr><td><b>${t.nome}</b></td><td>${t.turno}</td><td>${t.supervisor||'—'}</td><td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirProdTecnico(${t.id})">X</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty-msg">Nenhum técnico.</td></tr>';
    const injs = await db.listarProdInjetoras();
    document.getElementById('tbodyInjetoras').innerHTML = injs.length ? injs.map(i=>`<tr><td><b>${i.nome}</b></td><td>${i.tonelagem||'—'}</td><td>${i.fabricante||'—'}</td><td><button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirInjetora(${i.id})">X</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty-msg">Nenhuma injetora.</td></tr>';
  } catch(e) {}
}
async function salvarProdTecnico() {
  const nm=document.getElementById('prodTecNome').value; if(!nm) return toast('Informe o nome.','erro');
  try { await db.salvarProdTecnico({nome:nm,turno:document.getElementById('prodTecTurno').value,supervisor:document.getElementById('prodTecSup').value||null}); toast('Adicionado!','sucesso'); document.getElementById('prodTecNome').value=''; carregarProdAdmin(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirProdTecnico(id) { confirmarExclusao('Remover este técnico?', async()=>{ try { await db.excluirProdTecnico(id); toast('Removido!','sucesso'); carregarProdAdmin(); } catch(e){} }); }
async function salvarInjetora() {
  const nm=document.getElementById('injNome').value; if(!nm) return toast('Informe o nome.','erro');
  try { await db.salvarProdInjetora({nome:nm,tonelagem:parseInt(document.getElementById('injTon').value)||null,fabricante:document.getElementById('injFab').value||null}); toast('Adicionada!','sucesso'); document.getElementById('injNome').value=''; carregarProdAdmin(); } catch(e) { toast('Erro.','erro'); }
}
async function excluirInjetora(id) { confirmarExclusao('Remover esta injetora?', async()=>{ try { await db.excluirProdInjetora(id); toast('Removida!','sucesso'); carregarProdAdmin(); } catch(e){} }); }
