// ==========================================
// 🛠️ INTERVENCOES.JS — Histórico de Intervenções do Molde
// ==========================================

function podeRegistrarIntervencao() {
  return typeof _temPermissao === 'function' && _temPermissao('intervencoes');
}

// ==========================================
// 🖼️ RENDERIZAÇÃO DA LISTA (usado na Ficha do Molde)
// ==========================================
function renderizarIntervencoesHTML(lista, job) {
  if (!lista || !lista.length) {
    return '<div style="color:#94a3b8;font-size:13px;padding:8px 0">Nenhuma intervenção registrada para este molde.</div>';
  }
  const jobEsc = job.replace(/'/g,"\\'");
  return `<div style="position:relative;padding-left:24px">
    ${lista.map(iv => {
      const dt = iv.data ? iv.data.split('-').reverse().join('/') : '—';
      const podeGerenciar = podeRegistrarIntervencao();
      return `<div style="position:relative;margin-bottom:14px">
        <div style="position:absolute;left:-24px;top:4px;width:12px;height:12px;border-radius:50%;background:#059669;border:2px solid #fff;box-shadow:0 0 0 2px #059669"></div>
        <div style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;border-left:3px solid #059669;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:700;color:#059669">📅 ${dt}</span>
              ${iv.tipo?`<span style="background:#d1fae5;color:#065f46;font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600">${iv.tipo}</span>`:''}
            </div>
            ${podeGerenciar ? `<div style="display:flex;gap:4px;flex-shrink:0">
              <button onclick='abrirModalIntervencao("${jobEsc}",${JSON.stringify(iv).replace(/'/g,"&apos;")})' style="background:none;border:none;color:#0056b3;cursor:pointer;font-size:12px;padding:0">✏️</button>
              <button onclick="excluirIntervencaoConfirm(${iv.id},'${jobEsc}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;padding:0">🗑️</button>
            </div>` : ''}
          </div>
          <div style="font-size:13px;color:#1e3a5f;margin-top:6px">${iv.descricao}</div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:6px">👤 ${iv.criado_por||'—'}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ==========================================
// ➕ MODAL — CRIAR / EDITAR INTERVENÇÃO
// ==========================================
function abrirModalIntervencao(job, intervencaoExistente) {
  if (!podeRegistrarIntervencao()) return toast('Você não tem permissão para registrar intervenções.','erro');
  const iv = intervencaoExistente || null;
  const div = document.createElement('div');
  div.id = 'modalIntervencaoWrap';
  const hoje = new Date().toISOString().split('T')[0];
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalIntervencao()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px">
    <div class="modal-header"><h3>🛠️ ${iv&&iv.id?'Editar':'Registrar'} Intervenção</h3><button onclick="fecharModalIntervencao()">✕</button></div>
    <div class="modal-body">
      <div style="font-size:12px;color:#64748b;margin-bottom:4px">Molde</div>
      <div style="font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:14px">${job}</div>
      <div class="form-row">
        <div class="form-group"><label>Data *</label><input type="date" id="ivData" value="${iv?.data || hoje}"></div>
        <div class="form-group"><label>Tipo</label><input type="text" id="ivTipo" placeholder="Ex: Ajuste, Reforma, Troca de peça..." value="${(iv?.tipo||'').replace(/"/g,'&quot;')}"></div>
      </div>
      <div class="form-group">
        <label>Descrição *</label>
        <textarea id="ivDescricao" rows="4" placeholder="Descreva a intervenção realizada...">${iv?.descricao||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarIntervencao('${job.replace(/'/g,"\\'")}'${iv?','+iv.id:''})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalIntervencao()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharModalIntervencao() {
  document.getElementById('modalIntervencaoWrap')?.remove();
}

async function salvarIntervencao(job, id) {
  const data      = document.getElementById('ivData')?.value;
  const tipo      = document.getElementById('ivTipo')?.value?.trim() || null;
  const descricao = document.getElementById('ivDescricao')?.value?.trim();
  if (!data)      return toast('Informe a data.','erro');
  if (!descricao) return toast('Descreva a intervenção.','erro');
  try {
    const payload = { job, data, tipo, descricao };
    if (id) payload.id = id;
    else payload.criado_por = _sessao?.nome || null;
    await db.salvarIntervencao(payload);
    toast(id ? 'Intervenção atualizada!' : 'Intervenção registrada!','sucesso');
    fecharModalIntervencao();
    await _recarregarIntervencoesNaFicha(job);
  } catch(e) { toast('Erro ao salvar intervenção.','erro'); console.error(e); }
}

function excluirIntervencaoConfirm(id, job) {
  if (!podeRegistrarIntervencao()) return toast('Você não tem permissão para isso.','erro');
  confirmarExclusao('Excluir este registro de intervenção?', async () => {
    try {
      await db.excluirIntervencao(id);
      toast('Intervenção removida!','sucesso');
      await _recarregarIntervencoesNaFicha(job);
    } catch(e) { toast('Erro ao excluir.','erro'); }
  });
}

// Recarrega só a seção de intervenções dentro da Ficha do Molde (sem recarregar a ficha inteira)
async function _recarregarIntervencoesNaFicha(job) {
  const el = document.getElementById('fichaIntervencoes');
  if (!el) return; // não está na tela da ficha (ex: veio do PCM) — nada a atualizar
  try {
    const lista = await db.listarIntervencoesPorJob(job);
    if (_dadosFicha) _dadosFicha.intervencoes = lista;
    el.innerHTML = renderizarIntervencoesHTML(lista, job);
  } catch(e) {}
}
