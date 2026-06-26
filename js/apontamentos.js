// ==========================================
// 📋 APONTAMENTOS.JS — Modal V3 + Troca de Copo
// ==========================================

var _setorAtivo = 'Usinagem';
var _dadosApontamentos = [];
var _statusForm = null;

function abrirSetor(tela) {
  const mapa = { usinagem:'Usinagem', bancada:'Bancada', projeto:'Projeto' };
  _setorAtivo = mapa[tela] || 'Usinagem';
  const icos  = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };
  const el = document.getElementById('tituloApontamentos');
  if (el) el.innerText = icos[_setorAtivo] + ' Apontamentos — ' + _setorAtivo;

  const maqWrap = document.getElementById('filtroMaqWrap');
  if (maqWrap) maqWrap.style.display = _setorAtivo==='Usinagem' ? '' : 'none';

  const selFunc = document.getElementById('apontFunc');
  if (selFunc && _listas) {
    const funcs = _setorAtivo==='Usinagem' ? _listas.funcionarios
                : _setorAtivo==='Bancada'  ? _listas.funcBancada
                : _listas.funcProjeto;
    selFunc.innerHTML = '<option value="Todos">Todos</option>' +
      (funcs||[]).map(f=>`<option value="${f}">${f}</option>`).join('');
  }

  const selMaq = document.getElementById('apontMaq');
  if (selMaq && _listas) {
    selMaq.innerHTML = '<option value="Todas">Todas</option>' +
      (_listas.maquinas||[]).filter(m=>m!=='Sem Máquina').map(m=>`<option value="${m}">${m}</option>`).join('');
  }

  const elData = document.getElementById('apontData');
  if (elData && !elData.value) elData.value = new Date().toISOString().split('T')[0];

  buscarApontamentos();
}

async function buscarApontamentos() {
  const dt  = document.getElementById('apontData')?.value;
  if (!dt) return;
  const maq = document.getElementById('apontMaq')?.value || 'Todas';
  const loader = document.getElementById('apontLoader');
  if (loader) loader.style.display = 'flex';
  document.getElementById('tbodyApontamentos').innerHTML = '';
  document.getElementById('wppArea').style.display = 'none';
  try {
    _dadosApontamentos = await db.buscarLancamentosDia(_setorAtivo, dt, maq);
    renderizarApontamentos();
  } catch(e) {
    document.getElementById('tbodyApontamentos').innerHTML = '<tr><td colspan="8" class="empty-msg">Erro ao buscar dados.</td></tr>';
    toast('Erro ao buscar lançamentos.','erro');
  }
  if (loader) loader.style.display = 'none';
}

