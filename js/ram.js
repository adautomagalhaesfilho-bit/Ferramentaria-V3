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

// ==========================================
// Criar nova RAM
// ==========================================
function abrirModalNovaRAM(job) {
  const div = document.createElement('div');
  div.id = 'modalRamWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalRAM()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px;max-height:85vh;overflow-y:auto">
    <div class="modal-header"><h3>📋 Nova RAM — ${job}</h3><button onclick="fecharModalRAM()">✕</button></div>
    <div class="modal-body">
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
      <button class="btn-primary" onclick="salvarNovaRAM('${job.replace(/'/g,"\\'")}')">💾 Criar RAM</button>
      <button class="btn-secondary" onclick="fecharModalRAM()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharModalRAM() { document.getElementById('modalRamWrap')?.remove(); }

async function salvarNovaRAM(job) {
  const numero    = document.getElementById('ramNumero')?.value?.trim();
  const prazo     = document.getElementById('ramPrazo')?.value || null;
  const descricao = document.getElementById('ramDescricao')?.value?.trim();
  const setores   = [...document.querySelectorAll('.ram-setor-chk:checked')].map(c => c.value);
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
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) { toast('Erro ao criar RAM.', 'erro'); console.error(e); }
}

// ==========================================
// Detalhe / edição da RAM
// ==========================================
async function abrirDetalheRAM(ramId, job) {
  const todas = await buscarRAMsPorJob(job);
  const ram = todas.find(r => r.id === ramId);
  if (!ram) return toast('RAM não encontrada.', 'erro');

  const div = document.createElement('div');
  div.id = 'modalDetalheRamWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharDetalheRAM()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:500px;max-height:85vh;overflow-y:auto">
    <div class="modal-header"><h3>📋 RAM ${ram.numero}</h3><button onclick="fecharDetalheRAM()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Número da RAM</label><input type="text" id="ramEditNumero" value="${ram.numero.replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>Prazo Final</label><input type="date" id="ramEditPrazo" value="${ram.prazo_final||''}"></div>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="ramEditDescricao" rows="3">${(ram.descricao||'').replace(/</g,'&lt;')}</textarea>
      </div>
      <button class="btn-secondary" style="font-size:12px;margin-bottom:16px" onclick="salvarEdicaoRAM(${ram.id})">💾 Salvar Alterações</button>

      <div style="font-weight:700;color:#1e3a5f;font-size:13px;margin-bottom:8px;border-top:1px solid #e2e8f0;padding-top:12px">Setores</div>
      <div style="display:flex;flex-direction:column;gap:8px">
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
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="fecharDetalheRAM()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharDetalheRAM() { document.getElementById('modalDetalheRamWrap')?.remove(); }

async function salvarEdicaoRAM(ramId) {
  const numero    = document.getElementById('ramEditNumero')?.value?.trim();
  const prazo     = document.getElementById('ramEditPrazo')?.value || null;
  const descricao = document.getElementById('ramEditDescricao')?.value?.trim();
  if (!numero) return toast('Informe o número da RAM.', 'erro');
  try {
    await db._patch('ram', 'id=eq.'+ramId, { numero, prazo_final: prazo, descricao });
    if (typeof registrarLog === 'function') await registrarLog('ram', ramId, 'editar', null, null, 'Dados atualizados');
    toast('RAM atualizada!', 'sucesso');
    fecharDetalheRAM();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) { toast('Erro ao salvar.', 'erro'); }
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
    if (typeof buscarFicha === 'function') await buscarFicha();
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
      if (typeof buscarFicha === 'function') await buscarFicha();
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
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${r.setores.map(s => `<span style="background:${s.concluido?'#d1fae5':'#fee2e2'};color:${s.concluido?'#059669':'#b91c1c'};font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600">${s.concluido?'✓':'○'} ${s.setor}${!s.concluido?' pendente':''}</span>`).join('')}
      </div>
      <button class="btn-secondary" style="font-size:12px;width:100%" onclick="abrirDetalheRAM(${r.id},'${job.replace(/'/g,"\\'")}')">Gerenciar RAM</button>
    </div>`;
  }).join('');
}
