// ==========================================
// 📋 APONTAMENTOS.JS — V3 com Auto-preenchimento
// ==========================================

var _setorAtivo = 'Usinagem';
var _dadosApontamentos = [];
var _statusForm = null;
var _tecnicosSelecionados = [];
var _tecnicosOriginaisIds = null; // usado ao editar grupo de Bancada — [{nome,id}]

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
    Bancada: '<tr><th>Job</th><th>Atividade</th><th>Técnico(s)</th><th>Horários</th><th>Prod.</th><th>Troca Copo</th><th>Descrição</th><th>Ações</th></tr>',
    Projeto: '<tr><th>Job</th><th>Área</th><th>Técnico</th><th>Categoria</th><th>Descrição</th><th>Status</th><th></th><th>Ações</th></tr>'
  };
  if (thead) thead.innerHTML = cabs[_setorAtivo];

  if (!dados.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum lançamento encontrado.</td></tr>';
    document.getElementById('wppArea').style.display = 'none';
    return;
  }

  // Agrupa Bancada por job+tipo+horário
  let linhas = dados;
  if (_setorAtivo === 'Bancada') {
    const grupos = {};
    dados.forEach(item => {
      const chave = `${item.job||''}|${item.tipo||''}|${item.horaInicio||''}|${item.horaFim||''}|${item.descricao||''}`;
      if (!grupos[chave]) grupos[chave] = { ...item, _tecnicos:[item.funcionario], _ids:[item.id] };
      else { grupos[chave]._tecnicos.push(item.funcionario); grupos[chave]._ids.push(item.id); }
    });
    linhas = Object.values(grupos);
  }

  tbody.innerHTML = linhas.map(item => {
    const cor = corStatus(item.status);
    const ico = icoStatus(item.status);
    const stTxt = `<span style="color:${cor};font-weight:600;font-size:12px">${ico} ${item.status||'Em andamento'}</span>`;
    // Usa sempre o ID real do lançamento para localizar o item a editar — nunca uma posição de
    // array, que fica incorreta assim que um filtro é aplicado (ex: filtro por funcionário)
    const idEditar = _setorAtivo==='Bancada' ? item._ids[0] : item.id;
    const acoes = podeEditar()
      ? `<button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarApontamentoPorId(${idEditar})">✏️</button>
         <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirApontamentoConfirm(${_setorAtivo==='Bancada'?JSON.stringify(item._ids||[item.id]).replace(/"/g,"'"):item.id})">🗑️</button>`
      : '';

    const job = item.job ? `<b>${item.job}</b>` : '<span style="color:#aaa">—</span>';
    const hr  = (item.horaInicio||'—') + ' às ' + (item.horaFim ? item.horaFim : '<span style="color:#f59e0b">⏳</span>');

    let badgeCopo = '';
    if (_setorAtivo==='Bancada') {
      if (item.trocaCopo === true || item.trocaCopo === 'true') {
        const tipoCopo = item.tipoCopo || '—';
        const corC = tipoCopo==='Novo' ? '#059669' : '#0891b2';
        const bg   = tipoCopo==='Novo' ? '#d1fae5' : '#e0f2fe';
        badgeCopo  = `<span style="background:${bg};color:${corC};font-size:11px;padding:3px 8px;border-radius:10px;font-weight:700">🔄 ${tipoCopo}</span>`;
        if (item.descricaoCopo) badgeCopo += `<div style="font-size:11px;color:#64748b;margin-top:2px">${item.descricaoCopo}</div>`;
      } else {
        badgeCopo = '<span style="color:#94a3b8;font-size:11px">—</span>';
      }
    }

    const tecnico = _setorAtivo==='Bancada' && item._tecnicos
      ? item._tecnicos.map(t=>`<span style="display:inline-block;background:#f1f5f9;padding:1px 7px;border-radius:8px;font-size:11px;margin:1px">${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(t):t}</span>`).join('')
      : (typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(item.funcionario):(item.funcionario||'—'));

    if (_setorAtivo==='Usinagem')
      return `<tr><td>${job}</td><td>${item.maquina||'—'}</td><td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(item.funcionario):(item.funcionario||'—')}</td><td style="font-size:12px">${hr}</td><td>${item.tipo||'—'}</td><td style="font-size:12px;color:#64748b">${item.descricao||''}</td><td>${stTxt}</td><td>${acoes}</td></tr>`;
    if (_setorAtivo==='Bancada')
      return `<tr><td>${job}</td><td>${item.tipo||'—'}</td><td>${tecnico}</td><td style="font-size:12px">${hr}</td><td style="color:#10b981;font-weight:bold">${item.hrProd||'—'}</td><td>${badgeCopo}</td><td style="font-size:12px;color:#64748b">${item.descricao||''}</td><td>${acoes}</td></tr>`;
    return `<tr><td>${job}</td><td>${item.area||'—'}</td><td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(item.funcionario):(item.funcionario||'—')}</td><td>${item.tipo||'—'}</td><td style="font-size:12px;color:#64748b">${item.descricao||''}</td><td>${stTxt}</td><td></td><td>${acoes}</td></tr>`;
  }).join('');

  document.getElementById('wppArea').style.display = 'block';
}