function renderizarApontamentos() {
  const thead = document.getElementById('theadApontamentos');
  const tbody = document.getElementById('tbodyApontamentos');
  const funcFiltro = document.getElementById('apontFunc')?.value || 'Todos';
  const dados = _dadosApontamentos.filter(i => funcFiltro==='Todos' || i.funcionario===funcFiltro);

  const cabs = {
    Usinagem:'<tr><th>Job</th><th>Máquina</th><th>Técnico</th><th>Horários</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Ações</th></tr>',
    Bancada: '<tr><th>Job</th><th>Atividade</th><th>Técnico</th><th>Horários</th><th>Prod.</th><th>Troca Copo</th><th>Descrição</th><th>Ações</th></tr>',
    Projeto: '<tr><th>Job</th><th>Área</th><th>Técnico</th><th>Categoria</th><th>Descrição</th><th>Status</th><th></th><th>Ações</th></tr>'
  };
  if (thead) thead.innerHTML = cabs[_setorAtivo];

  if (!dados.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum lançamento encontrado.</td></tr>';
    document.getElementById('wppArea').style.display = 'none';
    return;
  }

  tbody.innerHTML = dados.map(item => {
    const origIdx = _dadosApontamentos.indexOf(item);
    const cor = corStatus(item.status);
    const ico = icoStatus(item.status);
    const stTxt = `<span style="color:${cor};font-weight:600;font-size:12px">${ico} ${item.status||'Em andamento'}</span>`;
    const acoes = podeEditar()
      ? `<button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarApontamento(${origIdx})">✏️</button>
         <button class="btn-danger"  style="padding:4px 8px;font-size:11px" onclick="confirmarExclusao('Excluir este lançamento?',()=>excluirApontamento(${item.id}))">🗑️</button>`
      : '';
    const job = item.job ? `<b>${item.job}</b>` : '<span style="color:#aaa">—</span>';
    const hr  = (item.horaInicio||'—') + ' às ' + (item.horaFim ? item.horaFim : '<span style="color:#f59e0b">⏳</span>');

    // Badge troca de copo (só Bancada)
    let badgeCopo = '';
    if (_setorAtivo==='Bancada') {
      if (item.trocaCopo === true || item.trocaCopo === 'true') {
        const tipoCopo = item.tipoCopo || '—';
        const cor = tipoCopo==='Novo' ? '#059669' : '#0891b2';
        const bg  = tipoCopo==='Novo' ? '#d1fae5' : '#e0f2fe';
        badgeCopo = `<span style="background:${bg};color:${cor};font-size:11px;padding:3px 8px;border-radius:10px;font-weight:700">🔄 ${tipoCopo}</span>`;
      } else {
        badgeCopo = '<span style="color:#94a3b8;font-size:11px">—</span>';
      }
    }

    if (_setorAtivo==='Usinagem')
      return `<tr><td>${job}</td><td>${item.maquina||'—'}</td><td>${item.funcionario||'—'}</td><td style="font-size:12px">${hr}</td><td>${item.tipo||'—'}</td><td style="font-size:12px;color:#64748b">${item.descricao||''}</td><td>${stTxt}</td><td>${acoes}</td></tr>`;
    if (_setorAtivo==='Bancada')
      return `<tr><td>${job}</td><td>${item.tipo||'—'}</td><td>${item.funcionario||'—'}</td><td style="font-size:12px">${hr}</td><td style="color:#10b981;font-weight:bold">${item.hrProd||'—'}</td><td>${badgeCopo}</td><td style="font-size:12px;color:#64748b">${item.descricao||''}</td><td>${acoes}</td></tr>`;
    return `<tr><td>${job}</td><td>${item.area||'—'}</td><td>${item.funcionario||'—'}</td><td>${item.tipo||'—'}</td><td style="font-size:12px;color:#64748b">${item.descricao||''}</td><td>${stTxt}</td><td></td><td>${acoes}</td></tr>`;
  }).join('');

  document.getElementById('wppArea').style.display = 'block';
}

// ==========================================
// ➕ NOVO / EDITAR — via MODAL
// ==========================================
function abrirNovoApontamento() {
  document.getElementById('formId').value = '';
  document.getElementById('formSetor').value = _setorAtivo;
  _statusForm = null;
  resetarForm();
  configurarCamposForm(_setorAtivo);
  carregarFuncionariosForm(_setorAtivo);
  document.getElementById('formData').value = document.getElementById('apontData')?.value || new Date().toISOString().split('T')[0];
  document.getElementById('tituloForm').innerText = 'Novo Lançamento — ' + _setorAtivo;
  document.getElementById('btnSalvarForm').innerText = '💾 Salvar Lançamento';
  abrirModalForm();
}

