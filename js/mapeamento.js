// ==========================================
// 📐 MAPEAMENTO DE CALÇOS — Ficha do Molde + Aviso no Apontamento de Bancada
// ==========================================
function podeGerenciarMapeamento() {
  const perfil = _sessao?.perfil;
  return (typeof isAdmin === 'function' && isAdmin()) ||
         ['supervisor','pcm','gestor'].includes(perfil);
}

// Mapeamento "vence" depois desse prazo — precisa ser refeito/reverificado
const _MAPEAMENTO_VALIDADE_DIAS = 90;

function _diasDesdeMapeamento(dataMapeamento) {
  return Math.floor((new Date() - new Date(dataMapeamento+'T12:00:00')) / 86400000);
}

async function buscarMapeamentosCalcos(job) {
  return await db._get('molde_mapeamento_calcos', 'job=eq.' + encodeURIComponent(job) + '&order=data_mapeamento.desc,criado_em.desc', '*');
}

// ==========================================
// Registrar novo mapeamento (data + observação + anexo opcional do documento)
// ==========================================
function abrirModalNovoMapeamento(job) {
  if (!podeGerenciarMapeamento()) return toast('Só Supervisor, PCM, Gestor ou Admin podem registrar o mapeamento.', 'erro');
  const div = document.createElement('div');
  div.id = 'modalMapeamentoWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalMapeamento()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>📐 Mapeamento de Calços — ${esc(job)}</h3><button onclick="fecharModalMapeamento()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Data do Mapeamento *</label>
        <input type="date" id="mapDataInput" value="${esc(hojeLocal())}">
      </div>
      <div class="form-group">
        <label>Observação</label>
        <textarea id="mapObsInput" rows="2" placeholder="Opcional..."></textarea>
      </div>
      <div class="form-group">
        <label>Documento Digitalizado (foto, opcional)</label>
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <button type="button" class="btn-secondary" style="flex:1;font-size:12px" onclick="document.getElementById('mapArquivoCamera').click()">📷 Tirar Foto</button>
          <button type="button" class="btn-secondary" style="flex:1;font-size:12px" onclick="document.getElementById('mapArquivoEscolher').click()">📁 Escolher Arquivo</button>
        </div>
        <input type="file" id="mapArquivoCamera" accept="image/*" capture="environment" style="display:none" onchange="_sincronizarArquivoMapeamento(this)">
        <input type="file" id="mapArquivoEscolher" accept="image/*" style="display:none" onchange="_sincronizarArquivoMapeamento(this)">
        <div id="mapArquivoNome" style="font-size:12px;color:#64748b">Nenhum arquivo selecionado.</div>
      </div>
      <div id="mapStatus" style="font-size:12px;color:#64748b"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovoMapeamento('${escJs(job)}')">💾 Registrar</button>
      <button class="btn-secondary" onclick="fecharModalMapeamento()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  _arquivoMapeamentoSelecionado = null;
}

function fecharModalMapeamento() { document.getElementById('modalMapeamentoWrap')?.remove(); }

var _arquivoMapeamentoSelecionado = null;
function _sincronizarArquivoMapeamento(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  _arquivoMapeamentoSelecionado = file;
  const nomeEl = document.getElementById('mapArquivoNome');
  if (nomeEl) nomeEl.innerText = '✅ ' + file.name;
}

async function salvarNovoMapeamento(job) {
  const data = document.getElementById('mapDataInput')?.value;
  const obs  = document.getElementById('mapObsInput')?.value?.trim() || null;
  if (!data) return toast('Informe a data do mapeamento.', 'erro');
  const btn = document.querySelector('#modalMapeamentoWrap .btn-primary');
  if (btn) { btn.disabled = true; btn.innerText = 'Salvando...'; }
  try {
    if (_arquivoMapeamentoSelecionado && typeof uploadAnexoMolde === 'function') {
      const { url, tipo } = await uploadAnexoMolde(_arquivoMapeamentoSelecionado, job, 'mapStatus');
      await salvarAnexoMolde(job, tipo, url, `Mapeamento de Calços (${data})${obs?' — '+obs:''}`, 'Mapeamento de Calços', null);
    }
    await db._post('molde_mapeamento_calcos', {
      job, data_mapeamento: data, observacao: obs, criado_por: _sessao?.nome || null
    });
    toast('Mapeamento registrado!', 'sucesso');
    fecharModalMapeamento();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) {
    toast(e.message || 'Erro ao registrar mapeamento.', 'erro');
    if (btn) { btn.disabled = false; btn.innerText = '💾 Registrar'; }
  }
}

