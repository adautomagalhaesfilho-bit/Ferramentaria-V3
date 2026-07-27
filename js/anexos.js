// ==========================================
// 📎 ANEXOS DE MOLDE (Fotos e Vídeos) — Ficha do Molde
// ==========================================
const _ANEXOS_BUCKET = 'molde-anexos';
const _ANEXO_VIDEO_MAX_SEGUNDOS = 30;
const _ANEXO_VIDEO_MAX_MB = 25;

// Confere a duração do vídeo antes de enviar — recusa se passar de 30s
async function _validarDuracaoVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (video.duration > _ANEXO_VIDEO_MAX_SEGUNDOS) {
        reject(new Error(`O vídeo tem ${Math.round(video.duration)}s — o máximo permitido é ${_ANEXO_VIDEO_MAX_SEGUNDOS}s.`));
      } else {
        resolve();
      }
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler o vídeo.')); };
    video.src = url;
  });
}

// Faz upload do arquivo (foto comprimida ou vídeo validado) pro Storage e retorna a URL pública
async function uploadAnexoMolde(file, job, statusElId) {
  const status = statusElId ? document.getElementById(statusElId) : null;
  const isVideo = file.type.startsWith('video/');
  let blob, ext, tipo;

  if (isVideo) {
    if (file.size > _ANEXO_VIDEO_MAX_MB * 1024 * 1024) {
      throw new Error(`Vídeo muito grande (máximo ${_ANEXO_VIDEO_MAX_MB}MB).`);
    }
    if (status) status.innerText = 'Verificando duração do vídeo...';
    await _validarDuracaoVideo(file);
    blob = file;
    ext  = (file.name.split('.').pop() || 'mp4').toLowerCase();
    tipo = 'Vídeo';
  } else {
    if (status) status.innerText = 'Comprimindo imagem...';
    blob = await _comprimirImagem(file, 1200, 0.78);
    ext  = 'jpg';
    tipo = 'Foto';
  }

  if (status) status.innerText = `Enviando... (${(blob.size/1024/1024).toFixed(1)} MB)`;
  const ts = Date.now();
  const pastaJob = (job || 'sem-job').replace(/[^a-zA-Z0-9]/g, '_');
  const nome = `${pastaJob}/${ts}.${ext}`;
  const url  = `${SUPABASE_URL}/storage/v1/object/${_ANEXOS_BUCKET}/${nome}`;
  const res  = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': isVideo ? file.type : 'image/jpeg', 'x-upsert': 'true'
    },
    body: blob
  });
  if (!res.ok) throw new Error('Upload falhou: ' + (await res.text()));
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${_ANEXOS_BUCKET}/${nome}`;
  return { url: publicUrl, tipo };
}

async function salvarAnexoMolde(job, tipo, url, descricao, setorOrigem, lancamentoId) {
  return await db._post('molde_anexos', {
    job, tipo, url, descricao: descricao || null,
    setor_origem: setorOrigem || null, lancamento_id: lancamentoId || null,
    criado_por: _sessao?.nome || null
  });
}

async function buscarAnexosMolde(job) {
  return await db._get('molde_anexos', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.desc', '*');
}

function excluirAnexoMolde(id, criadoPor) {
  const podeExcluir = (typeof isAdmin === 'function' && isAdmin()) || (_sessao?.nome === criadoPor);
  if (!podeExcluir) { toast('Só quem enviou ou um administrador pode excluir este anexo.', 'erro'); return; }
  confirmarExclusao('Excluir este anexo?', async () => {
    try {
      await db._delete('molde_anexos', 'id=eq.' + id);
      toast('Anexo removido!', 'sucesso');
      if (typeof buscarFicha === 'function') await buscarFicha();
    } catch(e) { toast('Erro ao excluir.', 'erro'); }
  });
}

// Edita a descrição de um anexo já enviado — mesma regra de permissão da exclusão
function abrirEdicaoDescricaoAnexo(id, criadoPor, descricaoAtual) {
  const podeEditar = (typeof isAdmin === 'function' && isAdmin()) || (_sessao?.nome === criadoPor);
  if (!podeEditar) { toast('Só quem enviou ou um administrador pode editar esta descrição.', 'erro'); return; }
  const div = document.createElement('div');
  div.id = 'modalEditDescAnexoWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoDescricaoAnexo()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:400px">
    <div class="modal-header"><h3>✏️ Editar Descrição</h3><button onclick="fecharEdicaoDescricaoAnexo()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="editDescAnexoTexto" rows="3">${(descricaoAtual||'').replace(/</g,'&lt;')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoDescricaoAnexo(${id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoDescricaoAnexo()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharEdicaoDescricaoAnexo() { document.getElementById('modalEditDescAnexoWrap')?.remove(); }

async function salvarEdicaoDescricaoAnexo(id) {
  const novaDescricao = document.getElementById('editDescAnexoTexto')?.value?.trim() || null;
  try {
    await db._patch('molde_anexos', 'id=eq.'+id, { descricao: novaDescricao });
    toast('Descrição atualizada!', 'sucesso');
    fecharEdicaoDescricaoAnexo();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) { toast('Erro ao salvar.', 'erro'); }
}

// ==========================================
// Modal de anexar direto na Ficha do Molde
// ==========================================
var _anexoMoldeArquivoSelecionado = null;

function _sincronizarAnexoSelecionado(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  _anexoMoldeArquivoSelecionado = file;
  const nomeEl = document.getElementById('anexoMoldeArquivoNome');
  if (nomeEl) nomeEl.innerText = '✅ ' + file.name + ' (' + (file.size/1024/1024).toFixed(1) + ' MB)';
}

function abrirModalAnexoMolde(job) {
  _anexoMoldeArquivoSelecionado = null;
  const div = document.createElement('div');
  div.id = 'modalAnexoMoldeWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalAnexoMolde()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:440px">
    <div class="modal-header"><h3>📎 Anexar Foto/Vídeo — ${job}</h3><button onclick="fecharModalAnexoMolde()">✕</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Arquivo (foto, ou vídeo de até 30s) *</label>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <button type="button" class="btn-secondary" style="flex:1;font-size:12px" onclick="document.getElementById('anexoMoldeArquivoCamera').click()">📷 Tirar Foto Agora</button>
          <button type="button" class="btn-secondary" style="flex:1;font-size:12px" onclick="document.getElementById('anexoMoldeArquivo').click()">📁 Escolher Arquivo</button>
        </div>
        <input type="file" id="anexoMoldeArquivoCamera" accept="image/*" capture="environment" style="display:none" onchange="_sincronizarAnexoSelecionado(this)">
        <input type="file" id="anexoMoldeArquivo" accept="image/*,video/*" style="display:none" onchange="_sincronizarAnexoSelecionado(this)">
        <div id="anexoMoldeArquivoNome" style="font-size:12px;color:#64748b">Nenhum arquivo selecionado ainda.</div>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="anexoMoldeDescricao" rows="3" placeholder="O que esse registro mostra..."></textarea>
      </div>
      <div id="anexoMoldeStatus" style="font-size:12px;color:#64748b"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovoAnexoMolde('${job.replace(/'/g,"\\'")}')">💾 Enviar</button>
      <button class="btn-secondary" onclick="fecharModalAnexoMolde()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharModalAnexoMolde() { document.getElementById('modalAnexoMoldeWrap')?.remove(); }

async function salvarNovoAnexoMolde(job) {
  const file = _anexoMoldeArquivoSelecionado;
  const descricao = document.getElementById('anexoMoldeDescricao')?.value?.trim();
  if (!file) return toast('Selecione ou tire uma foto/vídeo.', 'erro');
  const btn = document.querySelector('#modalAnexoMoldeWrap .btn-primary');
  if (btn) { btn.disabled = true; btn.innerText = 'Enviando...'; }
  try {
    const { url, tipo } = await uploadAnexoMolde(file, job, 'anexoMoldeStatus');
    await salvarAnexoMolde(job, tipo, url, descricao, 'Ficha', null);
    toast('Anexo salvo!', 'sucesso');
    fecharModalAnexoMolde();
    if (typeof buscarFicha === 'function') await buscarFicha();
  } catch(e) {
    toast(e.message || 'Erro ao enviar anexo.', 'erro');
    if (btn) { btn.disabled = false; btn.innerText = '💾 Enviar'; }
  }
}

// ==========================================
// Renderização da galeria (usada na Ficha do Molde)
// ==========================================
function renderizarGaleriaAnexosMolde(anexos) {
  if (!anexos || !anexos.length) {
    return '<div class="empty-msg">Nenhuma foto ou vídeo registrado para este molde.</div>';
  }
  const ordenados = [...anexos].sort((a,b) => new Date(b.criado_em) - new Date(a.criado_em));
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px">
    ${ordenados.map(a => {
      const podeExcluir = (typeof isAdmin === 'function' && isAdmin()) || (_sessao?.nome === a.criado_por);
      const dataFmt = a.criado_em ? new Date(a.criado_em).toLocaleDateString('pt-BR') : '—';
      const midia = a.tipo === 'Vídeo'
        ? `<video src="${a.url}" controls style="width:100%;height:120px;object-fit:cover;border-radius:8px;background:#000"></video>`
        : `<img src="${a.url}" onclick="window.open('${a.url}','_blank')" style="width:100%;height:120px;object-fit:cover;border-radius:8px;cursor:pointer">`;
      return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px">
        ${midia}
        <div style="font-size:11px;color:#64748b;margin-top:6px">${dataFmt} · ${a.criado_por||'—'}${a.setor_origem&&a.setor_origem!=='Ficha'?' · '+a.setor_origem:''}</div>
        ${a.descricao ? `<div style="font-size:12px;color:#1e3a5f;margin-top:2px">${a.descricao}</div>` : ''}
        <div style="display:flex;gap:6px;margin-top:6px">
          ${podeExcluir ? `<button class="btn-secondary" style="font-size:10px;padding:3px 8px" onclick="abrirEdicaoDescricaoAnexo(${a.id},'${(a.criado_por||'').replace(/'/g,"\\'")}','${(a.descricao||'').replace(/'/g,"\\'").replace(/\n/g,' ')}')">✏️ Editar</button>` : ''}
          ${podeExcluir ? `<button class="btn-danger" style="font-size:10px;padding:3px 8px" onclick="excluirAnexoMolde(${a.id},'${(a.criado_por||'').replace(/'/g,"\\'")}')">🗑️ Excluir</button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}