async function editarApontamento(idx) {
  const item = _dadosApontamentos[idx];
  if (!item) return;
  document.getElementById('formId').value    = item.id;
  document.getElementById('formSetor').value = _setorAtivo;
  _statusForm = item.status || 'Em andamento';
  resetarForm();
  configurarCamposForm(_setorAtivo);
  await carregarFuncionariosForm(_setorAtivo);
document.getElementById('formData').value = item.data || '';
await new Promise(r => setTimeout(r, 50));
setSelect('formFunc', item.funcionario);
  if (_setorAtivo==='Usinagem') {
    setSelect('formMaq', item.maquina);
    setSelect('formTipoUsina', item.tipo);
    document.getElementById('formHrIni').value     = item.horaInicio || '';
    document.getElementById('formHrFim').value     = item.horaFim    || '';
    document.getElementById('formTempoAuto').value = item.tempoAuto  || '';
    document.getElementById('formAlmoco').checked  = !!item.descontaAlmoco;
  } else if (_setorAtivo==='Bancada') {
    document.getElementById('formTipoBancadaInput').value = item.tipo || '';
    document.getElementById('formTipoBancada').value      = item.tipo || '';
    document.getElementById('formHrIni').value = item.horaInicio || '';
    document.getElementById('formHrFim').value = item.horaFim    || '';
    // Troca de copo
    const chkCopo = document.getElementById('formTrocaCopo');
    const grpCopo = document.getElementById('grupoTipoCopo');
    if (chkCopo) chkCopo.checked = !!(item.trocaCopo === true || item.trocaCopo === 'true');
    if (grpCopo) grpCopo.style.display = chkCopo?.checked ? '' : 'none';
    setSelect('formTipoCopo', item.tipoCopo || '');
  } else {
    setSelect('formArea', item.area);
    setSelect('formCategoria', item.tipo);
  }
  document.getElementById('formJob').value  = item.job       || '';
  document.getElementById('formDesc').value = item.descricao || '';
  atualizarBotoesStatus();
  document.getElementById('tituloForm').innerText    = 'Editar Lançamento — ' + _setorAtivo;
  document.getElementById('btnSalvarForm').innerText = '💾 Atualizar Lançamento';
  abrirModalForm();
}

function cancelarForm() { fecharModalForm(); }

// Toggle visibilidade do tipo de copo
function toggleTrocaCopo() {
  const chk  = document.getElementById('formTrocaCopo');
  const grp  = document.getElementById('grupoTipoCopo');
  if (grp) grp.style.display = chk?.checked ? '' : 'none';
  if (!chk?.checked) {
    const sel = document.getElementById('formTipoCopo');
    if (sel) sel.selectedIndex = 0;
  }
}

// ==========================================
// 💾 SALVAR
// ==========================================
async function salvarForm() {
  const setor = document.getElementById('formSetor').value || _setorAtivo;
  const id    = document.getElementById('formId').value;
  const dados = coletarDadosForm(setor);
  if (!dados) return;
  const btn = document.getElementById('btnSalvarForm');
  btn.disabled = true; btn.innerText = 'Salvando...';
  try {
    if (!id) {
      await db.salvarLancamento(dados);
      toast('Lançamento salvo!','sucesso');
      const func = document.getElementById('formFunc').value;
      const data = document.getElementById('formData').value;
      const maq  = document.getElementById('formMaq')?.value || '';
      resetarForm(); configurarCamposForm(setor);
      await carregarFuncionariosForm(setor);
      document.getElementById('formData').value = data;
      setSelect('formFunc', func);
      if (setor==='Usinagem') setSelect('formMaq', maq);
      _statusForm = null; atualizarBotoesStatus();
    } else {
      await db.atualizarLancamento(id, dados);
      toast('Lançamento atualizado!','sucesso');
      fecharModalForm();
    }
    const dt   = document.getElementById('apontData')?.value;
    const maqF = document.getElementById('apontMaq')?.value || 'Todas';
    _dadosApontamentos = await db.buscarLancamentosDia(setor, dt, maqF);
    renderizarApontamentos();
  } catch(e) {
    toast('Erro ao salvar lançamento.','erro'); console.error(e);
  }
  btn.disabled = false;
  btn.innerText = id ? '💾 Atualizar Lançamento' : '💾 Salvar Lançamento';
}

async function excluirApontamento(id) {
  try { await db.excluirLancamento(id); toast('Lançamento excluído!','sucesso'); await buscarApontamentos(); }
  catch(e) { toast('Erro ao excluir.','erro'); }
}

