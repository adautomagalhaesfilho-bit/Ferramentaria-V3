// ==========================================
// 🏭 PRODUCAO.JS — Modal V3
// ==========================================

var _dadosProducao = [];
var _tecnicosProducao = [];
var _injetoras = [];
var _categoriasProd = {};
var _tecnicosSelecionadosProd = [];
var _statusFormProd = null;

async function inicializarProducao() {
  try {
    const [tecs, injs, cats] = await Promise.all([
      db.listarProdTecnicos(),
      db.listarProdInjetoras(),
      db.listarProdCategorias()
    ]);
    _tecnicosProducao = tecs || [];
    _injetoras = injs || [];
    _categoriasProd = {};
    (cats||[]).forEach(c => { if (!_categoriasProd[c.tipo]) _categoriasProd[c.tipo]=[]; _categoriasProd[c.tipo].push(c.atividade); });

    const selInj = document.getElementById('prodFiltroInjetora');
    if (selInj) selInj.innerHTML = '<option value="Todas">Todas</option>' + _injetoras.map(i=>`<option value="${i.nome}">${i.nome}</option>`).join('');
  } catch(e) { console.error(e); }

  const elData = document.getElementById('prodData');
  if (elData && !elData.value) elData.value = new Date().toISOString().split('T')[0];
  buscarLancamentosProducao();
}

async function buscarLancamentosProducao() {
  const dt  = document.getElementById('prodData')?.value; if (!dt) return;
  const inj = document.getElementById('prodFiltroInjetora')?.value || 'Todas';
  const tip = document.getElementById('prodFiltroTipo')?.value || 'Todos';
  const loader = document.getElementById('prodLoader');
  if (loader) loader.style.display = 'flex';
  try {
    _dadosProducao = await db.buscarProdLancamentos(dt, inj, tip);
    renderizarProducao();
  } catch(e) { toast('Erro ao buscar lançamentos.','erro'); }
  if (loader) loader.style.display = 'none';
}

function renderizarProducao() {
  const tbody = document.getElementById('tbodyProducao');
  if (!tbody) return;

  const wppArea = document.getElementById('prodWppArea');
  if (wppArea) wppArea.style.display = _dadosProducao.length ? 'block' : 'none';

  if (!_dadosProducao.length) {
    tbody.innerHTML='<tr><td colspan="9" class="empty-msg">Nenhum lançamento encontrado.</td></tr>';
    return;
  }
  const coresTipo = { Setup:'#0056b3', Preventiva:'#10b981', Corretiva:'#ef4444', 'Inspeção':'#f59e0b' };
  tbody.innerHTML = _dadosProducao.map(l => {
    const hr = (l.hora_inicio?l.hora_inicio.substring(0,5):'—') + ' às ' + (l.hora_fim?l.hora_fim.substring(0,5):'<span style="color:#f59e0b">⏳</span>');
    const corT = coresTipo[l.tipo]||'#64748b';
    const flags = [
      l.maquina_parada?'<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700">🔴 Máq. Parada</span>':'',
      l.tem_os?`<span style="background:#eff6ff;color:#1d4ed8;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700">📋 OS: ${l.numero_os||'?'}</span>`:''
    ].filter(Boolean).join(' ');
    const status = l.status || 'Em andamento';
    const stTxt = `<span style="color:${corStatus(status)};font-weight:600;font-size:12px">${icoStatus(status)} ${status}</span>`;
    const dataFmt = l.data ? l.data.split('-').reverse().join('/') : '—';
    const acoes = podeEditar()
      ? `<button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarProd(${l.id})">✏️</button>
         <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="confirmarExclusao('Excluir?',()=>excluirProd(${l.id}))">🗑️</button>`
      : '';
    return `<tr>
      <td style="font-size:12px"><b>${dataFmt}</b></td>
      <td><b>${l.injetora}</b></td>
      <td>${l.molde?`<b>${l.molde}</b>`:'—'}</td>
      <td>
        <span style="background:${corT}20;color:${corT};padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">${l.tipo}</span>
        <div style="font-size:12px;margin-top:3px">${l.atividade||'—'}</div>
        ${flags?`<div style="margin-top:3px">${flags}</div>`:''}
      </td>
      <td style="font-size:12px;color:#64748b;max-width:220px">${l.descricao||''}</td>
      <td style="font-size:12px">${hr}</td>
      <td>${(l.tecnicos||'').split(',').map(t=>`<span style="background:#e8f0fe;color:#0056b3;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-right:4px;white-space:nowrap">${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(t.trim()):t.trim()}</span>`).join('')}</td>
      <td>${stTxt}</td>
      <td>${acoes}</td>
    </tr>`;
  }).join('');
}