// ==========================================
// Editar um registro de mapeamento já existente
// ==========================================
function abrirEdicaoMapeamento(id, job, dataAtual, obsAtual) {
  if (!podeGerenciarMapeamento()) return toast('Só Supervisor, PCM, Gestor ou Admin podem editar o mapeamento.', 'erro');
  const div = document.createElement('div');
  div.id = 'modalMapeamentoWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalMapeamento()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>✏️ Editar Mapeamento — ${esc(job)}</h3><button onclick="fecharModalMapeamento()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Data do Mapeamento *</label>
        <input type="date" id="mapDataInput" value="${esc(dataAtual||'')}">
      </div>
      <div class="form-group">
        <label>Observação</label>
        <textarea id="mapObsInput" rows="2" placeholder="Opcional...">${esc(obsAtual||'')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoMapeamento(${id},'${escJs(job)}')">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalMapeamento()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarEdicaoMapeamento(id, job) {
  const data = document.getElementById('mapDataInput')?.value;
  const obs  = document.getElementById('mapObsInput')?.value?.trim() || null;
  if (!data) return toast('Informe a data do mapeamento.', 'erro');
  try {
    await db._patch('molde_mapeamento_calcos', 'id=eq.'+id, { data_mapeamento: data, observacao: obs });
    if (typeof registrarLog === 'function') await registrarLog('molde_mapeamento_calcos', id, 'editar', null, null, job);
    toast('Mapeamento atualizado!', 'sucesso');
    fecharModalMapeamento();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) { toast('Erro ao salvar.', 'erro'); }
}

function excluirMapeamento(id, job) {
  if (!podeGerenciarMapeamento()) return toast('Só Supervisor, PCM, Gestor ou Admin podem excluir o mapeamento.', 'erro');
  confirmarExclusao('Excluir este registro de mapeamento?', async () => {
    try {
      await db._delete('molde_mapeamento_calcos', 'id=eq.'+id);
      if (typeof registrarLog === 'function') await registrarLog('molde_mapeamento_calcos', id, 'excluir', null, job, null);
      toast('Mapeamento excluído!', 'sucesso');
      if (typeof buscarFicha === 'function') await buscarFicha();
    } catch(e) { toast('Erro ao excluir.', 'erro'); }
  });
}

// ==========================================
// Card na Ficha do Molde
// ==========================================
function renderizarCardMapeamento(job, mapeamentos) {
  const podeEditar = typeof podeGerenciarMapeamento === 'function' && podeGerenciarMapeamento();
  const ultimo = mapeamentos && mapeamentos.length ? mapeamentos[0] : null;
  let html = '';
  if (ultimo) {
    const dias = _diasDesdeMapeamento(ultimo.data_mapeamento);
    const desatualizado = dias > _MAPEAMENTO_VALIDADE_DIAS;
    const botoes = podeEditar ? `<div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn-secondary" style="font-size:11px;padding:3px 10px" onclick="abrirEdicaoMapeamento(${ultimo.id},'${escJs(job)}','${escJs(ultimo.data_mapeamento)}','${escJs(ultimo.observacao||'')}')">✏️ Editar</button>
        <button class="btn-danger" style="font-size:11px;padding:3px 10px" onclick="excluirMapeamento(${ultimo.id},'${escJs(job)}')">🗑️ Excluir</button>
      </div>` : '';
    if (desatualizado) {
      html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-size:13px;color:#92400e;font-weight:700">⚠️ Mapeamento desatualizado — feito há ${esc(dias)} dias (válido por ${esc(_MAPEAMENTO_VALIDADE_DIAS)})</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Último em ${esc(new Date(ultimo.data_mapeamento+'T12:00:00').toLocaleDateString('pt-BR'))} por ${esc(ultimo.criado_por||'—')}${esc(ultimo.observacao?' — '+ultimo.observacao:'')}</div>
        ${botoes}
      </div>`;
    } else {
      html += `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-size:13px;color:#059669;font-weight:700">✅ Mapeamento feito em ${esc(new Date(ultimo.data_mapeamento+'T12:00:00').toLocaleDateString('pt-BR'))}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">por ${esc(ultimo.criado_por||'—')}${esc(ultimo.observacao?' — '+ultimo.observacao:'')} · válido por mais ${esc(_MAPEAMENTO_VALIDADE_DIAS-dias)} dias</div>
        ${botoes}
      </div>`;
    }
  } else {
    html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-size:13px;color:#b91c1c;font-weight:700">⚠️ Nenhum mapeamento de calços registrado ainda</div>
    </div>`;
  }
  if (mapeamentos && mapeamentos.length > 1) {
    html += `<details style="margin-bottom:4px">
      <summary style="cursor:pointer;font-size:12px;color:#0056b3;font-weight:600">Ver histórico de mapeamentos anteriores</summary>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
        ${mapeamentos.slice(1).map(m => {
          return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#64748b;padding:4px 0;border-bottom:1px dashed #f1f5f9">
            <span>${esc(new Date(m.data_mapeamento+'T12:00:00').toLocaleDateString('pt-BR'))} — ${esc(m.criado_por||'—')}${esc(m.observacao?' — '+m.observacao:'')}</span>
            ${podeEditar ? `<span style="display:flex;gap:6px;flex-shrink:0;margin-left:8px">
              <button class="btn-secondary" style="font-size:10px;padding:2px 7px" onclick="abrirEdicaoMapeamento(${m.id},'${escJs(job)}','${escJs(m.data_mapeamento)}','${escJs(m.observacao||'')}')">✏️</button>
              <button class="btn-danger" style="font-size:10px;padding:2px 7px" onclick="excluirMapeamento(${m.id},'${escJs(job)}')">🗑️</button>
            </span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </details>`;
  }
  return html;
}

// ==========================================
// Aviso no apontamento da Bancada — quando o molde não tem mapeamento
// ==========================================
async function _verificarMapeamentoCalcosApontamento(job) {
  const el = document.getElementById('avisoMapeamentoCalcos');
  if (!el) return;
  if (!job) { el.style.display = 'none'; return; }
  try {
    const mapeamentos = await buscarMapeamentosCalcos(job);
    if (!mapeamentos || !mapeamentos.length) {
      el.innerHTML = `⚠️ Este molde ainda não tem <b>mapeamento de calços</b> registrado.`;
      el.style.display = '';
      return;
    }
    const dias = _diasDesdeMapeamento(mapeamentos[0].data_mapeamento);
    if (dias > _MAPEAMENTO_VALIDADE_DIAS) {
      el.innerHTML = `⚠️ O <b>mapeamento de calços</b> deste molde está desatualizado (feito há ${esc(dias)} dias) — precisa ser refeito.`;
      el.style.display = '';
      return;
    }
    el.style.display = 'none';
  } catch(e) { el.style.display = 'none'; }
}
