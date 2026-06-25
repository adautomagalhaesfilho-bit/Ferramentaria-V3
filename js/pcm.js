// ==========================================
// 🗂️ PCM.JS — Planejamento e Controle de Moldes
// ==========================================

var _dadosPCM = [];
var _filtroLocPCM = 'Todos';

// ==========================================
// 🏠 LOCALIZAÇÕES
// ==========================================
const _LOCALIZACOES = [
  { id:'Em Máquina',        ico:'🟢', cor:'#10b981', bg:'#d1fae5', desc:'Molde ativo em produção' },
  { id:'Na Ferramentaria',  ico:'🔧', cor:'#0056b3', bg:'#dbeafe', desc:'Em manutenção/reparo' },
  { id:'Sala de Molde',     ico:'📦', cor:'#8b5cf6', bg:'#ede9fe', desc:'Aguardando em estoque' },
  { id:'Desativado/LOG',    ico:'🔴', cor:'#ef4444', bg:'#fee2e2', desc:'Fora de uso / inativo' },
];

function _infoLoc(loc) {
  return _LOCALIZACOES.find(l=>l.id===loc) || { ico:'❓', cor:'#64748b', bg:'#f1f5f9', desc:'' };
}

// ==========================================
// 🚀 INICIALIZAR PCM
// ==========================================
async function inicializarPCM() {
  const el = document.getElementById('telaPCM');
  if (!el) return;

  el.innerHTML = `
  <div class="page-header">
    <h1>🗂️ PCM — Controle de Moldes</h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <input type="text" id="pcmBusca" placeholder="Buscar molde..." oninput="filtrarPCM()" style="width:200px">
      <button class="btn-primary" onclick="abrirModalLocalizacao(null)">+ Registrar Localização</button>
    </div>
  </div>

  <!-- CARDS DE RESUMO POR LOCALIZAÇÃO -->
  <div class="cards-row" id="pcmResumoCards"></div>

  <!-- FILTROS DE LOCALIZAÇÃO -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px" id="pcmFiltrosBtns">
    <button class="btn-secondary" style="font-size:12px;padding:7px 14px" onclick="setPcmFiltro('Todos',this)"><b>Todos</b></button>
    ${_LOCALIZACOES.map(l=>`
      <button class="btn-secondary" style="font-size:12px;padding:7px 14px;border-color:${l.cor};color:${l.cor}"
        onclick="setPcmFiltro('${l.id}',this)">
        ${l.ico} ${l.id}
      </button>`).join('')}
  </div>

  <!-- LISTA DE MOLDES -->
  <div id="pcmLoader" class="loader-inline" style="display:none"><div class="spinner-sm"></div><span>Carregando...</span></div>
  <div id="pcmLista"></div>`;

  await carregarPCM();
}

async function carregarPCM() {
  const loader = document.getElementById('pcmLoader');
  if (loader) loader.style.display = 'flex';
  try {
    // Carrega localizações + status dos jobs em paralelo
    const [locs, statusJobs] = await Promise.all([
      db.listarLocalizacoes(),
      db.listarStatusJobs()
    ]);

    // Merge: jobs com localização registrada + jobs sem localização
    const mapaLoc = {};
    (locs||[]).forEach(l => mapaLoc[l.job] = l);

    // Todos os jobs ativos
    const todosJobs = await db._get('jobs', 'ativo=eq.true', 'nome');

    _dadosPCM = (todosJobs||[]).map(j => {
      const loc  = mapaLoc[j.nome];
      const stat = statusJobs.find(s => s.job === j.nome);
      return {
        job:          j.nome,
        localizacao:  loc?.localizacao   || 'Na Ferramentaria',
        maquina:      loc?.maquina       || null,
        observacao:   loc?.observacao    || null,
        pendencias:   loc?.pendencias    || null,
        atualizado:   loc?.atualizado_em || null,
        atualizadoPor:loc?.atualizado_por|| null,
        status:       stat?.status       || null,
        intervencao:  stat?.intervencao  || 0,
        temLoc:       !!loc
      };
    });

    renderizarResumoPCM();
    filtrarPCM();
  } catch(e) {
    toast('Erro ao carregar PCM.','erro'); console.error(e);
  }
  if (loader) loader.style.display = 'none';
}