// ==========================================
// 💬 WHATSAPP — PRODUÇÃO
// ==========================================
async function enviarWhatsappProducao() {
  if (!_dadosProducao.length) return toast('Nenhum dado para enviar.','erro');

  const dtArr  = document.getElementById('prodData')?.value?.split('-');
  const dataBR = dtArr ? dtArr[2]+'/'+dtArr[1]+'/'+dtArr[0] : '—';
  const dias   = ['DOMINGO','SEGUNDA-FEIRA','TERÇA-FEIRA','QUARTA-FEIRA','QUINTA-FEIRA','SEXTA-FEIRA','SÁBADO'];
  const diaSem = dias[new Date((document.getElementById('prodData')?.value||'')+'T12:00:00').getDay()];
  const sep    = '─────────────────────────';
  const obs    = document.getElementById('prodWppObs')?.value?.trim();

  let t = `🏭 *RELATÓRIO DIÁRIO — PRODUÇÃO*\n📅 ${diaSem}, ${dataBR}\n`;

  const porTipo = {};
  _dadosProducao.forEach(l => {
    const tipo = l.tipo || 'Outros';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push(l);
  });

  const ordemTipos = ['Setup', 'Preventiva', 'Corretiva', 'Inspeção'];
  const tiposOrdenados = [
    ...ordemTipos.filter(t => porTipo[t]),
    ...Object.keys(porTipo).filter(t => !ordemTipos.includes(t))
  ];

  tiposOrdenados.forEach(tipo => {
    const lancs = porTipo[tipo];
    t += `\n${sep}\n`;

    const icoTipo = tipo==='Setup'?'⚙️':tipo==='Preventiva'?'🔧':tipo==='Corretiva'?'🔴':tipo==='Inspeção'?'🔍':'🏭';
    t += `📍 *${icoTipo} ${tipo.toUpperCase()}*\n\n`;

    lancs.forEach(l => {
      const hr = (l.hora_inicio?l.hora_inicio.substring(0,5):'—') + ' → ' + (l.hora_fim?l.hora_fim.substring(0,5):'⏳');
      const tecs = (l.tecnicos||'').split(',').map(t=>t.trim()).filter(Boolean).join(' / ');
      const dataFmt = l.data ? l.data.split('-').reverse().join('/') : '—';
      const status = l.status || 'Em andamento';

      t += `📅 Data: ${dataFmt}\n`;
      t += `🏭 Máq.: ${l.injetora}\n`;
      if (l.molde) t += `🔩 Molde: ${l.molde}\n`;
      if (l.atividade) t += `📝 Atividade: ${l.atividade}\n`;
      if (l.descricao) t += `💬 Descrição: ${l.descricao}\n`;
      t += `⏱️ Hora: ${hr}\n`;
      t += `👤 Técnico: ${tecs}\n`;
      t += `${icoStatus(status)} Status: ${status}`;
      if (l.maquina_parada) t += ` | 🔴 *Máquina Parada*`;
      if (l.tem_os) t += ` | 📋 OS: ${l.numero_os||'?'}`;
      t += '\n\n';
    });
  });

  const total    = _dadosProducao.length;
  const porTipoCount = {};
  _dadosProducao.forEach(l => { const tp=l.tipo||'Outros'; if(!porTipoCount[tp]) porTipoCount[tp]=0; porTipoCount[tp]++; });
  const resumoTipos = Object.entries(porTipoCount).map(([tp,qt])=>`${qt} ${tp}`).join(' · ');
  const paradas  = _dadosProducao.filter(l=>l.maquina_parada).length;

  t += `${sep}\n📊 *RESUMO:* ${total} manutenção(ões) | ${resumoTipos}`;
  if (paradas) t += ` | 🔴 ${paradas} parada(s)`;
  if (obs) t += `\n\n📝 *OBSERVAÇÃO:*\n${obs}`;

  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(t),'_blank');
}