function coletarDadosForm(setor) {
  const data        = document.getElementById('formData').value;
  const funcionario = document.getElementById('formFunc').value;
  const job         = document.getElementById('formJob').value;
  const descricao   = document.getElementById('formDesc').value;
  const status      = _statusForm || 'Em andamento';
  if (!data)        { toast('Informe a data.','erro');            return null; }
  if (!funcionario) { toast('Selecione o funcionário.','erro');   return null; }
  if (!descricao)   { toast('Preencha a descrição.','erro');      return null; }
  const dados = { data, setor, funcionario, job, descricao, status };

  if (setor==='Usinagem') {
    const maquina = document.getElementById('formMaq')?.value;
    const tipo    = document.getElementById('formTipoUsina')?.value;
    const hrIni   = document.getElementById('formHrIni')?.value;
    const hrFim   = document.getElementById('formHrFim')?.value;
    if (!maquina) { toast('Selecione a máquina.','erro');         return null; }
    if (!tipo)    { toast('Selecione o tipo de serviço.','erro'); return null; }
    if (!hrIni)   { toast('Informe a hora de início.','erro');    return null; }
    Object.assign(dados, {
      maquina, tipo, horaInicio:hrIni, horaFim:hrFim,
      descontaAlmoco: document.getElementById('formAlmoco')?.checked,
      tempoAuto:      document.getElementById('formTempoAuto')?.value
    });
  } else if (setor==='Bancada') {
    const tipo  = document.getElementById('formTipoBancada')?.value;
    const hrIni = document.getElementById('formHrIni')?.value;
    const hrFim = document.getElementById('formHrFim')?.value;
    if (!tipo)  { toast('Selecione a atividade.','erro');      return null; }
    if (!hrIni) { toast('Informe a hora de início.','erro');   return null; }
    if (!hrFim) { toast('Informe a hora de fim.','erro');      return null; }
    // Troca de copo
    const trocaCopo = document.getElementById('formTrocaCopo')?.checked || false;
    const tipoCopo  = trocaCopo ? (document.getElementById('formTipoCopo')?.value || null) : null;
    if (trocaCopo && !tipoCopo) { toast('Selecione o tipo do copo (Novo ou Embuchado).','erro'); return null; }
    Object.assign(dados, {
      tipo, horaInicio:hrIni, horaFim:hrFim,
      descontaAlmoco: document.getElementById('formAlmoco')?.checked,
      trocaCopo, tipoCopo
    });
  } else {
    const area      = document.getElementById('formArea')?.value;
    const categoria = document.getElementById('formCategoria')?.value;
    if (!area)      { toast('Selecione a área.','erro');       return null; }
    if (!categoria) { toast('Selecione a categoria.','erro');  return null; }
    Object.assign(dados, { area, tipo:categoria });
  }
  return dados;
}

// ==========================================
// 🎛️ CAMPOS POR SETOR
// ==========================================
function configurarCamposForm(setor) {
  const vis = {
    grupoMaquina:     setor==='Usinagem',
    grupoTipoUsina:   setor==='Usinagem',
    grupoTipoBancada: setor==='Bancada',
    grupoCopo:        setor==='Bancada',   // <-- NOVO
    grupoArea:        setor==='Projeto',
    grupoHrIni:       setor!=='Projeto',
    grupoHrFim:       setor!=='Projeto',
    grupoAlmoco:      setor!=='Projeto',
    grupoTempoAuto:   setor==='Usinagem',
  };
  Object.entries(vis).forEach(([id,v]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = v ? '' : 'none';
  });
  // Garante que tipo de copo começa oculto
  const grpCopo = document.getElementById('grupoTipoCopo');
  if (grpCopo) grpCopo.style.display = 'none';
  const chkCopo = document.getElementById('formTrocaCopo');
  if (chkCopo) chkCopo.checked = false;

  if (!_listas) return;
  if (setor==='Usinagem') {
    montarSelect('formMaq', _listas.maquinas||[]);
    montarSelect('formTipoUsina', _listas.tipos||[]);
    montarSelect('formMotivo', _listas.motivos||[], 'Nenhum');
  } else if (setor==='Projeto') {
    montarSelect('formArea', _listas.areasProj||[]);
    montarSelect('formCategoria', _listas.categoriasProj||[]);
  }
}