function renderizarResumoPCM() {
  const el = document.getElementById('pcmResumoCards');
  if (!el) return;
  const contagem = {};
  _LOCALIZACOES.forEach(l => contagem[l.id] = 0);
  _dadosPCM.forEach(m => { if (contagem[m.localizacao]!==undefined) contagem[m.localizacao]++; });
  el.innerHTML = _LOCALIZACOES.map(l => `
    <div class="metric-card" style="border-left-color:${l.cor};cursor:pointer"
      onclick="setPcmFiltro('${l.id}', null)"
      onmouseover="this.style.transform='translateY(-2px)'"
      onmouseout="this.style.transform=''">
      <div style="font-size:22px;margin-bottom:6px">${l.ico}</div>
      <div style="font-size:28px;font-weight:700;color:${l.cor}">${contagem[l.id]}</div>
      <div style="font-size:13px;font-weight:600;color:#1e3a5f">${l.id}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${l.desc}</div>
    </div>`).join('');
}

function setPcmFiltro(loc, btn) {
  _filtroLocPCM = loc;
  // Destaca botão ativo
  document.querySelectorAll('#pcmFiltrosBtns button').forEach(b => b.style.fontWeight='');
  if (btn) btn.style.fontWeight = '700';
  filtrarPCM();
}

function filtrarPCM() {
  const busca   = (document.getElementById('pcmBusca')?.value||'').toUpperCase();
  const filtrado = _dadosPCM.filter(m => {
    if (_filtroLocPCM !== 'Todos' && m.localizacao !== _filtroLocPCM) return false;
    if (busca && !m.job.toUpperCase().includes(busca)) return false;
    return true;
  });
  renderizarListaPCM(filtrado);
}

function renderizarListaPCM(lista) {
  const el = document.getElementById('pcmLista');
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state"><div style="font-size:48px">🗂️</div><div>Nenhum molde encontrado.</div></div>';
    return;
  }

  // Agrupa por localização
  const grupos = {};
  _LOCALIZACOES.forEach(l => grupos[l.id] = []);
  lista.forEach(m => { if (grupos[m.localizacao]) grupos[m.localizacao].push(m); });

  let html = '';
  _LOCALIZACOES.forEach(loc => {
    const items = grupos[loc.id];
    if (!items.length) return;
    const info = _infoLoc(loc.id);
    html += `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--borda)">
        <span style="background:${info.bg};color:${info.cor};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700">${info.ico} ${loc.id}</span>
        <span style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:10px;font-size:12px;font-weight:600">${items.length} molde(s)</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
        ${items.map(m => _criarCardPCM(m, info)).join('')}
      </div>
    </div>`;
  });

  el.innerHTML = html;
}

