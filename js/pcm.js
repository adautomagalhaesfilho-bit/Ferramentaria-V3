// ==========================================
// 🗂️ PCM.JS — Planejamento e Controle de Moldes
// ==========================================

var _dadosPCM = [];
var _filtroLocPCM = 'Todos';
var _mostrarTodasPendencias = false;

const _LOCALIZACOES = [
  { id:'Em Máquina',        ico:'🟢', cor:'#10b981', bg:'#d1fae5', desc:'Molde ativo em produção' },
  { id:'Na Ferramentaria',  ico:'🔧', cor:'#0056b3', bg:'#dbeafe', desc:'Em manutenção/reparo' },
  { id:'Sala de Molde',     ico:'📦', cor:'#8b5cf6', bg:'#ede9fe', desc:'Aguardando em estoque' },
  { id:'Desativado/LOG',    ico:'🔴', cor:'#ef4444', bg:'#fee2e2', desc:'Fora de uso / inativo' },
];

const _SETORES_RESPONSAVEL = [
  { id:'Usinagem',  ico:'⚙️', cor:'#0056b3' },
  { id:'Bancada',   ico:'🛠️', cor:'#0891b2' },
  { id:'Projeto',   ico:'📐', cor:'#8b5cf6' },
  { id:'Produção',  ico:'🏭', cor:'#10b981' },
  { id:'PCM',       ico:'🗂️', cor:'#f59e0b' },
];

function _infoSetor(setor) {
  return _SETORES_RESPONSAVEL.find(s=>s.id===setor) || { ico:'❔', cor:'#64748b' };
}

var _filtroSetorPendencias = 'Todos';

// ==========================================
// 🔔 ALERTA DE PENDÊNCIAS NO DASHBOARD
// ==========================================
function _normalizarSetorPend(setor) {
  if (!setor) return null;
  if (setor === 'Producao') return 'Produção';
  return setor;
}

async function carregarAlertaPendencias() {
  const el = document.getElementById('alertaPendenciasDash');
  if (!el || !_sessao) return;

  const perfil = _sessao.perfil;
  const isGestorOuAdmin = perfil === 'admin' || perfil === 'gestor';
  const setorUsuario = _normalizarSetorPend(_sessao.setor);

  if (!isGestorOuAdmin && !setorUsuario) { el.innerHTML = ''; return; }

  try {
    let filtro = 'concluido=eq.false&order=criado_em.asc';
    if (isGestorOuAdmin) {
      filtro += '&setor_responsavel=not.is.null';
    } else {
      filtro += '&setor_responsavel=eq.' + encodeURIComponent(setorUsuario);
    }
    const pend = await db._get('molde_pendencias', filtro, '*');

    if (!pend || !pend.length) { el.innerHTML = ''; return; }

    const titulo = isGestorOuAdmin
      ? `${pend.length} pendência(s) administrativa(s) em aberto`
      : `${pend.length} pendência(s) do seu setor em aberto`;

    el.innerHTML = `
    <div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb;margin-bottom:16px;cursor:pointer"
      onclick="abrirPCMComFiltroSetor('${isGestorOuAdmin ? 'Todos' : setorUsuario}')">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:24px">⚠️</div>
          <div>
            <div style="font-weight:700;color:#92400e;font-size:14px">${titulo}</div>
            <div style="font-size:12px;color:#78350f">Clique para ver no PCM</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;max-width:60%">
          ${pend.slice(0,3).map(p=>`<span style="background:#fff;border:1px solid #fde68a;padding:3px 10px;border-radius:8px;font-size:11px;color:#92400e"><b>${p.job}</b>: ${p.texto.length>28?p.texto.slice(0,28)+'…':p.texto}</span>`).join('')}
          ${pend.length>3?`<span style="font-size:11px;color:#92400e;align-self:center;font-weight:700">+${pend.length-3}</span>`:''}
        </div>
      </div>
    </div>`;
  } catch(e) {
    el.innerHTML = '';
    console.error('Erro ao carregar alerta de pendências:', e);
  }
}