// ==========================================
// ➕ NOVO / EDITAR — via MODAL
// ==========================================
function abrirNovoLancamentoProducao() {
  document.getElementById('prodFormId').value = '';
  _tecnicosSelecionadosProd = [];
  _statusFormProd = null;
  resetarFormProducao();
  preencherFormProducao();
  document.getElementById('tituloFormProd').innerText = 'Novo Lançamento — Produção / Setup';
  document.getElementById('btnSalvarProd').innerText  = '💾 Salvar Lançamento';
  atualizarBotoesStatusProd();
  abrirModalFormProd();
}

async function editarProd(id) {
  const item = _dadosProducao.find(l => l.id === id);
  if (!item) return;
  document.getElementById('prodFormId').value = id;
  _tecnicosSelecionadosProd = item.tecnicos ? item.tecnicos.split(',').map(t=>t.trim()) : [];
  _statusFormProd = item.status || 'Em andamento';
  resetarFormProducao();
  preencherFormProducao();
  document.getElementById('prodFormData').value  = item.data || '';
  document.getElementById('prodFormHrIni').value = item.hora_inicio ? item.hora_inicio.substring(0,5) : '';
  document.getElementById('prodFormHrFim').value = item.hora_fim    ? item.hora_fim.substring(0,5)    : '';
  document.getElementById('prodFormInjetora').value = item.injetora || '';
  document.getElementById('prodFormMolde').value = item.molde || '';
  setSelectP('prodFormTipo', item.tipo);
  atualizarAtividades();
  setTimeout(() => setSelectP('prodFormAtividade', item.atividade), 150);
  document.getElementById('prodFormDesc').value  = item.descricao || '';
  document.getElementById('prodFormMaqParada').checked = !!item.maquina_parada;
  document.getElementById('prodFormTemOS').checked     = !!item.tem_os;
  document.getElementById('prodFormNumOS').value       = item.numero_os || '';
  document.getElementById('prodFormObs').value         = item.observacoes || '';
  if (item.tem_os) document.getElementById('grupoOS').style.display = '';
  renderizarTecnicos();
  atualizarBotoesStatusProd();
  document.getElementById('tituloFormProd').innerText = 'Editar Lançamento — Produção';
  document.getElementById('btnSalvarProd').innerText  = '💾 Atualizar';
  abrirModalFormProd();
}

function cancelarFormProducao() { fecharModalFormProd(); }

function preencherFormProducao() {
  // Injetora — clica para escolher OU digita para filtrar (igual Job)
  setupAC('prodFormInjetora', 'prodFormInjetoraList', _injetoras.map(i=>i.nome));

  // Técnico — clica para escolher OU digita para filtrar (igual Job)
  setupAC('prodTecnicoInput', 'prodTecnicoInputList', _tecnicosProducao.map(t=>t.nome), val => {
    adicionarTecnicoPorNome(val);
    const inp = document.getElementById('prodTecnicoInput');
    if (inp) inp.value = '';
  });

  if (_listas) setupAC('prodFormMolde', 'prodFormMoldeList', _listas.jobs || []);

  const dataEl = document.getElementById('prodFormData');
  if (dataEl) dataEl.value = document.getElementById('prodData')?.value || new Date().toISOString().split('T')[0];
  renderizarTecnicos();
}

function adicionarTecnicoPorNome(nome) {
  if (!nome || _tecnicosSelecionadosProd.includes(nome)) return;
  _tecnicosSelecionadosProd.push(nome);
  renderizarTecnicos();
}

function removerTecnico(nome) {
  _tecnicosSelecionadosProd = _tecnicosSelecionadosProd.filter(t=>t!==nome);
  renderizarTecnicos();
}

function renderizarTecnicos() {
  const wrap = document.getElementById('prodTecnicosWrap');
  if (!wrap) return;
  wrap.innerHTML = _tecnicosSelecionadosProd.map(t =>
    `<div class="tecnico-tag">${t}<button onclick="removerTecnico('${t.replace(/'/g,"\\'")}')">×</button></div>`
  ).join('');
}

function atualizarAtividades() {
  const tipo = document.getElementById('prodFormTipo')?.value;
  const sel  = document.getElementById('prodFormAtividade');
  if (!sel) return;
  const ativs = _categoriasProd[tipo] || [];
  sel.innerHTML = '<option value="">Selecione a atividade...</option>' + ativs.map(a=>`<option value="${a}">${a}</option>`).join('');
}

function toggleOS() {
  const temOS = document.getElementById('prodFormTemOS')?.checked;
  const grupoOS = document.getElementById('grupoOS');
  if (grupoOS) grupoOS.style.display = temOS ? '' : 'none';
}

