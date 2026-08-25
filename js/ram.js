// ==========================================
// 📋 RAM — Registro de Alteração/Modificação (substitui Pendências)
// ==========================================
const _RAM_SETORES = ['Usinagem', 'Bancada', 'Projeto', 'Produção'];

async function buscarRAMsPorJob(job) {
  const ramsBase = await db._get('ram', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.desc', '*');
  if (!ramsBase || !ramsBase.length) return [];
  const ids = ramsBase.map(r => r.id);
  const setores = await db._get('ram_setores', 'ram_id=in.(' + ids.join(',') + ')', '*');
  return ramsBase.map(r => ({ ...r, setores: (setores||[]).filter(s => s.ram_id === r.id) }));
}

// Só as RAMs que ainda têm pelo menos 1 setor pendente — usado no seletor do apontamento
async function buscarRAMsAbertasPorJob(job) {
  const todas = await buscarRAMsPorJob(job);
  return todas.filter(r => r.setores.some(s => !s.concluido));
}

// Todas as RAMs do sistema (qualquer molde) — usado na página dedicada de RAM
async function buscarTodasRAMs() {
  const ramsBase = await db._get('ram', 'order=criado_em.desc', '*');
  if (!ramsBase || !ramsBase.length) return [];
  const ids = ramsBase.map(r => r.id);
  const setores = await db._get('ram_setores', 'ram_id=in.(' + ids.join(',') + ')', '*');
  return ramsBase.map(r => ({ ...r, setores: (setores||[]).filter(s => s.ram_id === r.id) }));
}

// Todos os apontamentos (de qualquer setor) que foram vinculados a esta RAM
async function buscarApontamentosDaRAM(ramId) {
  const [lancs, prodLancs] = await Promise.all([
    db._get('lancamentos', 'ram_id=eq.' + ramId + '&order=data.desc,hora_inicio.desc', '*').catch(() => []),
    db._get('prod_lancamentos', 'ram_id=eq.' + ramId + '&order=data.desc,hora_inicio.desc', '*').catch(() => [])
  ]);
  const doLancs = (lancs||[]).map(l => ({
    setor: l.setor, funcionario: l.funcionario, data: l.data,
    horaInicio: l.hora_inicio, horaFim: l.hora_fim, descricao: l.descricao
  }));
  const doProd = (prodLancs||[]).map(p => ({
    setor: 'Produção', funcionario: p.tecnicos, data: p.data,
    horaInicio: p.hora_inicio, horaFim: p.hora_fim, descricao: p.descricao
  }));
  return [...doLancs, ...doProd].sort((a,b) => (b.data||'').localeCompare(a.data||''));
}

// Atualiza a tela certa depois de qualquer mudança na RAM, seja ela feita a
// partir da Ficha do Molde ou da página dedicada de RAM
async function _atualizarAposMudancaRAM() {
  if (_telaAtual === 'ficha' && typeof buscarFicha === 'function') await buscarFicha();
  if (_telaAtual === 'ram' && typeof carregarPainelRAM === 'function') await carregarPainelRAM();
}

// ==========================================
// 🔎 Página dedicada de RAM (visão consolidada, todos os moldes)
// ==========================================
var _todasRAMsCache = [];

async function inicializarPainelRAM() {
  const el = document.getElementById('telaRAM');
  if (!el) return;
  el.innerHTML = `
    <div class="page-header">
      <h1>📋 RAM — Registros de Alteração/Modificação</h1>
      <button class="btn-primary" onclick="abrirModalNovaRAM()">+ Nova RAM</button>
    </div>
    <div class="filtros-bar">
      <div class="filtro-item"><label>BUSCAR</label><input type="text" id="ramFiltroTexto" placeholder="Número, molde ou descrição..." oninput="filtrarPainelRAM()"></div>
      <div class="filtro-item"><label>SETOR</label><select id="ramFiltroSetor" onchange="filtrarPainelRAM()">
        <option value="Todos">Todos</option>
        ${_RAM_SETORES.map(s=>`<option value="${s}">${s}</option>`).join('')}
      </select></div>
      <div class="filtro-item"><label>STATUS</label><select id="ramFiltroStatus" onchange="filtrarPainelRAM()">
        <option value="abertas">Abertas</option>
        <option value="concluidas">Concluídas</option>
        <option value="todas">Todas</option>
      </select></div>
    </div>
    <div id="loaderRAM" class="loader-inline" style="display:none"><div class="spinner-sm"></div><span>Carregando RAMs...</span></div>
    <div id="listaPainelRAM"></div>
  `;
  await carregarPainelRAM();
}

async function carregarPainelRAM() {
  const loader = document.getElementById('loaderRAM');
  if (loader) loader.style.display = 'flex';
  try {
    _todasRAMsCache = await buscarTodasRAMs();
    filtrarPainelRAM();
  } catch(e) { toast('Erro ao carregar RAMs.', 'erro'); console.error(e); }
  if (loader) loader.style.display = 'none';
}

function filtrarPainelRAM() {
  const texto  = (document.getElementById('ramFiltroTexto')?.value || '').toLowerCase();
  const setor  = document.getElementById('ramFiltroSetor')?.value || 'Todos';
  const status = document.getElementById('ramFiltroStatus')?.value || 'abertas';

  const filtradas = _todasRAMsCache.filter(r => {
    if (texto && !(r.numero.toLowerCase().includes(texto) || r.job.toLowerCase().includes(texto) || (r.descricao||'').toLowerCase().includes(texto))) return false;
    if (setor !== 'Todos' && !r.setores.some(s => s.setor === setor)) return false;
    const estaAberta = r.setores.some(s => !s.concluido);
    if (status === 'abertas'    && !estaAberta) return false;
    if (status === 'concluidas' &&  estaAberta) return false;
    return true;
  });
  renderizarPainelRAM(filtradas);
}

function renderizarPainelRAM(rams) {
  const el = document.getElementById('listaPainelRAM');
  if (!el) return;
  if (!rams.length) {
    el.innerHTML = '<div class="empty-state"><div style="font-size:48px">📋</div><div>Nenhuma RAM encontrada.</div></div>';
    return;
  }
  // Atrasadas primeiro, depois por prazo mais próximo
  const ordenadas = [...rams].sort((a,b) => {
    const aAtrasada = a.prazo_final && new Date(a.prazo_final) < new Date() && a.setores.some(s=>!s.concluido);
    const bAtrasada = b.prazo_final && new Date(b.prazo_final) < new Date() && b.setores.some(s=>!s.concluido);
    if (aAtrasada !== bAtrasada) return aAtrasada ? -1 : 1;
    return (a.prazo_final||'9999-99-99').localeCompare(b.prazo_final||'9999-99-99');
  });

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${ordenadas.map(r => {
      const atrasada = r.prazo_final && new Date(r.prazo_final) < new Date() && r.setores.some(s=>!s.concluido);
      return `<div class="card" style="margin:0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-weight:700;color:#1e3a5f;font-size:14px">RAM ${r.numero}</div>
            <div style="font-size:12px;color:#0056b3;font-weight:600;cursor:pointer" onclick="abrirFichaMolde('${r.job.replace(/'/g,"\\'")}')">${r.job}</div>
          </div>
          ${r.prazo_final ? `<span style="background:${atrasada?'#fee2e2':'#fef3c7'};color:${atrasada?'#b91c1c':'#92400e'};font-size:11px;padding:3px 8px;border-radius:8px;font-weight:700;white-space:nowrap">${atrasada?'⚠️ atrasada':'prazo'} ${new Date(r.prazo_final+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:10px">${r.descricao||''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          ${r.setores.map(s => `<span style="background:${s.concluido?'#d1fae5':'#fee2e2'};color:${s.concluido?'#059669':'#b91c1c'};font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600">${s.concluido?'✓':'○'} ${s.setor}</span>`).join('')}
        </div>
        ${r.setores.filter(s=>s.concluido).length ? `<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:10px">
          ${r.setores.filter(s=>s.concluido).map(s => `<div style="font-size:11px;color:#059669">✓ <b>${s.setor}</b> — ${s.data_conclusao?new Date(s.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR'):'—'} por ${s.concluido_por||'—'}${s.descricao_conclusao?': '+s.descricao_conclusao:''}</div>`).join('')}
        </div>` : ''}
        <button class="btn-secondary" style="font-size:12px;width:100%" onclick="abrirDetalheRAM(${r.id},'${r.job.replace(/'/g,"\\'")}')">Gerenciar RAM</button>
      </div>`;
    }).join('')}
  </div>`;
}

// ==========================================
// Criar nova RAM
// ==========================================
function abrirModalNovaRAM(job) {
  const div = document.createElement('div');
  div.id = 'modalRamWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalRAM()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px;max-height:85vh;overflow-y:auto">
    <div class="modal-header"><h3>📋 Nova RAM${job ? ' — ' + job : ''}</h3><button onclick="fecharModalRAM()">✕</button></div>
    <div class="modal-body">
      ${!job ? `<div class="form-group"><label>Molde *</label>
        <div class="autocomplete-wrap">
          <input type="text" id="ramNovoJob" placeholder="Busque o molde...">
          <div class="autocomplete-list" id="ramNovoJobList"></div>
        </div>
      </div>` : ''}
      <div class="form-row">
        <div class="form-group"><label>Número da RAM *</label><input type="text" id="ramNumero" placeholder="Ex: 2026-0341"></div>
        <div class="form-group"><label>Prazo Final</label><input type="date" id="ramPrazo"></div>
      </div>
      <div class="form-group">
        <label>Descrição *</label>
        <textarea id="ramDescricao" rows="3" placeholder="O que precisa ser alterado/modificado..."></textarea>
      </div>
      <div class="form-group">
        <label>Setores Envolvidos *</label>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px">
          ${_RAM_SETORES.map(s => `<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer">
            <input type="checkbox" class="ram-setor-chk" value="${s}"> ${s}
          </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovaRAM('${job ? job.replace(/'/g,"\\'") : ''}')">💾 Criar RAM</button>
      <button class="btn-secondary" onclick="fecharModalRAM()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  if (!job && typeof setupAC === 'function') setupAC('ramNovoJob', 'ramNovoJobList', typeof _listaSoMoldes==='function'?_listaSoMoldes():((_listas&&_listas.jobs)||[]));
}

function fecharModalRAM() { document.getElementById('modalRamWrap')?.remove(); }

async function salvarNovaRAM(jobPreDefinido) {
  const job = jobPreDefinido || document.getElementById('ramNovoJob')?.value?.trim();
  const numero    = document.getElementById('ramNumero')?.value?.trim();
  const prazo     = document.getElementById('ramPrazo')?.value || null;
  const descricao = document.getElementById('ramDescricao')?.value?.trim();
  const setores   = [...document.querySelectorAll('.ram-setor-chk:checked')].map(c => c.value);
  if (!job) return toast('Selecione o molde.', 'erro');
  if (!(_listas && _listaSoMoldes().includes(job))) return toast('Esse molde não existe no cadastro (ou é uma categoria de serviço, não um molde).', 'erro');
  if (!numero) return toast('Informe o número da RAM.', 'erro');
  if (!descricao) return toast('Descreva o que precisa ser feito.', 'erro');
  if (!setores.length) return toast('Selecione ao menos um setor.', 'erro');
  try {
    const res = await db._post('ram', {
      numero, job, descricao, prazo_final: prazo, criado_por: _sessao?.nome || null
    });
    const ramId = res && res[0] ? res[0].id : null;
    if (ramId) {
      for (const setor of setores) {
        await db._post('ram_setores', { ram_id: ramId, setor, concluido: false });
      }
    }
    toast('RAM criada!', 'sucesso');
    fecharModalRAM();
    await _atualizarAposMudancaRAM();
  } catch(e) { toast('Erro ao criar RAM.', 'erro'); console.error(e); }
}

// ==========================================
// Detalhe / edição da RAM
// ==========================================
async function abrirDetalheRAM(ramId, job) {
  const todas = await buscarRAMsPorJob(job);
  const ram = todas.find(r => r.id === ramId);
  if (!ram) return toast('RAM não encontrada.', 'erro');
  const apontamentos = await buscarApontamentosDaRAM(ramId);

  const porSetor = {};
  apontamentos.forEach(a => { const s = a.setor||'—'; if (!porSetor[s]) porSetor[s] = []; porSetor[s].push(a); });

  const div = document.createElement('div');
  div.id = 'modalDetalheRamWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharDetalheRAM()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:520px;max-height:85vh;overflow-y:auto">
    <div class="modal-header"><h3>📋 RAM ${ram.numero}</h3><button onclick="fecharDetalheRAM()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Molde</label>
        <div class="autocomplete-wrap">
          <input type="text" id="ramEditJob" value="${ram.job.replace(/"/g,'&quot;')}" placeholder="Busque o molde...">
          <div class="autocomplete-list" id="ramEditJobList"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Número da RAM</label><input type="text" id="ramEditNumero" value="${ram.numero.replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>Prazo Final</label><input type="date" id="ramEditPrazo" value="${ram.prazo_final||''}"></div>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="ramEditDescricao" rows="3">${(ram.descricao||'').replace(/</g,'&lt;')}</textarea>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn-secondary" style="font-size:12px;flex:1" onclick="salvarEdicaoRAM(${ram.id})">💾 Salvar Alterações</button>
        <button class="btn-danger" style="font-size:12px;flex:1" onclick="excluirRAM(${ram.id})">🗑️ Excluir RAM</button>
      </div>

      <div style="font-weight:700;color:#1e3a5f;font-size:13px;margin-bottom:8px;border-top:1px solid #e2e8f0;padding-top:12px">Setores</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${ram.setores.map(s => `
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:13px;font-weight:600;color:#1e3a5f">${s.concluido?'✅':'⭕'} ${s.setor}</div>
                ${s.concluido ? `<div style="font-size:11px;color:#64748b;margin-top:2px">Concluído em ${new Date(s.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR')} por ${s.concluido_por||'—'}${s.descricao_conclusao?' — '+s.descricao_conclusao:''}</div>` : ''}
              </div>
              ${s.concluido
                ? `<button class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick="reabrirSetorRAM(${s.id},'${job.replace(/'/g,"\\'")}')">Reabrir</button>`
                : `<button class="btn-primary" style="font-size:11px;padding:4px 10px" onclick="abrirConclusaoSetorRAM(${s.id},'${ram.numero.replace(/'/g,"\\'")}','${s.setor}','${job.replace(/'/g,"\\'")}')">✅ Concluir</button>`}
            </div>
          </div>`).join('')}
      </div>

      <div style="font-weight:700;color:#1e3a5f;font-size:13px;margin-bottom:8px;border-top:1px solid #e2e8f0;padding-top:12px">Apontamentos Vinculados a Esta RAM</div>
      ${apontamentos.length ? Object.keys(porSetor).sort().map(setor => `
        <div style="margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:#0056b3;margin-bottom:4px">${setor} (${porSetor[setor].length})</div>
          ${porSetor[setor].map(a => `
            <div style="font-size:12px;color:#475569;padding:5px 0;border-bottom:1px dashed #f1f5f9">
              <b>${a.data?a.data.split('-').reverse().join('/'):'—'}</b> · ${a.funcionario||'—'} · ${a.horaInicio||'—'}–${a.horaFim||'—'}
              ${a.descricao?`<div style="color:#94a3b8">${a.descricao}</div>`:''}
            </div>`).join('')}
        </div>`).join('') : '<div style="color:#94a3b8;font-size:12px">Nenhum apontamento vinculado ainda.</div>'}
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="fecharDetalheRAM()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  if (typeof setupAC === 'function') setupAC('ramEditJob', 'ramEditJobList', typeof _listaSoMoldes==='function'?_listaSoMoldes():((_listas&&_listas.jobs)||[]));
}

function fecharDetalheRAM() { document.getElementById('modalDetalheRamWrap')?.remove(); }

async function salvarEdicaoRAM(ramId) {
  const job       = document.getElementById('ramEditJob')?.value?.trim();
  const numero    = document.getElementById('ramEditNumero')?.value?.trim();
  const prazo     = document.getElementById('ramEditPrazo')?.value || null;
  const descricao = document.getElementById('ramEditDescricao')?.value?.trim();
  if (!job) return toast('Informe o molde.', 'erro');
  if (!(_listas && _listaSoMoldes().includes(job))) return toast('Esse molde não existe no cadastro (ou é uma categoria de serviço, não um molde).', 'erro');
  if (!numero) return toast('Informe o número da RAM.', 'erro');
  try {
    await db._patch('ram', 'id=eq.'+ramId, { job, numero, prazo_final: prazo, descricao });
    if (typeof registrarLog === 'function') await registrarLog('ram', ramId, 'editar', null, null, 'Dados atualizados');
    toast('RAM atualizada!', 'sucesso');
    fecharDetalheRAM();
    await _atualizarAposMudancaRAM();
  } catch(e) { toast('Erro ao salvar.', 'erro'); }
}

async function excluirRAM(ramId) {
  confirmarExclusao('Excluir esta RAM? Essa ação não pode ser desfeita.', async () => {
    try {
      await db._delete('ram', 'id=eq.'+ramId);
      if (typeof registrarLog === 'function') await registrarLog('ram', ramId, 'excluir', null, 'RAM #'+ramId, null);
      toast('RAM excluída!', 'sucesso');
      fecharDetalheRAM();
      await _atualizarAposMudancaRAM();
    } catch(e) { toast('Erro ao excluir.', 'erro'); }
  });
}

// ==========================================
// Concluir / reabrir setor da RAM
// ==========================================
function abrirConclusaoSetorRAM(ramSetorId, numeroRam, setor, job) {
  const div = document.createElement('div');
  div.id = 'modalConcluirRamWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharConclusaoSetorRAM()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>✅ Concluir ${setor} — RAM ${numeroRam}</h3><button onclick="fecharConclusaoSetorRAM()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Descrição do que foi feito *</label>
        <textarea id="ramConclusaoDescricao" rows="3" placeholder="O que foi executado..."></textarea>
      </div>
      <div class="form-group">
        <label>Evidência (foto, opcional)</label>
        <input type="file" id="ramConclusaoArquivo" accept="image/*,video/*" capture="environment">
      </div>
      <div id="ramConclusaoStatus" style="font-size:12px;color:#64748b"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarConclusaoSetorRAM(${ramSetorId},'${numeroRam.replace(/'/g,"\\'")}','${job.replace(/'/g,"\\'")}')">💾 Concluir</button>
      <button class="btn-secondary" onclick="fecharConclusaoSetorRAM()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharConclusaoSetorRAM() { document.getElementById('modalConcluirRamWrap')?.remove(); }

async function salvarConclusaoSetorRAM(ramSetorId, numeroRam, job) {
  const descricao = document.getElementById('ramConclusaoDescricao')?.value?.trim();
  if (!descricao) return toast('Descreva o que foi feito.', 'erro');
  const arquivo = document.getElementById('ramConclusaoArquivo')?.files?.[0];
  const btn = document.querySelector('#modalConcluirRamWrap .btn-primary');
  if (btn) { btn.disabled = true; btn.innerText = 'Salvando...'; }
  try {
    if (arquivo && typeof uploadAnexoMolde === 'function') {
      const { url, tipo } = await uploadAnexoMolde(arquivo, job, 'ramConclusaoStatus');
      await salvarAnexoMolde(job, tipo, url, `RAM ${numeroRam} — ${descricao}`, 'RAM', null);
    }
    await db._patch('ram_setores', 'id=eq.'+ramSetorId, {
      concluido: true, data_conclusao: new Date().toISOString().split('T')[0],
      descricao_conclusao: descricao, concluido_por: _sessao?.nome || null
    });
    toast('Setor concluído!', 'sucesso');
    fecharConclusaoSetorRAM();
    fecharDetalheRAM();
    await _atualizarAposMudancaRAM();
  } catch(e) {
    toast(e.message || 'Erro ao concluir.', 'erro');
    if (btn) { btn.disabled = false; btn.innerText = '💾 Concluir'; }
  }
}

function reabrirSetorRAM(ramSetorId, job) {
  confirmarExclusao('Reabrir este setor da RAM?', async () => {
    try {
      await db._patch('ram_setores', 'id=eq.'+ramSetorId, {
        concluido: false, data_conclusao: null, descricao_conclusao: null, concluido_por: null
      });
      toast('Setor reaberto.', 'sucesso');
      fecharDetalheRAM();
      await _atualizarAposMudancaRAM();
    } catch(e) { toast('Erro ao reabrir.', 'erro'); }
  });
}

// ==========================================
// Renderização do card de RAM (Ficha do Molde)
// ==========================================
function renderizarCardRAM(job, rams) {
  if (!rams || !rams.length) {
    return '<div class="empty-msg">Nenhuma RAM registrada para este molde.</div>';
  }
  return rams.map(r => {
    const concluidas = r.setores.filter(s => s.concluido).length;
    const total = r.setores.length;
    const atrasada = r.prazo_final && new Date(r.prazo_final) < new Date() && concluidas < total;
    return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:700;color:#1e3a5f;font-size:14px">RAM ${r.numero}</div>
          <div style="font-size:12px;color:#64748b">${r.descricao||''}</div>
        </div>
        ${r.prazo_final ? `<span style="background:${atrasada?'#fee2e2':'#fef3c7'};color:${atrasada?'#b91c1c':'#92400e'};font-size:11px;padding:3px 8px;border-radius:8px;font-weight:700;white-space:nowrap">${atrasada?'⚠️ atrasada':'prazo'} ${new Date(r.prazo_final+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        ${r.setores.map(s => `<span style="background:${s.concluido?'#d1fae5':'#fee2e2'};color:${s.concluido?'#059669':'#b91c1c'};font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600">${s.concluido?'✓':'○'} ${s.setor}${!s.concluido?' pendente':''}</span>`).join('')}
      </div>
      ${r.setores.filter(s=>s.concluido).length ? `<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:10px">
        ${r.setores.filter(s=>s.concluido).map(s => `<div style="font-size:11px;color:#059669">✓ <b>${s.setor}</b> — ${s.data_conclusao?new Date(s.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR'):'—'} por ${s.concluido_por||'—'}${s.descricao_conclusao?': '+s.descricao_conclusao:''}</div>`).join('')}
      </div>` : ''}
      <button class="btn-secondary" style="font-size:12px;width:100%" onclick="abrirDetalheRAM(${r.id},'${job.replace(/'/g,"\\'")}')">Gerenciar RAM</button>
    </div>`;
  }).join('');
}