function abrirPCMComFiltroSetor(setor) {
  irPara('pcm', document.getElementById('menuPCM'));
  setTimeout(() => {
    _filtroSetorPendencias = setor || 'Todos';
    _mostrarTodasPendencias = true;
    const sel = document.getElementById('pcmFiltroSetorPend');
    if (sel) sel.value = _filtroSetorPendencias;
    const chk = document.getElementById('pcmToggleTodas');
    if (chk) chk.checked = true;
    carregarPainelPendencias();
  }, 400);
}

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
  <div class="cards-row" id="pcmResumoCards"></div>

  <!-- PAINEL DE PENDÊNCIAS -->
  <div class="card" id="pcmPainelPendencias" style="margin-bottom:16px;border-left:4px solid #f59e0b">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div>
        <div style="font-size:15px;font-weight:700;color:#1e3a5f">✅ Pendências em Aberto</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px" id="pcmPendLegenda">Mostrando moldes Na Ferramentaria</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="pcmFiltroSetorPend" onchange="filtrarSetorPendencias(this.value)" style="width:auto;font-size:12px">
          <option value="Todos">Todos os Setores</option>
          ${_SETORES_RESPONSAVEL.map(s=>`<option value="${s.id}">${s.ico} ${s.id}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;color:#64748b">
          <input type="checkbox" id="pcmToggleTodas" onchange="toggleTodasPendencias(this.checked)"
            style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b">
          Mostrar todos os locais
        </label>
      </div>
    </div>
    <div id="pcmListaPendencias">
      <div class="loader-inline"><div class="spinner-sm"></div><span>Carregando pendências...</span></div>
    </div>
  </div>

  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px" id="pcmFiltrosBtns">
    <button class="btn-secondary" style="font-size:12px;padding:7px 14px;font-weight:700" onclick="setPcmFiltro('Todos',this)">Todos</button>
    ${_LOCALIZACOES.map(l=>`
      <button class="btn-secondary" style="font-size:12px;padding:7px 14px;border-color:${l.cor};color:${l.cor}"
        onclick="setPcmFiltro('${l.id}',this)">${l.ico} ${l.id}</button>`).join('')}
  </div>
  <div id="pcmLoader" class="loader-inline" style="display:none"><div class="spinner-sm"></div><span>Carregando...</span></div>
  <div id="pcmLista"></div>`;

  await carregarPCM();
}

// Limite de dias sem lançamento para um molde "Na Ferramentaria" ser considerado parado
const DIAS_ALERTA_PARADO = 3;

async function carregarPCM() {
  const loader = document.getElementById('pcmLoader');
  if (loader) loader.style.display = 'flex';
  try {
    const [locs, statusJobs, todosJobs] = await Promise.all([
      db.listarLocalizacoes(),
      db.listarStatusJobs(),
      db._get('jobs', 'ativo=eq.true', 'nome')
    ]);
    const mapaLoc = {};
    (locs||[]).forEach(l => mapaLoc[l.job] = l);
    _dadosPCM = (todosJobs||[]).map(j => {
      const loc  = mapaLoc[j.nome];
      const stat = statusJobs.find(s => s.job === j.nome);
      return {
        job:           j.nome,
        localizacao:   loc?.localizacao    || 'Na Ferramentaria',
        maquina:       loc?.maquina        || null,
        observacao:    loc?.observacao     || null,
        atualizado:    loc?.atualizado_em  || null,
        atualizadoPor: loc?.atualizado_por || null,
        status:        stat?.status        || null,
        intervencao:   stat?.intervencao   || 0,
        temLoc:        !!loc,
        diasParado:    null
      };
    });

    // Calcula dias sem lançamento apenas para moldes "Na Ferramentaria" (evita sobrecarga)
    const jobsNaFerramentaria = _dadosPCM.filter(m => m.localizacao === 'Na Ferramentaria');
    await Promise.all(jobsNaFerramentaria.map(async m => {
      try {
        const [ultFerr, ultProd] = await Promise.all([
          db._get('lancamentos', 'job=eq.' + encodeURIComponent(m.job) + '&order=data.desc&limit=1', 'data'),
          db._get('prod_lancamentos', 'molde=eq.' + encodeURIComponent(m.job) + '&order=data.desc&limit=1', 'data')
        ]);
        const dataFerr = ultFerr && ultFerr[0] ? ultFerr[0].data : null;
        const dataProd = ultProd && ultProd[0] ? ultProd[0].data : null;
        const ultimaData = [dataFerr, dataProd].filter(Boolean).sort().pop() || null;
        if (ultimaData) {
          const hoje = new Date().toISOString().split('T')[0];
          const dias = Math.floor((new Date(hoje) - new Date(ultimaData)) / 86400000);
          m.diasParado = dias;
          m.ultimaMovimentacao = ultimaData;
        } else {
          m.diasParado = null; // nunca teve lançamento — não alerta
        }
      } catch(e) { m.diasParado = null; }
    }));

    renderizarResumoPCM();
    filtrarPCM();
    await carregarPainelPendencias();
  } catch(e) { toast('Erro ao carregar PCM.','erro'); console.error(e); }
  if (loader) loader.style.display = 'none';
}

// ==========================================
// ✅ PAINEL DE PENDÊNCIAS INTELIGENTE
// ==========================================
async function carregarPainelPendencias() {
  const el = document.getElementById('pcmListaPendencias');
  if (!el) return;

  try {
    // Busca todas as pendências abertas
    const todasPend = await db._get('molde_pendencias',
      'concluido=eq.false&order=criado_em.asc', '*');

    if (!todasPend || !todasPend.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">🎉 Nenhuma pendência em aberto!</div>';
      return;
    }

    // Filtra por localização
    const locsFiltro = _mostrarTodasPendencias
      ? null // Mostra todas
      : ['Na Ferramentaria']; // Só ferramentaria por padrão

    // Filtra por setor responsável (se selecionado)
    const pendFiltradas = _filtroSetorPendencias === 'Todos'
      ? todasPend
      : todasPend.filter(p => p.setor_responsavel === _filtroSetorPendencias);

    // Agrupa por job
    const porJob = {};
    pendFiltradas.forEach(p => {
      if (!porJob[p.job]) porJob[p.job] = [];
      porJob[p.job].push(p);
    });

    // Filtra jobs pela localização
    const jobsFiltrados = Object.entries(porJob).filter(([job]) => {
      const molde = _dadosPCM.find(m => m.job === job);
      const loc   = molde?.localizacao || 'Na Ferramentaria';
      if (!locsFiltro) return true;
      return locsFiltro.includes(loc);
    });

    // Atualiza legenda
    const legenda = document.getElementById('pcmPendLegenda');
    if (legenda) {
      const total = jobsFiltrados.reduce((a,[,pends])=>a+pends.length,0);
      legenda.innerText = _mostrarTodasPendencias
        ? `${total} pendência(s) em todos os locais`
        : `${total} pendência(s) em moldes Na Ferramentaria`;
    }

    if (!jobsFiltrados.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">
        ✅ Nenhuma pendência${_mostrarTodasPendencias?'':' para moldes Na Ferramentaria'}
        ${!_mostrarTodasPendencias?'<br><span style="font-size:11px">Marque "Mostrar todos os locais" para ver outras pendências</span>':''}
      </div>`;
      return;
    }

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';

    jobsFiltrados.forEach(([job, pends]) => {
      const molde = _dadosPCM.find(m => m.job === job);
      const loc   = molde?.localizacao || 'Na Ferramentaria';
      const info  = _infoLoc(loc);
      const jobEsc = job.replace(/'/g,"\\'").replace(/"/g,'&quot;');

      html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:13px;font-weight:700;color:#1e3a5f">${job}</div>
            <span style="background:${info.bg};color:${info.cor};font-size:10px;padding:2px 7px;border-radius:8px;font-weight:700">${info.ico} ${loc}</span>
          </div>
          <button onclick="abrirModalPendencias('${jobEsc}')"
            style="background:#fff;border:1px solid #fde68a;color:#92400e;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;white-space:nowrap">
            ✏️ Gerenciar
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${pends.slice(0,3).map(p=>{
            const setorInfo = p.setor_responsavel ? _infoSetor(p.setor_responsavel) : null;
            return `
            <div style="display:flex;align-items:flex-start;gap:8px">
              <input type="checkbox" style="margin-top:2px;width:14px;height:14px;cursor:pointer;accent-color:#10b981;flex-shrink:0"
                onchange="concluirPendenciaRapida(${p.id},'${jobEsc}',this)">
              <div style="flex:1">
                <span style="font-size:12px;color:#1e3a5f">${p.texto}</span>
                ${setorInfo ? `<span style="display:block;margin-top:2px;background:${setorInfo.cor}20;color:${setorInfo.cor};font-size:10px;padding:1px 6px;border-radius:6px;font-weight:700;width:fit-content">${setorInfo.ico} ${p.setor_responsavel}</span>` : ''}
              </div>
            </div>`;
          }).join('')}
          ${pends.length > 3
            ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">+${pends.length-3} mais pendência(s)...</div>`
            : ''}
        </div>
      </div>`;
    });

    html += '</div>';
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div class="empty-state">Erro ao carregar pendências.</div>';
    console.error(e);
  }
}

async function concluirPendenciaRapida(id, job, checkbox) {
  const dataConclusao = new Date().toISOString().split('T')[0];
  try {
    await db._patch('molde_pendencias', 'id=eq.' + id, {
      concluido: true, data_conclusao: dataConclusao
    });
    toast('Pendência concluída!','sucesso');
    // Recarrega o painel após breve delay
    setTimeout(() => carregarPainelPendencias(), 500);
  } catch(e) {
    toast('Erro ao concluir.','erro');
    checkbox.checked = false;
  }
}

function toggleTodasPendencias(mostrarTodas) {
  _mostrarTodasPendencias = mostrarTodas;
  carregarPainelPendencias();
}

function filtrarSetorPendencias(setor) {
  _filtroSetorPendencias = setor;
  carregarPainelPendencias();
}

// ==========================================
// 📊 RESUMO + LISTA
// ==========================================
function renderizarResumoPCM() {
  const el = document.getElementById('pcmResumoCards');
  if (!el) return;
  const contagem = {};
  _LOCALIZACOES.forEach(l => contagem[l.id] = 0);
  _dadosPCM.forEach(m => { if (contagem[m.localizacao]!==undefined) contagem[m.localizacao]++; });
  el.innerHTML = _LOCALIZACOES.map(l => `
    <div class="metric-card" style="border-left-color:${l.cor};cursor:pointer;transition:transform 0.15s"
      onclick="setPcmFiltro('${l.id}',null)"
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
  document.querySelectorAll('#pcmFiltrosBtns button').forEach(b => b.style.fontWeight='');
  if (btn) btn.style.fontWeight = '700';
  filtrarPCM();
}

function filtrarPCM() {
  const busca = (document.getElementById('pcmBusca')?.value||'').toUpperCase();
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
  const estaParado = m.localizacao === 'Na Ferramentaria' && m.diasParado !== null && m.diasParado >= DIAS_ALERTA_PARADO;
  const corBorda = estaParado ? '#ef4444' : info.cor;
  const bgCard = estaParado ? '#fef2f2' : '#f8fafc';
  return `<div style="background:${bgCard};border:1px solid ${estaParado?'#fecaca':'var(--borda)'};border-left:4px solid ${corBorda};border-radius:10px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <div style="font-size:14px;font-weight:700;color:#1e3a5f">${m.job}</div>
        ${m.localizacao==='Em Máquina'&&m.maquina
          ? `<div style="font-size:11px;color:#10b981;font-weight:600;margin-top:2px">🏭 ${m.maquina}</div>`
          : ''}
        ${estaParado
          ? `<div style="font-size:11px;color:#dc2626;font-weight:700;margin-top:2px">⏰ Parado há ${m.diasParado} dia(s) sem lançamento</div>`
          : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="abrirModalPendencias('${jobEsc}')"
          style="background:#fefce8;border:1px solid #fde68a;color:#92400e;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer">✅ Pendências</button>
        ${typeof podeRegistrarIntervencao === 'function' && podeRegistrarIntervencao() ? `
        <button onclick="abrirModalIntervencao('${jobEsc}')"
          style="background:#f0fdf4;border:1px solid #bbf7d0;color:#059669;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer">🛠️ Intervenção</button>` : ''}
        <button onclick="abrirModalHistoricoLoc('${jobEsc}')"
          style="background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer">📋 Histórico</button>
        <button onclick="gerarQRCode('${jobEsc}')"
          style="background:#f5f3ff;border:1px solid #ddd6fe;color:#7c3aed;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer">📱</button>
        <button onclick="abrirFichaDoMolde('${jobEsc}')"
          style="background:#f0fdf4;border:1px solid #bbf7d0;color:#059669;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer">📄 Ficha</button>
        <button onclick="abrirModalLocalizacao('${jobEsc}')"
          style="background:#fff;border:1px solid var(--borda);color:#475569;padding:5px 8px;border-radius:6px;font-size:11px;cursor:pointer">✏️</button>
      </div>
    </div>
    ${m.observacao ? `<div style="font-size:11px;color:#64748b;margin-bottom:8px">📝 ${m.observacao}</div>` : ''}
    <div style="font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9">
      <span>📅 ${dt}</span>
      ${m.atualizadoPor?`<span>👤 ${m.atualizadoPor}</span>`:''}
    </div>
  </div>`;
}

// ==========================================
// ✏️ MODAL EDITAR LOCALIZAÇÃO
// ==========================================
var _modalLocJob = null;

function abrirModalLocalizacao(job) {
  _modalLocJob = job;
  const dados = job ? _dadosPCM.find(m=>m.job===job) : null;
  const injetoras = _listas?.injetoras || [];

  const div = document.createElement('div');
  div.id = 'pcmModalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalLocalizacao()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:500px">
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
        <label>Injetora *</label>
        <select id="pcmLocMaquina" onchange="verificarMoldeNaMaquina()">
          <option value="">Selecione...</option>
          ${injetoras.map(m=>`<option value="${m}" ${dados?.maquina===m?'selected':''}>${m}</option>`).join('')}
        </select>
        <div id="pcmAvisoTrocaMaquina" style="display:none;margin-top:8px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400e"></div>
      </div>
      <div class="form-group">
        <label>Observação</label>
        <textarea id="pcmLocObs" rows="2" placeholder="Observações gerais...">${dados?.observacao||''}</textarea>
      </div>
      <div class="form-group">
        <label>Data da movimentação</label>
        <input type="date" id="pcmLocData" value="${new Date().toISOString().split('T')[0]}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarLocalizacao()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalLocalizacao()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  if (!job && _listas?.jobs) setupAC('pcmLocJob', 'pcmLocJobList', _listas.jobs);
}

function selecionarLocalizacao(loc) {
  document.getElementById('pcmLocSelecionada').value = loc;
  document.querySelectorAll('#pcmLocBtns label').forEach(lbl => {
    const val = lbl.querySelector('input')?.value;
    const i   = _infoLoc(val);
    lbl.style.borderColor = val===loc ? i.cor : '#e2e8f0';
    lbl.style.background  = val===loc ? i.bg  : '#fff';
    lbl.style.color       = val===loc ? i.cor  : '#64748b';
  });
  const grpMaq = document.getElementById('pcmGrupoMaquina');
  if (grpMaq) grpMaq.style.display = loc==='Em Máquina' ? '' : 'none';
  if (loc==='Em Máquina') verificarMoldeNaMaquina();
}

// Ao selecionar a injetora, mostra qual molde está rodando nela atualmente (se houver)
function verificarMoldeNaMaquina() {
  const maq = document.getElementById('pcmLocMaquina')?.value;
  const aviso = document.getElementById('pcmAvisoTrocaMaquina');
  if (!aviso) return;
  if (!maq) { aviso.style.display = 'none'; return; }

  const jobAtual = _modalLocJob || document.getElementById('pcmLocJob')?.value?.trim();
  const moldeNaMaquina = _dadosPCM.find(m =>
    m.localizacao === 'Em Máquina' && m.maquina === maq && m.job !== jobAtual
  );

  if (moldeNaMaquina) {
    aviso.style.display = 'block';
    aviso.innerHTML = `⚠️ A injetora <b>${maq}</b> está rodando o molde <b>${moldeNaMaquina.job}</b> atualmente.<br>
      Ao salvar, ele será movido automaticamente para <b>🔧 Na Ferramentaria</b>.`;
  } else {
    aviso.style.display = 'block';
    aviso.style.background = '#d1fae5';
    aviso.style.borderColor = '#a7f3d0';
    aviso.style.color = '#065f46';
    aviso.innerHTML = `✅ A injetora <b>${maq}</b> está livre no momento.`;
  }
}

async function salvarLocalizacao() {
  const job  = _modalLocJob || document.getElementById('pcmLocJob')?.value?.trim();
  if (!job) return toast('Informe o job.','erro');
  const loc  = document.getElementById('pcmLocSelecionada')?.value;
  const maq  = document.getElementById('pcmLocMaquina')?.value || null;
  const obs  = document.getElementById('pcmLocObs')?.value?.trim() || null;
  const data = document.getElementById('pcmLocData')?.value || new Date().toISOString().split('T')[0];
  if (!loc) return toast('Selecione a localização.','erro');
  if (loc==='Em Máquina' && !maq) return toast('Selecione a injetora.','erro');
  try {
    // Verifica se outro molde já está nessa injetora — precisa ser liberado antes de salvar o novo
    let moldeSubstituido = null;
    if (loc === 'Em Máquina') {
      moldeSubstituido = _dadosPCM.find(m =>
        m.localizacao === 'Em Máquina' && m.maquina === maq && m.job !== job
      ) || null;
    }

    await db.salvarLocalizacao({
      job, localizacao:loc, maquina:maq, observacao:obs,
      atualizado_por: _sessao?.nome || null,
      atualizado_em:  data + 'T00:00:00'
    });
    await db._post('molde_localizacao_historico', {
      job, localizacao:loc, maquina:maq||null, observacao:obs||null,
      movido_em:  data + 'T00:00:00',
      movido_por: _sessao?.nome || null
    });

    // Move automaticamente o molde substituído para Na Ferramentaria
    if (moldeSubstituido) {
      const obsAuto = `Movido automaticamente — injetora ${maq} passou a rodar o molde ${job}`;
      await db.salvarLocalizacao({
        job: moldeSubstituido.job, localizacao:'Na Ferramentaria', maquina:null, observacao:obsAuto,
        atualizado_por: _sessao?.nome || null,
        atualizado_em:  data + 'T00:00:00'
      });
      await db._post('molde_localizacao_historico', {
        job: moldeSubstituido.job, localizacao:'Na Ferramentaria', maquina:null, observacao:obsAuto,
        movido_em:  data + 'T00:00:00',
        movido_por: _sessao?.nome || null
      });
      toast(`Localização atualizada! Molde ${moldeSubstituido.job} foi movido para Na Ferramentaria.`,'sucesso');
    } else {
      toast('Localização atualizada!','sucesso');
    }

    fecharModalLocalizacao();
    await carregarPCM();
  } catch(e) { toast('Erro ao salvar.','erro'); console.error(e); }
}

function fecharModalLocalizacao() {
  document.getElementById('pcmModalWrap')?.remove();
  _modalLocJob = null;
}

// ==========================================
// 📋 HISTÓRICO DE MOVIMENTAÇÃO
// ==========================================
async function abrirModalHistoricoLoc(job) {
  const div = document.createElement('div');
  div.id = 'modalHistLocWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalHistoricoLoc()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:560px">
    <div class="modal-header">
      <h3>📋 Histórico de Movimentação — ${job}</h3>
      <button onclick="fecharModalHistoricoLoc()">✕</button>
    </div>
    <div class="modal-body">
      <div id="histLocConteudo"><div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div></div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="fecharModalHistoricoLoc()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(div);

  try {
    const hist = await db._get('molde_localizacao_historico',
      'job=eq.' + encodeURIComponent(job) + '&order=movido_em.desc', '*');
    const el = document.getElementById('histLocConteudo');
    if (!hist || !hist.length) {
      el.innerHTML = '<div class="empty-state" style="padding:20px">Nenhuma movimentação registrada.</div>';
      return;
    }
    const locMap = {
      'Em Máquina':      { ico:'🟢', cor:'#10b981', bg:'#d1fae5' },
      'Na Ferramentaria':{ ico:'🔧', cor:'#0056b3', bg:'#dbeafe' },
      'Sala de Molde':   { ico:'📦', cor:'#8b5cf6', bg:'#ede9fe' },
      'Desativado/LOG':  { ico:'🔴', cor:'#ef4444', bg:'#fee2e2' },
    };
    el.innerHTML = `<div style="position:relative;padding-left:28px">` +
      hist.map((h,i) => {
        const info = locMap[h.localizacao] || { ico:'📍', cor:'#64748b', bg:'#f1f5f9' };
        const dt = h.movido_em ? new Date(h.movido_em).toLocaleDateString('pt-BR') : '—';
        return `<div style="position:relative;margin-bottom:16px">
          ${i<hist.length-1?'<div style="position:absolute;left:-20px;top:20px;width:2px;height:calc(100% + 8px);background:#e2e8f0"></div>':''}
          <div style="position:absolute;left:-28px;top:4px;width:16px;height:16px;border-radius:50%;background:${info.cor};border:2px solid #fff;box-shadow:0 0 0 2px ${info.cor}"></div>
          <div style="background:${info.bg};border-radius:10px;border:1px solid ${info.cor}40;border-left:3px solid ${info.cor};padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
              <span style="font-size:13px;font-weight:700;color:${info.cor}">${info.ico} ${h.localizacao}</span>
              <span style="font-size:11px;color:#94a3b8">📅 ${dt} · 👤 ${h.movido_por||'—'}</span>
            </div>
            ${h.maquina?`<div style="font-size:12px;color:#64748b;margin-top:4px">🏭 ${h.maquina}</div>`:''}
            ${h.observacao?`<div style="font-size:12px;color:#64748b;margin-top:4px">📝 ${h.observacao}</div>`:''}
          </div>
        </div>`;
      }).join('') + '</div>';
  } catch(e) {
    document.getElementById('histLocConteudo').innerHTML = '<div class="empty-state">Erro ao carregar.</div>';
  }
}

function fecharModalHistoricoLoc() {
  document.getElementById('modalHistLocWrap')?.remove();
}

// ==========================================
// ✅ CHECKLIST DE PENDÊNCIAS (Modal)
// ==========================================
async function carregarPendencias(job) {
  return await db._get('molde_pendencias',
    'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*');
}

async function adicionarPendencia(job) {
  const texto = document.getElementById('novaPendenciaInput')?.value?.trim();
  if (!texto) return toast('Digite o texto da pendência.','erro');
  const setorResp = document.getElementById('novaPendenciaSetor')?.value || null;
  const dataCriacao = document.getElementById('novaPendenciaData')?.value ||
    new Date().toISOString().split('T')[0];
  try {
    await db._post('molde_pendencias', {
      job, texto, concluido: false,
      setor_responsavel: setorResp,
      criado_por: _sessao?.nome || null,
      criado_em:  dataCriacao + 'T00:00:00'
    });
    document.getElementById('novaPendenciaInput').value = '';
    await renderizarChecklist(job);
    toast('Pendência adicionada!','sucesso');
  } catch(e) { toast('Erro ao adicionar.','erro'); }
}

async function togglePendencia(id, job, concluido) {
  if (!concluido) {
    const dataConclusao = await _pedirData('Data de conclusão:', new Date().toISOString().split('T')[0]);
    if (dataConclusao === null) return;
    try {
      await db._patch('molde_pendencias', 'id=eq.' + id, { concluido: true, data_conclusao: dataConclusao });
      await renderizarChecklist(job);
    } catch(e) { toast('Erro ao atualizar.','erro'); }
  } else {
    try {
      await db._patch('molde_pendencias', 'id=eq.' + id, { concluido: false, data_conclusao: null });
      await renderizarChecklist(job);
    } catch(e) { toast('Erro ao atualizar.','erro'); }
  }
}

async function editarDataPendencia(id, job, campo, valorAtual) {
  const novaData = await _pedirData(
    campo === 'criado_em' ? 'Data de criação:' : 'Data de conclusão:',
    valorAtual ? valorAtual.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  if (novaData === null) return;
  try {
    const payload = {};
    payload[campo] = novaData + 'T00:00:00';
    await db._patch('molde_pendencias', 'id=eq.' + id, payload);
    await renderizarChecklist(job);
    toast('Data atualizada!','sucesso');
  } catch(e) { toast('Erro ao atualizar.','erro'); }
}

function editarSetorPendencia(id, job) {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.id = 'modalSetorPendWrap';
    div.innerHTML = `
    <div class="modal-overlay" style="display:block;z-index:9999" onclick="document.getElementById('modalSetorPendWrap').remove()"></div>
    <div class="modal" style="display:block;max-width:340px;z-index:10000">
      <div class="modal-header"><h3>Atribuir Setor Responsável</h3></div>
      <div class="modal-body">
        <select id="selSetorPend" style="width:100%">
          <option value="">— Nenhum —</option>
          ${_SETORES_RESPONSAVEL.map(s=>`<option value="${s.id}">${s.ico} ${s.id}</option>`).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="_confirmarSetorPendencia(${id},'${job.replace(/'/g,"\\'")}')">✓ Confirmar</button>
        <button class="btn-secondary" onclick="document.getElementById('modalSetorPendWrap').remove()">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(div);
  });
}

async function _confirmarSetorPendencia(id, job) {
  const setor = document.getElementById('selSetorPend')?.value || null;
  document.getElementById('modalSetorPendWrap')?.remove();
  try {
    await db._patch('molde_pendencias', 'id=eq.' + id, { setor_responsavel: setor });
    await renderizarChecklist(job);
    toast('Setor atualizado!','sucesso');
  } catch(e) { toast('Erro ao atualizar.','erro'); }
}

function _pedirData(label, valorDefault) {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.id = 'modalDataWrap';
    div.innerHTML = `
    <div class="modal-overlay" style="display:block;z-index:9999"></div>
    <div class="modal" style="display:block;max-width:340px;z-index:10000">
      <div class="modal-header"><h3>${label}</h3></div>
      <div class="modal-body">
        <input type="date" id="modalDataInput" value="${valorDefault}" style="width:100%">
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="
          const v=document.getElementById('modalDataInput').value;
          document.getElementById('modalDataWrap').remove();
          window._resolveData(v||null);">✓ Confirmar</button>
        <button class="btn-secondary" onclick="
          document.getElementById('modalDataWrap').remove();
          window._resolveData(null);">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(div);
    window._resolveData = resolve;
  });
}

async function excluirPendencia(id, job) {
  try {
    await db._delete('molde_pendencias', 'id=eq.' + id);
    await renderizarChecklist(job);
  } catch(e) { toast('Erro ao excluir.','erro'); }
}

async function renderizarChecklist(job) {
  const el = document.getElementById('checklistPendencias');
  if (!el) return;
  const pends      = await carregarPendencias(job);
  const abertas    = (pends||[]).filter(p => !p.concluido);
  const concluidas = (pends||[]).filter(p =>  p.concluido);
  const jobEsc     = job.replace(/'/g,"\\'");

  let html = '';
  if (!pends.length) {
    html = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">✅ Nenhuma pendência registrada</div>`;
  } else {
    html += abertas.map(p => {
      const setorInfo = p.setor_responsavel ? _infoSetor(p.setor_responsavel) : null;
      return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px dashed #f1f5f9">
        <input type="checkbox" style="margin-top:3px;width:16px;height:16px;cursor:pointer;accent-color:#10b981;flex-shrink:0"
          onchange="togglePendencia(${p.id},'${jobEsc}',false)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#1e3a5f;font-weight:500">${p.texto}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            ${setorInfo ? `<span style="background:${setorInfo.cor}20;color:${setorInfo.cor};padding:1px 8px;border-radius:8px;font-weight:700">${setorInfo.ico} ${p.setor_responsavel}</span>` : `<span style="cursor:pointer;text-decoration:underline;color:#94a3b8" onclick="editarSetorPendencia(${p.id},'${jobEsc}')">➕ Atribuir setor</span>`}
            <span>👤 ${p.criado_por||'—'}</span>
            <span style="cursor:pointer;text-decoration:underline;color:#0369a1"
              onclick="editarDataPendencia(${p.id},'${jobEsc}','criado_em','${p.criado_em||''}')">
              📅 ${p.criado_em?new Date(p.criado_em).toLocaleDateString('pt-BR'):'—'} ✏️
            </span>
            ${setorInfo ? `<span style="cursor:pointer;text-decoration:underline;color:#94a3b8" onclick="editarSetorPendencia(${p.id},'${jobEsc}')">✏️ setor</span>` : ''}
          </div>
        </div>
        <button onclick="excluirPendencia(${p.id},'${jobEsc}')"
          style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0;flex-shrink:0">🗑️</button>
      </div>`;
    }).join('');

    if (concluidas.length) {
      html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin:14px 0 8px;text-transform:uppercase">
        ✅ Concluídas (${concluidas.length})</div>`;
      html += concluidas.map(p => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px dashed #f1f5f9;opacity:0.65">
          <input type="checkbox" checked style="margin-top:3px;width:16px;height:16px;cursor:pointer;accent-color:#10b981;flex-shrink:0"
            onchange="togglePendencia(${p.id},'${jobEsc}',true)">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:#64748b;text-decoration:line-through">${p.texto}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
              <span>👤 ${p.criado_por||'—'}</span>
              <span style="cursor:pointer;text-decoration:underline;color:#059669"
                onclick="editarDataPendencia(${p.id},'${jobEsc}','data_conclusao','${p.data_conclusao||''}')">
                ✅ ${p.data_conclusao?new Date(p.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR'):'—'} ✏️
              </span>
            </div>
          </div>
          <button onclick="excluirPendencia(${p.id},'${jobEsc}')"
            style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:0;flex-shrink:0">🗑️</button>
        </div>`).join('');
    }
  }
  el.innerHTML = html;
}

async function abrirModalPendencias(job) {
  const div = document.createElement('div');
  div.id = 'modalPendWrap';
  const jobEsc = job.replace(/'/g,"\\'");
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalPendencias()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:540px">
    <div class="modal-header">
      <h3>✅ Pendências — ${job}</h3>
      <button onclick="fecharModalPendencias()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:16px;border:1px solid var(--borda)">
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:10px">+ NOVA PENDÊNCIA</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="text" id="novaPendenciaInput" placeholder="Descreva a pendência..." style="flex:1"
            onkeydown="if(event.key==='Enter') adicionarPendencia('${jobEsc}')">
          <button class="btn-primary" style="white-space:nowrap" onclick="adicionarPendencia('${jobEsc}')">+ Add</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <label style="font-size:12px;color:#64748b">Data:</label>
          <input type="date" id="novaPendenciaData" value="${new Date().toISOString().split('T')[0]}" style="width:auto">
          <label style="font-size:12px;color:#64748b;margin-left:8px">Setor Responsável:</label>
          <select id="novaPendenciaSetor" style="width:auto">
            <option value="">— Nenhum —</option>
            ${_SETORES_RESPONSAVEL.map(s=>`<option value="${s.id}">${s.ico} ${s.id}</option>`).join('')}
          </select>
        </div>
      </div>
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
  carregarPainelPendencias();
}

// ==========================================
// 📱 QR CODE
// ==========================================
async function gerarQRCode(job) {
  const baseUrl = window.location.origin + window.location.pathname + '#ficha';
  const url     = baseUrl + '?job=' + encodeURIComponent(job);
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&margin=10&format=png`;
  const div = document.createElement('div');
  div.id = 'qrModalWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharQRCode()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:380px;text-align:center">
    <div class="modal-header"><h3>📱 QR Code — ${job}</h3><button onclick="fecharQRCode()">✕</button></div>
    <div class="modal-body" style="text-align:center;padding:24px">
      <div style="background:#fff;border:2px solid var(--borda);border-radius:12px;padding:16px;display:inline-block;margin-bottom:16px">
        <img src="${qrUrl}" width="240" height="240" alt="QR Code ${job}" style="display:block;border-radius:4px">
      </div>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;word-break:break-all">${url}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a href="${qrUrl}" download="QRCode_${job.replace(/\s/g,'_')}.png" class="btn-primary" style="text-decoration:none">📥 Baixar PNG</a>
        <button class="btn-secondary" onclick="imprimirQRCode('${qrUrl}','${job.replace(/'/g,"\\'")}')">🖨️ Imprimir</button>
        <button class="btn-secondary" onclick="fecharQRCode()">Fechar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharQRCode() { document.getElementById('qrModalWrap')?.remove(); }

function imprimirQRCode(qrUrl, job) {
  const win = window.open('','_blank','width=400,height=500');
  win.document.write(`<!DOCTYPE html><html><head><title>QR Code — ${job}</title>
  <style>body{font-family:Inter,sans-serif;text-align:center;padding:30px}h2{color:#1e3a5f}img{border:2px solid #e2e8f0;border-radius:8px;padding:10px}</style>
  </head><body><h2>${job}</h2><p style="color:#64748b;font-size:12px">Escaneie para ver a Ficha do Molde</p>
  <img src="${qrUrl}" width="240" height="240">
  <p style="margin-top:16px;font-size:10px;color:#94a3b8">Ferramentaria V3 — BX</p>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}

// ==========================================
// 🔗 QR CODE NA URL
// ==========================================
function verificarQRCodeURL() {
  const params = new URLSearchParams(window.location.search);
  const job    = params.get('job');
  if (job) {
    history.replaceState({}, '', window.location.pathname + '#ficha');
    setTimeout(() => {
      document.getElementById('fichaJobInput').value = job;
      irPara('ficha', document.getElementById('menuFicha'));
      setTimeout(() => buscarFicha(), 200);
    }, 800);
  }
}

function abrirFichaDoMolde(job) {
  document.getElementById('fichaJobInput').value = job;
  irPara('ficha', document.getElementById('menuFicha'));
  setTimeout(() => buscarFicha(), 100);
}