// ==========================================
// ➕ NOVO / EDITAR
// ==========================================
function abrirNovoApontamento() {
  document.getElementById('formId').value = '';
  document.getElementById('formSetor').value = _setorAtivo;
  _statusForm = null;
  _tecnicosSelecionados = [];
  _tecnicosOriginaisIds = null;
  resetarForm();
  configurarCamposForm(_setorAtivo);
  carregarFuncionariosForm(_setorAtivo);
  document.getElementById('formData').value = document.getElementById('apontData')?.value || new Date().toISOString().split('T')[0];
  document.getElementById('tituloForm').innerText = 'Novo Lançamento — ' + _setorAtivo;
  document.getElementById('btnSalvarForm').innerText = '💾 Salvar Lançamento';
  abrirModalForm();
}

// Resolve o índice correto em _dadosApontamentos pelo ID real do lançamento —
// evita editar o item errado quando um filtro (ex: por funcionário) está aplicado
function editarApontamentoPorId(id) {
  const idx = _dadosApontamentos.findIndex(l => l.id === id);
  if (idx === -1) return toast('Lançamento não encontrado.','erro');
  editarApontamento(idx);
}

async function editarApontamento(idx) {
  const item = _dadosApontamentos[idx];
  if (!item) return;
  document.getElementById('formId').value    = item.id;
  document.getElementById('formSetor').value = _setorAtivo;
  _statusForm = item.status || 'Em andamento';
  _tecnicosOriginaisIds = null;

  // Calcula o grupo de técnicos (Bancada) antes, mas só ATRIBUI depois de
  // resetarForm()/configurarCamposForm(), pois ambos zeram _tecnicosSelecionados
  let novosTecnicos, novosIds = null;
  if (_setorAtivo === 'Bancada') {
    const chaveGrupo = l => `${l.job||''}|${l.tipo||''}|${l.horaInicio||''}|${l.horaFim||''}|${l.descricao||''}`;
    const chave = chaveGrupo(item);
    const grupo = _dadosApontamentos.filter(l => chaveGrupo(l) === chave);
    novosTecnicos = grupo.map(g => g.funcionario);
    novosIds = grupo.map(g => ({ nome: g.funcionario, id: g.id }));
  } else {
    novosTecnicos = [item.funcionario];
  }

  resetarForm();
  configurarCamposForm(_setorAtivo);

  _tecnicosSelecionados = novosTecnicos;
  _tecnicosOriginaisIds = novosIds;
  _renderizarTecnicosSelecionados();

  await carregarFuncionariosForm(_setorAtivo);
  document.getElementById('formData').value = item.data || '';
  await new Promise(r => setTimeout(r, 50));
  if (_setorAtivo !== 'Bancada') setSelect('formFunc', item.funcionario);
  if (_setorAtivo==='Usinagem') {
    setSelect('formMaq', item.maquina);
    setSelect('formTipoUsina', item.tipo);
    setSelect('formMotivo', item.motivo || 'Nenhum');
    document.getElementById('formHrIni').value     = item.horaInicio || '';
    document.getElementById('formHrFim').value     = item.horaFim    || '';
    document.getElementById('formTempoAuto').value = item.tempoAuto  || '';
    document.getElementById('formAlmoco').checked  = !!item.descontaAlmoco;
    atualizarCamposParadaMaquina();
  } else if (_setorAtivo==='Bancada') {
    setSelect('formTipoBancada', item.tipo);
    document.getElementById('formHrIni').value = item.horaInicio || '';
    document.getElementById('formHrFim').value = item.horaFim    || '';
    const chkCopo = document.getElementById('formTrocaCopo');
    const grpCopo = document.getElementById('grupoTipoCopo');
    if (chkCopo) chkCopo.checked = !!(item.trocaCopo === true || item.trocaCopo === 'true');
    if (grpCopo) grpCopo.style.display = chkCopo?.checked ? '' : 'none';
    const elTipoCopo = document.getElementById('formTipoCopo');
    if (elTipoCopo) elTipoCopo.value = item.tipoCopo || '';
    if (item.tipoCopo === 'Novo') { const r=document.getElementById('formTipoCopoNovo'); if(r) r.checked=true; }
    else if (item.tipoCopo === 'Embuchado') { const r=document.getElementById('formTipoCopoEmb'); if(r) r.checked=true; }
    const elDescCopo = document.getElementById('formDescCopo');
    if (elDescCopo) elDescCopo.value = item.descricaoCopo || '';
    _renderizarTecnicosSelecionados();
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

function toggleTrocaCopo() {
  const chk = document.getElementById('formTrocaCopo');
  const grp = document.getElementById('grupoTipoCopo');
  if (grp) grp.style.display = chk?.checked ? '' : 'none';
  if (!chk?.checked) {
    const elTipoCopo = document.getElementById('formTipoCopo');
    if (elTipoCopo) elTipoCopo.value = '';
    const r1=document.getElementById('formTipoCopoNovo'); if(r1) r1.checked=false;
    const r2=document.getElementById('formTipoCopoEmb');  if(r2) r2.checked=false;
  }
}

// ==========================================
// 👥 MÚLTIPLOS TÉCNICOS — Bancada
// ==========================================
function _renderizarTecnicosSelecionados() {
  const el = document.getElementById('tecnicosSelecionadosWrap');
  if (!el) return;
  if (!_tecnicosSelecionados.length) {
    el.innerHTML = '<div style="font-size:12px;color:#94a3b8">Nenhum técnico selecionado</div>';
    return;
  }
  el.innerHTML = _tecnicosSelecionados.map((t,i) => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#0056b3;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;margin:2px">
      👤 ${t}
      <button onclick="_removerTecnico(${i})" style="background:none;border:none;color:#0056b3;cursor:pointer;font-size:14px;line-height:1;padding:0">×</button>
    </span>`).join('');
}

function _adicionarTecnico() {
  const sel = document.getElementById('formFuncBancada');
  const val = sel?.value;
  if (!val) return;
  if (_tecnicosSelecionados.includes(val)) { toast('Técnico já adicionado.','erro'); return; }
  _tecnicosSelecionados.push(val);
  sel.selectedIndex = 0;
  _renderizarTecnicosSelecionados();

  // Auto-preenchimento: busca o último apontamento desse técnico na Bancada
  // e preenche a Hora Início se ainda estiver vazia (e for do mesmo dia)
  const hrIniEl = document.getElementById('formHrIni');
  const data = document.getElementById('formData')?.value;
  if (hrIniEl && !hrIniEl.value && data) {
    db.buscarUltimoApontamento(val, data, 'Bancada').then(res => {
      if (res.horaFim && !hrIniEl.value) hrIniEl.value = res.horaFim;
    }).catch(()=>{});
  }
}

function _removerTecnico(idx) {
  _tecnicosSelecionados.splice(idx, 1);
  _renderizarTecnicosSelecionados();
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
      if (setor === 'Bancada' && _tecnicosSelecionados.length > 1) {
        for (let i = 0; i < _tecnicosSelecionados.length; i++) {
          const dadosTecnico = { ...dados, funcionario: _tecnicosSelecionados[i] };
          if (i > 0) { dadosTecnico.trocaCopo=false; dadosTecnico.tipoCopo=null; dadosTecnico.descricaoCopo=null; }
          await db.salvarLancamento(dadosTecnico);
        }
        toast(`${_tecnicosSelecionados.length} lançamentos salvos!`, 'sucesso');
      } else {
        await db.salvarLancamento(dados);
        toast('Lançamento salvo!','sucesso');
      }
      const data = document.getElementById('formData').value;
      const funcionarioAnterior = setor !== 'Bancada' ? dados.funcionario : null;
      _tecnicosSelecionados = [];
      resetarForm(); configurarCamposForm(setor);
      await carregarFuncionariosForm(setor);
      document.getElementById('formData').value = data;
      // Mantém o técnico selecionado (Usinagem/Projeto) — agiliza lançamentos seguidos da mesma pessoa
      // e dispara o onchange manualmente para já puxar a última máquina/hora dele (setSelect não dispara eventos)
      if (funcionarioAnterior) {
        setSelect('formFunc', funcionarioAnterior);
        const selFunc = document.getElementById('formFunc');
        if (selFunc && typeof selFunc.onchange === 'function') selFunc.onchange();
      }
      _statusForm = null; atualizarBotoesStatus();
    } else {
      if (setor === 'Bancada' && _tecnicosOriginaisIds && _tecnicosOriginaisIds.length) {
        // Edição de um grupo de Bancada com (possivelmente) múltiplos técnicos:
        // atualiza quem continua, exclui quem foi removido, cria quem foi adicionado
        const nomesAtuais = _tecnicosSelecionados;
        const nomesOriginais = _tecnicosOriginaisIds.map(t => t.nome);

        for (const orig of _tecnicosOriginaisIds) {
          if (nomesAtuais.includes(orig.nome)) {
            await db.atualizarLancamento(orig.id, { ...dados, funcionario: orig.nome });
          } else {
            await db.excluirLancamento(orig.id);
          }
        }
        for (const nome of nomesAtuais) {
          if (!nomesOriginais.includes(nome)) {
            await db.salvarLancamento({ ...dados, funcionario: nome, trocaCopo:false, tipoCopo:null, descricaoCopo:null });
          }
        }
        toast('Lançamento atualizado!','sucesso');
      } else {
        await db.atualizarLancamento(id, dados);
        toast('Lançamento atualizado!','sucesso');
      }
      _tecnicosOriginaisIds = null;
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

function excluirApontamentoConfirm(ids) {
  const idsArr = Array.isArray(ids) ? ids : [ids];
  const msg = idsArr.length > 1
    ? `Excluir ${idsArr.length} lançamentos (todos os técnicos)?`
    : 'Excluir este lançamento?';
  confirmarExclusao(msg, async function() {
    try {
      for (const id of idsArr) await db.excluirLancamento(id);
      toast('Excluído!','sucesso');
      await buscarApontamentos();
    } catch(e) { toast('Erro ao excluir.','erro'); }
  });
}

// ==========================================
// 🔴 PARADA DE MÁQUINA (Usinagem) — regras de obrigatoriedade dinâmicas
// ==========================================
// Quando o Tipo de Serviço é "Parada de Máquina":
//   - Máquina continua obrigatória (precisa saber qual ficou parada)
//   - Técnico deixa de ser obrigatório (máquina parada não tem operador)
//   - Motivo de Parada passa a ser obrigatório (por que ficou parada)
// Nos demais tipos: Técnico obrigatório, Máquina agora é OPCIONAL
// (permite lançamentos gerais sem máquina definida — organização de setor,
// programação CAM, etc.)
function atualizarCamposParadaMaquina() {
  const tipo = document.getElementById('formTipoUsina')?.value;
  const ehParada = tipo === 'Parada de Máquina';

  const labelMaquina = document.getElementById('labelMaquina');
  const labelMotivo  = document.getElementById('labelMotivo');
  const avisoOpcional = document.getElementById('avisoFuncOpcional');

  if (labelMaquina) labelMaquina.innerText = ehParada ? 'Máquina *' : 'Máquina';
  if (labelMotivo)  labelMotivo.innerText  = ehParada ? 'Motivo de Parada *' : 'Motivo de Parada';
  if (avisoOpcional) avisoOpcional.style.display = ehParada ? '' : 'none';
}

function coletarDadosForm(setor) {
  const data      = document.getElementById('formData').value;
  const job       = document.getElementById('formJob').value;
  const descricao = document.getElementById('formDesc').value;
  const status    = _statusForm || 'Em andamento';
  if (!data)      { toast('Informe a data.','erro');        return null; }
  if (!descricao) { toast('Preencha a descrição.','erro');  return null; }

  // Usinagem com tipo "Parada de Máquina": técnico não é obrigatório
  const tipoUsinaAntecipado = setor === 'Usinagem' ? document.getElementById('formTipoUsina')?.value : null;
  const ehParadaDeMaquina = tipoUsinaAntecipado === 'Parada de Máquina';

  let funcionario = '';
  if (setor === 'Bancada') {
    if (!_tecnicosSelecionados.length) { toast('Adicione pelo menos um técnico.','erro'); return null; }
    funcionario = _tecnicosSelecionados[0];
  } else {
    funcionario = document.getElementById('formFunc').value;
    if (!funcionario && !ehParadaDeMaquina) { toast('Selecione o funcionário.','erro'); return null; }
  }

  const dados = { data, setor, funcionario: funcionario || null, job, descricao, status };

  if (setor==='Usinagem') {
    const maquina = document.getElementById('formMaq')?.value;
    const tipo    = document.getElementById('formTipoUsina')?.value;
    const motivo  = document.getElementById('formMotivo')?.value;
    const hrIni   = document.getElementById('formHrIni')?.value;
    const hrFim   = document.getElementById('formHrFim')?.value;
    if (!tipo)    { toast('Selecione o tipo de serviço.','erro'); return null; }
    if (tipo === 'Parada de Máquina') {
      if (!maquina) { toast('Selecione a máquina.','erro'); return null; }
      if (!motivo || motivo === 'Nenhum') { toast('Selecione o motivo da parada.','erro'); return null; }
    }
    // Máquina agora é opcional pros demais tipos (lançamentos gerais sem máquina definida)
    if (!hrIni)   { toast('Informe a hora de início.','erro');    return null; }
    Object.assign(dados, {
      maquina: maquina || null, tipo,
      motivo: tipo === 'Parada de Máquina' ? motivo : null,
      horaInicio:hrIni, horaFim:hrFim,
      descontaAlmoco: document.getElementById('formAlmoco')?.checked,
      tempoAuto:      document.getElementById('formTempoAuto')?.value
    });
  } else if (setor==='Bancada') {
    const tipo  = document.getElementById('formTipoBancada')?.value;
    const hrIni = document.getElementById('formHrIni')?.value;
    const hrFim = document.getElementById('formHrFim')?.value;
    if (!tipo)  { toast('Selecione a atividade.','erro');    return null; }
    if (!hrIni) { toast('Informe a hora de início.','erro'); return null; }
    if (!hrFim) { toast('Informe a hora de fim.','erro');    return null; }
    const trocaCopo  = document.getElementById('formTrocaCopo')?.checked || false;
    const tipoCopo   = trocaCopo ? (document.getElementById('formTipoCopo')?.value || null) : null;
    const descCopo   = trocaCopo ? (document.getElementById('formDescCopo')?.value?.trim() || null) : null;
    if (trocaCopo && !tipoCopo) { toast('Selecione o tipo do copo.','erro'); return null; }
    Object.assign(dados, {
      tipo, horaInicio:hrIni, horaFim:hrFim,
      descontaAlmoco: document.getElementById('formAlmoco')?.checked,
      trocaCopo, tipoCopo, descricaoCopo: descCopo
    });
  } else {
    const area      = document.getElementById('formArea')?.value;
    const categoria = document.getElementById('formCategoria')?.value;
    if (!area)      { toast('Selecione a área.','erro');      return null; }
    if (!categoria) { toast('Selecione a categoria.','erro'); return null; }
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
    grupoCopo:        setor==='Bancada',
    grupoArea:        setor==='Projeto',
    grupoHorarios:    setor!=='Projeto',
    grupoHrIni:       setor!=='Projeto',
    grupoHrFim:       setor!=='Projeto',
    grupoAlmoco:      setor!=='Projeto',
    grupoTempoAuto:   setor==='Usinagem',
    grupoFuncSimples: setor!=='Bancada',
    grupoFuncBancada: setor==='Bancada',
  };
  Object.entries(vis).forEach(([id,v]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = v ? '' : 'none';
  });
  const grpCopo = document.getElementById('grupoTipoCopo');
  if (grpCopo) grpCopo.style.display = 'none';
  const chkCopo = document.getElementById('formTrocaCopo');
  if (chkCopo) chkCopo.checked = false;
  _tecnicosSelecionados = [];
  _renderizarTecnicosSelecionados();

  if (!_listas) return;
  if (setor==='Usinagem') {
    montarSelect('formMaq', _listas.maquinas||[]);
    montarSelect('formTipoUsina', _listas.tipos||[]);
    montarSelect('formMotivo', _listas.motivos||[], 'Nenhum');
  } else if (setor==='Bancada') {
    montarSelect('formTipoBancada', _listas.tiposBancada||[]);
    const sel = document.getElementById('formFuncBancada');
    if (sel) {
      sel.innerHTML = '<option value="">+ Adicionar técnico...</option>' +
        (_listas.funcBancada||[]).map(f=>`<option value="${f}">${f}</option>`).join('');
    }
  } else if (setor==='Projeto') {
    montarSelect('formArea', _listas.areasProj||[]);
    montarSelect('formCategoria', _listas.categoriasProj||[]);
  }
}

// ==========================================
// 👤 CARREGAR FUNCIONÁRIOS + AUTO-PREENCHIMENTO
// ==========================================
async function carregarFuncionariosForm(setor) {
  if (setor === 'Bancada') {
    _renderizarTecnicosSelecionados();
    return;
  }
  const sel = document.getElementById('formFunc');
  if (!sel) return;
  sel.innerHTML = '<option value="">Carregando...</option>';
  try {
    const todos = await db.listarFuncionarios();
    const funcs = todos.filter(f => f.setor===setor && !f.demissao).map(f=>f.nome);
    const lista = funcs.length>0 ? funcs :
      (setor==='Usinagem'?_listas?.funcionarios:_listas?.funcProjeto)||[];
    sel.innerHTML = '<option value="">Selecione...</option>' + lista.map(f=>`<option value="${f}">${f}</option>`).join('');

    if (setor==='Usinagem') {
      // Auto-preenchimento: ao selecionar técnico → preenche máquina e hora início
      sel.onchange = async () => {
        const func = sel.value;
        const data = document.getElementById('formData')?.value;
        if (!func || !data) return;
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
    } else {
      sel.onchange = null;
    }
  } catch(e) { sel.innerHTML='<option value="">Erro ao carregar</option>'; }
}

// ==========================================
// 🔩 AUTO-PREENCHIMENTO DO JOB (Usinagem)
// ==========================================
async function aoSelecionarJob(job) {
  if (_setorAtivo !== 'Usinagem' || !job) return;
  const maq = document.getElementById('formMaq')?.value || '';
  try {
    const desc = await db.buscarDescricaoJob(job, maq);
    if (desc) {
      const elDesc = document.getElementById('formDesc');
      if (elDesc && !elDesc.value) elDesc.value = desc;
    }
  } catch(e) {}
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
  ['formData','formFunc','formMaq','formTipoUsina','formMotivo',
   'formTipoBancada','formArea','formCategoria','formJob','formDesc','formHrIni','formHrFim',
   'formTempoAuto','formTipoCopo','formDescCopo','formFuncBancada']
    .forEach(id => { const el=document.getElementById(id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; });
  const alm = document.getElementById('formAlmoco');   if(alm) alm.checked=false;
  const cop = document.getElementById('formTrocaCopo'); if(cop) cop.checked=false;
  const grp = document.getElementById('grupoTipoCopo'); if(grp) grp.style.display='none';
  const r1  = document.getElementById('formTipoCopoNovo'); if(r1) r1.checked=false;
  const r2  = document.getElementById('formTipoCopoEmb');  if(r2) r2.checked=false;
  _tecnicosSelecionados = [];
  _renderizarTecnicosSelecionados();
  if (typeof atualizarCamposParadaMaquina === 'function') atualizarCamposParadaMaquina();
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
    const minutosPorMestra = {};
    _dadosApontamentos.forEach(i => {
      const mestra=((_listas?.mapaBancada||{})[i.tipo]||i.tipo||'Outros');
      if (!grupos[mestra]) grupos[mestra]={};
      if (!grupos[mestra][i.tipo]) grupos[mestra][i.tipo]=[];
      const chave = `${i.job||''}|${i.horaInicio||''}|${i.horaFim||''}|${i.descricao||''}`;
      const existente = grupos[mestra][i.tipo].find(x=>x._chave===chave);
      if (existente) {
        existente._tecnicos.push(i.funcionario);
      } else {
        grupos[mestra][i.tipo].push({ ...i, _chave:chave, _tecnicos:[i.funcionario] });
        // Soma minutos só uma vez por lançamento agrupado (evita contar o mesmo serviço 2x por causa de múltiplos técnicos)
        minutosPorMestra[mestra] = (minutosPorMestra[mestra]||0) + (i.minutos||0);
      }
    });

    Object.keys(grupos).forEach(mestra => {
      t+=sep+'\n 📍 '+mestra.toUpperCase()+'\n'+sep+'\n';
      Object.keys(grupos[mestra]).forEach(tipo => {
        t+='→ '+tipo.toUpperCase()+'\n';
        grupos[mestra][tipo].forEach(i => {
          const ehServico = i.job && (i.job.toUpperCase().startsWith('SV') || i.job.toUpperCase().startsWith('S/'));
          const label = i.job ? (ehServico ? i.job : 'Molde: '+i.job) : (i.tipo||'').toUpperCase();
          t+=`🛠️ ${label}  → ${icoStatus(i.status)} ${i.status||''}\n`;
          t+=`👤 ${i._tecnicos.join(' / ')}\n`;
          t+=`📝 ATIVIDADES: ${i.descricao||''}\n`;
          if (i.trocaCopo===true||i.trocaCopo==='true') t+=`🔄 *Troca de Copo:* ${i.tipoCopo||'—'}${i.descricaoCopo?' — '+i.descricaoCopo:''}\n`;
          t+='\n';
        });
      });
    });

    // Resumo percentual por categoria mestra, baseado no tempo total do dia
    const totalMinDia = Object.values(minutosPorMestra).reduce((a,b)=>a+b,0);
    if (totalMinDia > 0) {
      const resumoOrdenado = Object.entries(minutosPorMestra).sort((a,b)=>b[1]-a[1]);
      t += sep+'\n📊 *RESUMO DO DIA — % POR ATIVIDADE*\n'+sep+'\n';
      resumoOrdenado.forEach(([mestra, mins]) => {
        const pct = Math.round(mins/totalMinDia*100);
        t += `${mestra}: ${pct}%\n`;
      });
    }
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
  if (sel.tagName !== 'SELECT') { sel.value = val; return; }
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === val) { sel.selectedIndex = i; return; }
  }
}