async function carregarFuncionariosForm(setor) {
  const sel = document.getElementById('formFunc');
  if (!sel) return;
  sel.innerHTML = '<option value="">Carregando...</option>';
  try {
    const todos = await db.listarFuncionarios();
    const funcs = todos.filter(f => f.setor===setor && !f.demissao).map(f=>f.nome);
    const lista = funcs.length>0 ? funcs :
      (setor==='Usinagem'?_listas?.funcionarios:setor==='Bancada'?_listas?.funcBancada:_listas?.funcProjeto)||[];
    sel.innerHTML = '<option value="">Selecione...</option>' + lista.map(f=>`<option value="${f}">${f}</option>`).join('');
    if (setor==='Usinagem') {
      sel.onchange = async () => {
        const func = sel.value;
        const data = document.getElementById('formData')?.value;
        if (!func||!data) return;
        const aviso = document.getElementById('avisoFunc');
        if (aviso) { aviso.style.display='block'; aviso.innerText='Buscando último apontamento...'; }
        try {
          const res = await db.buscarUltimoApontamento(func, data);
          if (res.maquina) setSelect('formMaq', res.maquina);
          if (res.horaFim && !document.getElementById('formHrIni')?.value)
            document.getElementById('formHrIni').value = res.horaFim;
        } catch(e) {}
        if (aviso) aviso.style.display='none';
      };
    } else { sel.onchange = null; }
  } catch(e) { sel.innerHTML='<option value="">Erro ao carregar</option>'; }
}

function selecionarStatus(status) { _statusForm=status; atualizarBotoesStatus(); }

function atualizarBotoesStatus() {
  const mapa    = { 'Em andamento':'btnAndamento','Pausado':'btnPausado','Finalizado':'btnFinalizado' };
  const classes = { 'Em andamento':'ativo-and','Pausado':'ativo-paus','Finalizado':'ativo-fin' };
  Object.values(mapa).forEach(id => { const b=document.getElementById(id); if(b) b.className='btn-status'; });
  if (_statusForm && mapa[_statusForm]) {
    const b=document.getElementById(mapa[_statusForm]);
    if (b) b.className='btn-status '+classes[_statusForm];
  }
}

