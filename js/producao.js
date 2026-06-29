// ==========================================
// 🏭 PRODUCAO.JS — Modal V3
// ==========================================

var _dadosProducao = [];
var _tecnicosProducao = [];
var _injetoras = [];
var _categoriasProd = {};
var _tecnicosSelecionados = [];

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

  // Botão WhatsApp — adiciona após a tabela se houver dados
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
    const acoes = podeEditar()
      ? `<button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="editarProd(${l.id})">✏️</button>
         <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="confirmarExclusao('Excluir?',()=>excluirProd(${l.id}))">🗑️</button>`
      : '';
    return `<tr>
      <td style="font-size:12px">${hr}</td>
      <td>${(l.tecnicos||'').split(',').map(t=>`<span style="background:#e8f0fe;color:#0056b3;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;margin-right:4px">${t.trim()}</span>`).join('')}</td>
      <td><b>${l.injetora}</b></td>
      <td><span style="background:${corT}20;color:${corT};padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700">${l.tipo}</span></td>
      <td>${l.atividade||'—'}</td>
      <td>${l.molde?`<b>${l.molde}</b>`:'—'}</td>
      <td>${flags||'—'}</td>
      <td style="font-size:12px;color:#64748b">${l.descricao||''}</td>
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

  // Agrupa por tipo
  const porTipo = {};
  _dadosProducao.forEach(l => {
    const tipo = l.tipo || 'Outros';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push(l);
  });

  // Ordem de exibição
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
      const tecs = (l.tecnicos||'').split(',').map(t=>t.trim()).filter(Boolean).join(', ');

      t += `→ *${l.injetora}*`;
      if (l.molde) t += ` | Molde: ${l.molde}`;
      t += '\n';
      if (l.atividade) t += `  📝 ${l.atividade}\n`;
      if (l.descricao) t += `  💬 ${l.descricao}\n`;
      t += `  👤 ${tecs} | ⏱️ ${hr}`;
      if (l.maquina_parada) t += ` | 🔴 *Máquina Parada*`;
      if (l.tem_os) t += ` | 📋 OS: ${l.numero_os||'?'}`;
      t += '\n\n';
    });
  });

  // Resumo
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
  _tecnicosSelecionados = [];
  resetarFormProducao();
  preencherFormProducao();
  document.getElementById('tituloFormProd').innerText = 'Novo Lançamento — Produção / Setup';
  document.getElementById('btnSalvarProd').innerText  = '💾 Salvar Lançamento';
  abrirModalFormProd();
}

async function editarProd(id) {
  const item = _dadosProducao.find(l => l.id === id);
  if (!item) return;
  document.getElementById('prodFormId').value = id;
  _tecnicosSelecionados = item.tecnicos ? item.tecnicos.split(',').map(t=>t.trim()) : [];
  resetarFormProducao();
  preencherFormProducao();
  document.getElementById('prodFormData').value  = item.data || '';
  document.getElementById('prodFormHrIni').value = item.hora_inicio ? item.hora_inicio.substring(0,5) : '';
  document.getElementById('prodFormHrFim').value = item.hora_fim    ? item.hora_fim.substring(0,5)    : '';
  setSelectP('prodFormInjetora', item.injetora);
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
  document.getElementById('tituloFormProd').innerText = 'Editar Lançamento — Produção';
  document.getElementById('btnSalvarProd').innerText  = '💾 Atualizar';
  abrirModalFormProd();
}

function cancelarFormProducao() { fecharModalFormProd(); }

function preencherFormProducao() {
  const selInj = document.getElementById('prodFormInjetora');
  if (selInj) selInj.innerHTML = '<option value="">Selecione...</option>' + _injetoras.map(i=>`<option value="${i.nome}">${i.nome}</option>`).join('');

  const selTec = document.getElementById('prodTecnicoSelect');
  if (selTec) selTec.innerHTML = '<option value="">+ Adicionar técnico...</option>' + _tecnicosProducao.map(t=>`<option value="${t.nome}">${t.nome}</option>`).join('');

  if (_listas) setupAC('prodFormMolde', 'prodFormMoldeList', _listas.jobs || []);

  const dataEl = document.getElementById('prodFormData');
  if (dataEl) dataEl.value = document.getElementById('prodData')?.value || new Date().toISOString().split('T')[0];
  renderizarTecnicos();
}

function adicionarTecnico() {
  const sel = document.getElementById('prodTecnicoSelect');
  const val = sel?.value;
  if (!val || _tecnicosSelecionados.includes(val)) { if (sel) sel.value=''; return; }
  _tecnicosSelecionados.push(val);
  if (sel) sel.value = '';
  renderizarTecnicos();
}

function removerTecnico(nome) {
  _tecnicosSelecionados = _tecnicosSelecionados.filter(t=>t!==nome);
  renderizarTecnicos();
}

function renderizarTecnicos() {
  const wrap = document.getElementById('prodTecnicosWrap');
  if (!wrap) return;
  wrap.innerHTML = _tecnicosSelecionados.map(t =>
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

async function salvarFormProducao() {
  const id = document.getElementById('prodFormId')?.value;
  if (!_tecnicosSelecionados.length) return toast('Adicione ao menos um técnico.','erro');
  const injetora = document.getElementById('prodFormInjetora')?.value;
  const tipo     = document.getElementById('prodFormTipo')?.value;
  if (!injetora) return toast('Selecione a injetora.','erro');
  if (!tipo)     return toast('Selecione o tipo de manutenção.','erro');
  const dados = {
    data:          document.getElementById('prodFormData')?.value,
    horaInicio:    document.getElementById('prodFormHrIni')?.value || null,
    horaFim:       document.getElementById('prodFormHrFim')?.value || null,
    tecnicos:      _tecnicosSelecionados.join(', '),
    injetora, molde: document.getElementById('prodFormMolde')?.value || null,
    tipo, atividade: document.getElementById('prodFormAtividade')?.value || null,
    descricao:     document.getElementById('prodFormDesc')?.value || null,
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
      resetarFormProducao(); preencherFormProducao();
      document.getElementById('prodFormData').value = dados.data;
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
   'prodFormTipo','prodFormAtividade','prodFormDesc','prodFormNumOS','prodFormObs']
    .forEach(id => { const el=document.getElementById(id); if(!el) return; if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; });
  const mp=document.getElementById('prodFormMaqParada'); if(mp) mp.checked=false;
  const os=document.getElementById('prodFormTemOS');     if(os) os.checked=false;
  const go=document.getElementById('grupoOS');           if(go) go.style.display='none';
  _tecnicosSelecionados = [];
  const btn=document.getElementById('btnSalvarProd'); if(btn) btn.innerText='💾 Salvar Lançamento';
}

function setSelectP(id, val) {
  const sel=document.getElementById(id); if(!sel||!val) return;
  for(let i=0;i<sel.options.length;i++) if(sel.options[i].value===val){sel.selectedIndex=i;return;}
}