function _criarCardPCM(m, info) {
  const jobEsc = m.job.replace(/'/g,"\\'").replace(/"/g,'&quot;');
  const dt = m.atualizado ? new Date(m.atualizado).toLocaleDateString('pt-BR') : '—';
  const corStatus = m.status ? corStatus_fn(m.status) : '#94a3b8';

  return `<div style="background:#f8fafc;border:1px solid var(--borda);border-left:4px solid ${info.cor};border-radius:10px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${m.job}</div>
        ${m.localizacao==='Em Máquina'&&m.maquina
          ? `<div style="font-size:11px;color:#10b981;font-weight:600;margin-top:2px">⚙️ ${m.maquina}</div>`
          : ''}
        ${m.status
          ? `<div style="font-size:11px;color:${corStatus};font-weight:600;margin-top:2px">${icoStatus(m.status)} ${m.status}</div>`
          : ''}
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="abrirModalPendencias('${jobEsc}')"
          style="background:#fefce8;border:1px solid #fde68a;color:#92400e;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer;position:relative"
          title="Pendências">
          ✅ <span data-job-badge="${jobEsc}" style="background:#ef4444;color:#fff;border-radius:10px;font-size:10px;padding:1px 5px;font-weight:700"></span>
        </button>
        <button onclick="gerarQRCode('${jobEsc}')"
          style="background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer"
          title="Gerar QR Code">📱</button>
        <button onclick="abrirFichaDoMolde('${jobEsc}')"
          style="background:#f0fdf4;border:1px solid #bbf7d0;color:#059669;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer"
          title="Ver Ficha">📋</button>
        <button onclick="abrirModalLocalizacao('${jobEsc}')"
          style="background:#fff;border:1px solid var(--borda);color:#475569;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer"
          title="Editar localização">✏️</button>
      </div>
    </div>
    ${m.pendencias
      ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:12px;color:#92400e">
           ⚠️ <b>Pendências:</b> ${m.pendencias}
         </div>`
      : ''}
    ${m.observacao
      ? `<div style="font-size:11px;color:#64748b;margin-bottom:8px">📝 ${m.observacao}</div>`
      : ''}
    <div style="font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9">
      <span>📅 ${dt}</span>
      ${m.atualizadoPor?`<span>👤 ${m.atualizadoPor}</span>`:''}
    </div>
  </div>`;
}

// Alias para evitar conflito de nome
function corStatus_fn(s) {
  return s==='Finalizado'?'#10b981':s==='Pausado'?'#f59e0b':'#f97316';
}

// ==========================================
// ✏️ MODAL EDITAR LOCALIZAÇÃO
// ==========================================
var _modalLocJob = null;

function abrirModalLocalizacao(job) {
  _modalLocJob = job;
  const dados = job ? _dadosPCM.find(m=>m.job===job) : null;

  // Monta opções de máquinas
  const maquinas = _listas?.maquinas || [];

  const modalHtml = `
  <div class="modal-overlay" id="pcmLocOverlay" onclick="fecharModalLocalizacao()" style="display:block"></div>
  <div class="modal" id="pcmLocModal" style="display:block;max-width:500px">
    <div class="modal-header">
      <h3>${job ? '📍 Localização: '+job : '📍 Registrar Localização'}</h3>
      <button onclick="fecharModalLocalizacao()">✕</button>
    </div>
    <div class="modal-body">
      ${!job ? `<div class="form-group">
        <label>Molde / Job *</label>
        <div class="autocomplete-wrap">
          <input type="text" id="pcmLocJob" placeholder="Digite o job...">
          <div class="autocomplete-list" id="pcmLocJobList"></div>
        </div>
      </div>` : ''}

      <div class="form-group">
        <label>Localização *</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px" id="pcmLocBtns">
          ${_LOCALIZACOES.map(l=>`
            <label style="cursor:pointer;border:2px solid ${dados?.localizacao===l.id?l.cor:'#e2e8f0'};background:${dados?.localizacao===l.id?l.bg:'#fff'};border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:${dados?.localizacao===l.id?l.cor:'#64748b'};transition:all 0.15s"
              onclick="selecionarLocalizacao('${l.id}')">
              <input type="radio" name="pcmLoc" value="${l.id}" ${dados?.localizacao===l.id?'checked':''} style="display:none">
              ${l.ico} ${l.id}
            </label>`).join('')}
        </div>
        <input type="hidden" id="pcmLocSelecionada" value="${dados?.localizacao||'Na Ferramentaria'}">
      </div>

      <div class="form-group" id="pcmGrupoMaquina" style="${dados?.localizacao==='Em Máquina'?'':'display:none'}">
        <label>Máquina *</label>
        <select id="pcmLocMaquina">
          <option value="">Selecione...</option>
          ${maquinas.map(m=>`<option value="${m}" ${dados?.maquina===m?'selected':''}>${m}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Pendências</label>
        <textarea id="pcmLocPendencias" rows="2" placeholder="Ex: Trocar copo, ajustar cavidade 3...">${dados?.pendencias||''}</textarea>
      </div>

      <div class="form-group">
        <label>Observação</label>
        <textarea id="pcmLocObs" rows="2" placeholder="Observações gerais...">${dados?.observacao||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarLocalizacao()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalLocalizacao()">Cancelar</button>
    </div>
  </div>`;

  // Injeta modal no body
  const div = document.createElement('div');
  div.id = 'pcmModalWrap';
  div.innerHTML = modalHtml;
  document.body.appendChild(div);

  // Setup autocomplete do job (quando não tem job definido)
  if (!job && _listas?.jobs) {
    setupAC('pcmLocJob', 'pcmLocJobList', _listas.jobs);
  }
}

function selecionarLocalizacao(loc) {
  document.getElementById('pcmLocSelecionada').value = loc;
  // Visual
  const info = _infoLoc(loc);
  document.querySelectorAll('#pcmLocBtns label').forEach(lbl => {
    const val = lbl.querySelector('input')?.value;
    const i   = _infoLoc(val);
    lbl.style.borderColor = val===loc ? i.cor : '#e2e8f0';
    lbl.style.background  = val===loc ? i.bg  : '#fff';
    lbl.style.color       = val===loc ? i.cor  : '#64748b';
  });
  // Mostra/oculta campo máquina
  const grpMaq = document.getElementById('pcmGrupoMaquina');
  if (grpMaq) grpMaq.style.display = loc==='Em Máquina' ? '' : 'none';
}

async function salvarLocalizacao() {
  const job = _modalLocJob || document.getElementById('pcmLocJob')?.value?.trim();
  if (!job) return toast('Informe o job.','erro');
  const loc   = document.getElementById('pcmLocSelecionada')?.value;
  const maq   = document.getElementById('pcmLocMaquina')?.value || null;
  const pend  = document.getElementById('pcmLocPendencias')?.value?.trim() || null;
  const obs   = document.getElementById('pcmLocObs')?.value?.trim() || null;
  if (!loc) return toast('Selecione a localização.','erro');
  if (loc==='Em Máquina' && !maq) return toast('Selecione a máquina.','erro');

  try {
    await db.salvarLocalizacao({ job, localizacao:loc, maquina:maq, pendencias:pend, observacao:obs, atualizado_por:_sessao?.nome || null });
    toast('Localização atualizada!','sucesso');
    fecharModalLocalizacao();
    await carregarPCM();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

function fecharModalLocalizacao() {
  const wrap = document.getElementById('pcmModalWrap');
  if (wrap) wrap.remove();
  _modalLocJob = null;
}

// ==========================================
// 📱 QR CODE
// ==========================================
async function gerarQRCode(job) {
  // Monta a URL da ficha do molde
  const baseUrl = window.location.origin + window.location.pathname.replace('app.html','') + 'app.html#ficha';
  const url = baseUrl + '?job=' + encodeURIComponent(job);

  // Usa API pública do QRServer
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&margin=10&format=png`;

  // Cria modal com QR Code
  const div = document.createElement('div');
  div.id = 'qrModalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharQRCode()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:380px;text-align:center">
    <div class="modal-header" style="justify-content:space-between">
      <h3>📱 QR Code — ${job}</h3>
      <button onclick="fecharQRCode()">✕</button>
    </div>
    <div class="modal-body" style="text-align:center;padding:24px">
      <div style="background:#fff;border:2px solid var(--borda);border-radius:12px;padding:16px;display:inline-block;margin-bottom:16px">
        <img src="${qrUrl}" width="240" height="240" alt="QR Code ${job}"
          style="display:block;border-radius:4px">
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;word-break:break-all">${url}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a href="${qrUrl}" download="QRCode_${job.replace(/\s/g,'_')}.png" class="btn-primary" style="text-decoration:none">
          📥 Baixar PNG
        </a>
        <button class="btn-secondary" onclick="imprimirQRCode('${qrUrl}','${job.replace(/'/g,"\\'")}')">
          🖨️ Imprimir
        </button>
        <button class="btn-secondary" onclick="fecharQRCode()">Fechar</button>
      </div>
      <div style="margin-top:16px;font-size:11px;color:#94a3b8">
        Cole este QR Code no molde. Ao escanear, abre a ficha completa.
      </div>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharQRCode() {
  const wrap = document.getElementById('qrModalWrap');
  if (wrap) wrap.remove();
}

function imprimirQRCode(qrUrl, job) {
  const win = window.open('','_blank','width=400,height=500');
  win.document.write(`<!DOCTYPE html><html><head><title>QR Code — ${job}</title>
  <style>body{font-family:Inter,sans-serif;text-align:center;padding:30px}
  h2{color:#1e3a5f;margin-bottom:8px}
  p{color:#64748b;font-size:12px;margin-bottom:20px}
  img{border:2px solid #e2e8f0;border-radius:8px;padding:10px}
  </style></head><body>
  <h2>${job}</h2>
  <p>Escaneie para ver a Ficha do Molde</p>
  <img src="${qrUrl}" width="240" height="240">
  <p style="margin-top:16px;font-size:10px;color:#94a3b8">Ferramentaria V3 — BX</p>
  <script>window.onload=()=>window.print()</script>
  </body></html>`);
  win.document.close();
}

// ==========================================
// 🔗 SUPORTE A QR CODE NA FICHA
// (abre ficha automaticamente se vier ?job= na URL)
// ==========================================
function verificarQRCodeURL() {
  const params = new URLSearchParams(window.location.search);
  const job    = params.get('job');
  if (job) {
    // Remove o parâmetro da URL sem recarregar
    history.replaceState({}, '', window.location.pathname + '#ficha');
    // Abre a ficha
    setTimeout(() => {
      document.getElementById('fichaJobInput').value = job;
      irPara('ficha', document.getElementById('menuFicha'));
      setTimeout(() => buscarFicha(), 200);
    }, 800);
  }
}

// ==========================================
// ✅ CHECKLIST DE PENDÊNCIAS — PCM
// ==========================================

async function carregarPendencias(job) {
  return await db._get('molde_pendencias',
    'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*');
}

async function adicionarPendencia(job) {
  const texto = document.getElementById('novaPendenciaInput')?.value?.trim();
  if (!texto) return toast('Digite o texto da pendência.', 'erro');
  try {
    await db._post('molde_pendencias', {
      job, texto,
      concluido: false,
      criado_por: _sessao?.nome || null
    });
    document.getElementById('novaPendenciaInput').value = '';
    await renderizarChecklist(job);
    toast('Pendência adicionada!', 'sucesso');
  } catch(e) { toast('Erro ao adicionar.', 'erro'); }
}

async function togglePendencia(id, job, concluido) {
  try {
    const payload = {
      concluido: !concluido,
      data_conclusao: !concluido ? new Date().toISOString().split('T')[0] : null
    };
    await db._patch('molde_pendencias', 'id=eq.' + id, payload);
    await renderizarChecklist(job);
  } catch(e) { toast('Erro ao atualizar.', 'erro'); }
}

async function excluirPendencia(id, job) {
  try {
    await db._delete('molde_pendencias', 'id=eq.' + id);
    await renderizarChecklist(job);
  } catch(e) { toast('Erro ao excluir.', 'erro'); }
}

async function renderizarChecklist(job) {
  const el = document.getElementById('checklistPendencias');
  if (!el) return;
  const pends = await carregarPendencias(job);
  const abertas    = (pends||[]).filter(p => !p.concluido);
  const concluidas = (pends||[]).filter(p =>  p.concluido);

  let html = '';

  if (!pends.length) {
    html = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">
      ✅ Nenhuma pendência registrada
    </div>`;
  } else {
    // Itens abertos
    html += abertas.map(p => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px dashed #f1f5f9">
        <input type="checkbox" style="margin-top:2px;width:16px;height:16px;cursor:pointer;accent-color:#10b981"
          onchange="togglePendencia(${p.id},'${job.replace(/'/g,"\\'")}',false)">
        <div style="flex:1">
          <div style="font-size:13px;color:#1e3a5f;font-weight:500">${p.texto}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">
            👤 ${p.criado_por||'—'} · 📅 ${p.criado_em?new Date(p.criado_em).toLocaleDateString('pt-BR'):'—'}
          </div>
        </div>
        <button onclick="excluirPendencia(${p.id},'${job.replace(/'/g,"\\'")}')"
          style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0" title="Excluir">🗑️</button>
      </div>`).join('');

    // Itens concluídos
    if (concluidas.length) {
      html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin:12px 0 8px;text-transform:uppercase">
        ✅ Concluídas (${concluidas.length})
      </div>`;
      html += concluidas.map(p => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px dashed #f1f5f9;opacity:0.6">
          <input type="checkbox" checked style="margin-top:2px;width:16px;height:16px;cursor:pointer;accent-color:#10b981"
            onchange="togglePendencia(${p.id},'${job.replace(/'/g,"\\'")}',true)">
          <div style="flex:1">
            <div style="font-size:13px;color:#64748b;text-decoration:line-through">${p.texto}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">
              ✅ Concluída em ${p.data_conclusao?new Date(p.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR'):'—'}
              · 👤 ${p.criado_por||'—'}
            </div>
          </div>
          <button onclick="excluirPendencia(${p.id},'${job.replace(/'/g,"\\'")}')"
            style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0">🗑️</button>
        </div>`).join('');
    }
  }

  el.innerHTML = html;

  // Atualiza badge de pendências no card do PCM
  const badge = document.querySelector(`[data-job-badge="${job}"]`);
  if (badge) badge.innerText = abertas.length || '';
}

// Modal de checklist — abre ao clicar em "Pendências" no card PCM
async function abrirModalPendencias(job) {
  const div = document.createElement('div');
  div.id = 'modalPendWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalPendencias()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:520px">
    <div class="modal-header">
      <h3>✅ Pendências — ${job}</h3>
      <button onclick="fecharModalPendencias()">✕</button>
    </div>
    <div class="modal-body">
      <!-- Input nova pendência -->
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input type="text" id="novaPendenciaInput" placeholder="Descreva a pendência..."
          style="flex:1" onkeydown="if(event.key==='Enter') adicionarPendencia('${job.replace(/'/g,"\\'")}')" >
        <button class="btn-primary" style="white-space:nowrap" onclick="adicionarPendencia('${job.replace(/'/g,"\\'")}')">+ Adicionar</button>
      </div>
      <!-- Lista de pendências -->
      <div id="checklistPendencias">
        <div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="fecharModalPendencias()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  await renderizarChecklist(job);
}

function fecharModalPendencias() {
  document.getElementById('modalPendWrap')?.remove();
  // Recarrega PCM para atualizar badges
  carregarPCM();
}