function resetarForm() {
  ['formData','formFunc','formMaq','formTipoUsina','formMotivo','formTipoBancadaInput',
   'formTipoBancada','formArea','formCategoria','formJob','formDesc','formHrIni','formHrFim','formTempoAuto','formTipoCopo']
    .forEach(id => { const el=document.getElementById(id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; });
  const alm = document.getElementById('formAlmoco');   if(alm) alm.checked=false;
  const cop = document.getElementById('formTrocaCopo'); if(cop) cop.checked=false;
  const grp = document.getElementById('grupoTipoCopo'); if(grp) grp.style.display='none';
  document.getElementById('btnSalvarForm').innerText='💾 Salvar Lançamento';
}

// ==========================================
// 💬 WHATSAPP
// ==========================================
async function enviarWhatsapp() {
  if (!_dadosApontamentos.length) return toast('Nenhum dado para enviar.','erro');
  const obs    = document.getElementById('wppObs')?.value?.trim();
  const dtArr  = document.getElementById('apontData')?.value?.split('-');
  const dataBR = dtArr ? dtArr[2]+'/'+dtArr[1]+'/'+dtArr[0] : '—';
  const dias   = ['DOMINGO','SEGUNDA-FEIRA','TERÇA-FEIRA','QUARTA-FEIRA','QUINTA-FEIRA','SEXTA-FEIRA','SÁBADO'];
  const diaSem = dias[new Date((document.getElementById('apontData')?.value||'')+'T12:00:00').getDay()];
  const sep    = '─────────────────────────';
  let t = '';

  if (_setorAtivo==='Usinagem') {
    t = `📊 *RELATÓRIO DIÁRIO — USINAGEM*\n📅 ${diaSem}, ${dataBR}\n\n*RESUMO POR MÁQUINA*\n`;
    const maqMap = {};
    _dadosApontamentos.forEach(i => {
      const maq = i.maquina||'S/ Máquina';
      if (!maqMap[maq]) maqMap[maq]={ mins:0, itens:[] };
      const key=(i.job||'')+'|'+i.tipo+'|'+i.descricao;
      if (!maqMap[maq].itens.find(x=>x.key===key))
        maqMap[maq].itens.push({ key, txt:(i.job?i.job+' ['+i.tipo+'] - ':'['+i.tipo+'] ')+(i.descricao||'')+' '+icoStatus(i.status)+' '+(i.status||'Em andamento') });
      maqMap[maq].mins+=i.minutos||0;
    });
    Object.keys(maqMap).forEach(maq => {
      if (maq==='Sem Máquina'||!maqMap[maq].itens.length) return;
      t+=`\n📍 *${maq}* (Ocupação: ${Math.round(maqMap[maq].mins/528*100)}%)\n`;
      maqMap[maq].itens.forEach(i => t+=`  - ${i.txt}\n`);
    });
  } else if (_setorAtivo==='Bancada') {
    t=`🛠️ *RELATÓRIO DIÁRIO — BANCADA*\n📅 ${diaSem}, ${dataBR}\n\n`;
    const grupos={};
    _dadosApontamentos.forEach(i => {
      const mestra=((_listas?.mapaBancada||{})[i.tipo]||i.tipo||'Outros');
      if (!grupos[mestra]) grupos[mestra]={};
      if (!grupos[mestra][i.tipo]) grupos[mestra][i.tipo]=[];
      grupos[mestra][i.tipo].push(i);
    });
    Object.keys(grupos).forEach(mestra => {
      t+=sep+'\n📍 *'+mestra.toUpperCase()+'*\n\n';
      Object.keys(grupos[mestra]).forEach(tipo => {
        t+='→ '+tipo.toUpperCase()+'\n';
        grupos[mestra][tipo].forEach(i => {
          t+=`• ${i.job?'*'+i.job+'* — ':''}${i.descricao||''} ${icoStatus(i.status)} ${i.status||''}\n  👤 ${i.funcionario||'—'}`;
          // Troca de copo no relatório WhatsApp
          if (i.trocaCopo===true||i.trocaCopo==='true') t+=`\n  🔄 *Troca de Copo:* ${i.tipoCopo||'—'}`;
          t+='\n';
        });
        t+='\n';
      });
    });
  } else {
    t=`🎯 *RELATÓRIO DE PROJETOS*\n📅 ${diaSem}, ${dataBR}\n${sep}\n`;
    const areas={};
    _dadosApontamentos.forEach(i => {
      const a=i.area||'Sem Área', c=i.tipo||'Sem Categoria';
      if (!areas[a]) areas[a]={}; if (!areas[a][c]) areas[a][c]=[];
      areas[a][c].push(i);
    });
    Object.keys(areas).sort().forEach(a => {
      t+=`\n📍 *${a.toUpperCase()}*\n\n`;
      Object.keys(areas[a]).sort().forEach(c => {
        t+='→ '+c.toUpperCase()+'\n';
        areas[a][c].forEach(i => { t+=`• ${i.job?'*'+i.job+'* — ':''}${i.descricao||''};\n`; });
        t+='\n';
      });
    });
  }
  if (obs) t+=`\n${sep}\n📝 *OBSERVAÇÃO:*\n${obs}`;
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(t),'_blank');
}

// ==========================================
// 🛠️ HELPERS
// ==========================================
function montarSelect(id, arr, padrao) {
  const sel=document.getElementById(id); if(!sel) return;
  sel.innerHTML=`<option value="">${padrao||'Selecione...'}</option>`+arr.map(i=>`<option value="${i}">${i}</option>`).join('');
}
function setSelect(id, val) {
  const sel = document.getElementById(id);
  if (!sel || !val) return;
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === val) { sel.selectedIndex = i; return; }
  }
}