// ==========================================
// 🚦 STATUS
// ==========================================
function selecionarStatusProd(status) {
  _statusFormProd = status;
  atualizarBotoesStatusProd();
}

function atualizarBotoesStatusProd() {
  const mapa    = { 'Em andamento':'btnProdAndamento', 'Pausado':'btnProdPausado', 'Finalizado':'btnProdFinalizado' };
  const classes = { 'Em andamento':'ativo-and', 'Pausado':'ativo-paus', 'Finalizado':'ativo-fin' };
  Object.values(mapa).forEach(id => { const b=document.getElementById(id); if(b) b.className='btn-status'; });
  if (_statusFormProd && mapa[_statusFormProd]) {
    const b = document.getElementById(mapa[_statusFormProd]);
    if (b) b.className = 'btn-status '+classes[_statusFormProd];
  }
}

async function salvarFormProducao() {
  const id = document.getElementById('prodFormId')?.value;
  if (!_tecnicosSelecionadosProd.length) return toast('Adicione ao menos um técnico.','erro');
  const injetora = document.getElementById('prodFormInjetora')?.value?.trim();
  const tipo     = document.getElementById('prodFormTipo')?.value;
  if (!injetora) return toast('Selecione a injetora.','erro');
  if (!tipo)     return toast('Selecione o tipo de manutenção.','erro');
  const dados = {
    data:          document.getElementById('prodFormData')?.value,
    horaInicio:    document.getElementById('prodFormHrIni')?.value || null,
    horaFim:       document.getElementById('prodFormHrFim')?.value || null,
    tecnicos:      _tecnicosSelecionadosProd.join(', '),
    injetora, molde: document.getElementById('prodFormMolde')?.value || null,
    tipo, atividade: document.getElementById('prodFormAtividade')?.value || null,
    descricao:     document.getElementById('prodFormDesc')?.value || null,
    status:        _statusFormProd || 'Em andamento',
    maquinaParada: document.getElementById('prodFormMaqParada')?.checked,
    temOS:         document.getElementById('prodFormTemOS')?.checked,
    numeroOS:      document.getElementById('prodFormNumOS')?.value || null,
    observacoes:   document.getElementById('prodFormObs')?.value || null
  };
  const btn = document.getElementById('btnSalvarProd');
  btn.disabled = true; btn.innerText = 'Salvando...';
  try {
    if (!id) {
      await db.salvarProdLancamento(dados);
      toast('Lançamento salvo!','sucesso');
      const data = dados.data;
      _tecnicosSelecionadosProd = [];
      _statusFormProd = null;
      resetarFormProducao(); preencherFormProducao();
      document.getElementById('prodFormData').value = data;
      atualizarBotoesStatusProd();
    } else {
      await db.atualizarProdLancamento(id, dados);
      toast('Lançamento atualizado!','sucesso');
      fecharModalFormProd();
    }
    await buscarLancamentosProducao();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
  btn.disabled = false;
  btn.innerText = id ? '💾 Atualizar' : '💾 Salvar Lançamento';
}

async function excluirProd(id) {
  try { await db.excluirProdLancamento(id); toast('Excluído!','sucesso'); await buscarLancamentosProducao(); }
  catch(e) { toast('Erro ao excluir.','erro'); }
}

function resetarFormProducao() {
  ['prodFormData','prodFormHrIni','prodFormHrFim','prodFormInjetora','prodFormMolde',
   'prodFormTipo','prodFormAtividade','prodFormDesc','prodFormNumOS','prodFormObs','prodTecnicoInput']
    .forEach(id => { const el=document.getElementById(id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; });
  const mp=document.getElementById('prodFormMaqParada'); if(mp) mp.checked=false;
  const os=document.getElementById('prodFormTemOS');     if(os) os.checked=false;
  const go=document.getElementById('grupoOS');           if(go) go.style.display='none';
  _tecnicosSelecionadosProd = [];
  renderizarTecnicos();
  const btn=document.getElementById('btnSalvarProd'); if(btn) btn.innerText='💾 Salvar Lançamento';
}

function setSelectP(id, val) {
  const sel=document.getElementById(id);
  if(!sel||!val) return;
  if(sel.tagName !== 'SELECT') { sel.value = val; return; }
  for(let i=0;i<sel.options.length;i++) if(sel.options[i].value===val){sel.selectedIndex=i;return;}
}

