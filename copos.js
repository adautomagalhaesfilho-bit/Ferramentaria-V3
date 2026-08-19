// ==========================================
// 🔩 COPOS (GATE INSERT) — Cadastro, Estoque e Compatibilidade
// ==========================================
function podeGerenciarCopos() {
  return typeof _temPermissao === 'function' && _temPermissao('pcm');
}

// Estoque mínimo de um copo = número de cavidades do MOLDE DONO dele (não médias)
function _estoqueMinimoCopo(copo, mapaCavidades) {
  const cav = mapaCavidades[copo.job];
  return cav || 1; // se o molde não tiver cavidades cadastradas, assume 1 como piso
}

var _todosCoposCache = [];
var _mapaCavidadesCache = {};
var _filtroBuscaCopos = '';

// ==========================================
// 🔎 Página principal
// ==========================================
async function inicializarPainelCopos() {
  const el = document.getElementById('telaCopos');
  if (!el) return;
  _filtroBuscaCopos = '';
  el.innerHTML = `
    <div class="page-header">
      <h1>🔩 Copos (Gate Insert)</h1>
      ${podeGerenciarCopos() ? `<button class="btn-primary" onclick="abrirModalCopo()">+ Novo Copo</button>` : ''}
    </div>
    <div class="cards-row" id="coposStatsCards"></div>
    <div id="coposMoldesSemCopoWrap"></div>
    <div class="card">
      <div style="margin-bottom:14px">
        <input type="text" id="coposFiltroBusca" placeholder="Buscar por código ou molde..." oninput="filtrarBuscaCopos(this.value)">
      </div>
      <div id="listaCopos">
        <div class="loader-inline"><div class="spinner-sm"></div><span>Carregando copos...</span></div>
      </div>
    </div>`;
  await carregarPainelCopos();
}

async function carregarPainelCopos() {
  try {
    const [copos, jobsInfo] = await Promise.all([
      db._get('copos', 'ativo=eq.true&order=job.asc', '*'),
      db._get('jobs', 'ativo=eq.true', 'nome,num_cavidades')
    ]);
    _todosCoposCache = copos || [];
    _mapaCavidadesCache = {};
    (jobsInfo||[]).forEach(j => { _mapaCavidadesCache[j.nome] = j.num_cavidades || null; });

    renderizarStatsCopos();
    renderizarMoldesSemCopo(jobsInfo||[]);
    filtrarBuscaCopos(_filtroBuscaCopos);
  } catch(e) {
    toast('Erro ao carregar copos.', 'erro'); console.error(e);
  }
}

function filtrarBuscaCopos(valor) {
  _filtroBuscaCopos = (valor||'').trim().toLowerCase();
  const filtrados = _todosCoposCache.filter(c =>
    !_filtroBuscaCopos || c.codigo.toLowerCase().includes(_filtroBuscaCopos) || c.job.toLowerCase().includes(_filtroBuscaCopos)
  );
  renderizarListaCopos(filtrados);
}

// ==========================================
// 📊 Cards de resumo
// ==========================================
function renderizarStatsCopos() {
  const el = document.getElementById('coposStatsCards');
  if (!el) return;
  let abaixoMinimo = 0, zerados = 0;
  _todosCoposCache.forEach(c => {
    const total = (c.estoque_novo||0) + (c.estoque_embuchado||0);
    const minimo = _estoqueMinimoCopo(c, _mapaCavidadesCache);
    if (total === 0) zerados++;
    else if (total < minimo) abaixoMinimo++;
  });
  let html = metricCard('🔩','Copos Cadastrados', _todosCoposCache.length, 'ativos', '#0056b3');
  html += metricCard('⚠️','Abaixo do Mínimo', abaixoMinimo, 'precisam atenção', '#f59e0b');
  html += metricCard('🔴','Zerados', zerados, 'sem nenhuma unidade', '#ef4444');
  el.innerHTML = html;
}

// ==========================================
// 🕳️ Moldes sem copo cadastrado — gerenciador visual pedido pelo PCM
// ==========================================
function renderizarMoldesSemCopo(jobsInfo) {
  const el = document.getElementById('coposMoldesSemCopoWrap');
  if (!el) return;
  const jobsComCopo = new Set(_todosCoposCache.map(c => c.job));
  const semCopo = jobsInfo.filter(j => !jobsComCopo.has(j.nome)).map(j => j.nome).sort();
  if (!semCopo.length) { el.innerHTML = ''; return; }

  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:16px;border-left:3px solid #94a3b8;background:#f8fafc;border-radius:6px">
    <span style="font-size:12px;font-weight:700;color:#475569;white-space:nowrap">🕳️ Sem copo cadastrado (${semCopo.length})</span>
    ${semCopo.map(job => `<span onclick="abrirModalCopo(null,'${job.replace(/'/g,"\\'")}')" style="font-size:11px;color:#475569;background:#e2e8f0;padding:2px 9px;border-radius:10px;white-space:nowrap;cursor:pointer">${job}</span>`).join('')}
  </div>`;
}

// ==========================================
// 🃏 Lista de copos
// ==========================================
function renderizarListaCopos(copos) {
  const el = document.getElementById('listaCopos');
  if (!el) return;
  if (!copos.length) { el.innerHTML = '<div class="empty-msg">Nenhum copo encontrado.</div>'; return; }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
    ${copos.map(c => {
      const total = (c.estoque_novo||0) + (c.estoque_embuchado||0);
      const minimo = _estoqueMinimoCopo(c, _mapaCavidadesCache);
      const status = total === 0 ? {cor:'#b91c1c',bg:'#fee2e2',txt:'Zerado'} : total < minimo ? {cor:'#c2410c',bg:'#ffedd5',txt:'Abaixo do mínimo'} : {cor:'#059669',bg:'#d1fae5',txt:'Em estoque'};
      return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-weight:700;color:#1e3a5f;font-size:14px">Copo ${c.codigo}</div>
            <div style="font-size:12px;color:#0056b3;font-weight:600;cursor:pointer" onclick="abrirFichaMolde('${c.job.replace(/'/g,"\\'")}')">${c.job}</div>
          </div>
          <span style="background:${status.bg};color:${status.cor};font-size:11px;padding:3px 8px;border-radius:8px;font-weight:700;white-space:nowrap">${status.txt}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#64748b;margin-bottom:10px">
          <div>Ø gate <b style="color:#1e3a5f">${c.gate_diametro||'—'}mm</b></div>
          <div>Ø boca <b style="color:#1e3a5f">${c.boca_diametro||'—'}mm</b></div>
          <div>Comprimento <b style="color:#1e3a5f">${c.comprimento||'—'}mm</b></div>
          <div>Gate <b style="color:#1e3a5f">${c.gate_tipo||'—'}</b></div>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:10px">${c.tem_difusor?'✓ Com difusor de fluxo':'Sem difusor de fluxo'}</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600">Novo: ${c.estoque_novo||0}</span>
          <span style="background:#ede9fe;color:#7c3aed;font-size:11px;padding:2px 9px;border-radius:8px;font-weight:600">Embuchado: ${c.estoque_embuchado||0}</span>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-bottom:10px">Mínimo (cavidades do molde): ${minimo}</div>
        ${podeGerenciarCopos() ? `<button class="btn-secondary" style="font-size:12px;width:100%" onclick="abrirModalCopo(${c.id})">Gerenciar</button>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ==========================================
// ➕ Cadastro / edição de copo (inclui ajuste manual de estoque)
// ==========================================
function abrirModalCopo(id, jobPredefinido) {
  if (!podeGerenciarCopos()) return toast('Só o PCM pode gerenciar copos.', 'erro');
  const copo = id ? _todosCoposCache.find(c => c.id === id) : null;
  const div = document.createElement('div');
  div.id = 'modalCopoWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalCopo()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:480px;max-height:85vh;overflow-y:auto">
    <div class="modal-header"><h3>🔩 ${copo?'Editar':'Novo'} Copo</h3><button onclick="fecharModalCopo()">✕</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group"><label>Código do Copo *</label><input type="text" id="copoCodigo" value="${copo?copo.codigo.replace(/"/g,'&quot;'):''}" placeholder="Ex: 23629"></div>
        <div class="form-group"><label>Molde (dono) *</label>
          <div class="autocomplete-wrap">
            <input type="text" id="copoJob" value="${copo?copo.job.replace(/"/g,'&quot;'):(jobPredefinido||'')}" placeholder="Busque o molde...">
            <div class="autocomplete-list" id="copoJobList"></div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ø do Gate (mm)</label><input type="number" step="0.01" id="copoGateDiam" value="${copo&&copo.gate_diametro!=null?copo.gate_diametro:''}"></div>
        <div class="form-group"><label>Tipo de Gate</label>
          <select id="copoGateTipo">
            <option value="">Selecione...</option>
            <option value="Cônico" ${copo&&copo.gate_tipo==='Cônico'?'selected':''}>Cônico</option>
            <option value="Reto" ${copo&&copo.gate_tipo==='Reto'?'selected':''}>Reto</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ø da Boca (mm)</label><input type="number" step="0.01" id="copoBocaDiam" value="${copo&&copo.boca_diametro!=null?copo.boca_diametro:''}"></div>
        <div class="form-group"><label>Comprimento (mm)</label><input type="number" step="0.01" id="copoComprimento" value="${copo&&copo.comprimento!=null?copo.comprimento:''}"></div>
      </div>
      <label class="checkbox-label" style="margin-bottom:14px;display:block">
        <input type="checkbox" id="copoDifusor" ${copo&&copo.tem_difusor?'checked':''}> Possui difusor de fluxo
      </label>
      ${copo ? `
      <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:4px">
        <div style="font-weight:700;color:#1e3a5f;font-size:13px;margin-bottom:8px">Estoque (ajuste manual)</div>
        <div class="form-row">
          <div class="form-group"><label>Novo</label><input type="number" min="0" id="copoEstoqueNovo" value="${copo.estoque_novo||0}"></div>
          <div class="form-group"><label>Embuchado</label><input type="number" min="0" id="copoEstoqueEmbuchado" value="${copo.estoque_embuchado||0}"></div>
        </div>
        <div style="font-size:11px;color:#94a3b8">O estoque também se move sozinho quando alguém registra "Troca de Copo" no apontamento — use aqui só pra corrigir ou dar entrada.</div>
      </div>` : `<div style="font-size:11px;color:#94a3b8">O estoque inicial começa em 0 — ajuste depois de criar.</div>`}
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarCopo(${id||'null'})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalCopo()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  if (typeof setupAC === 'function') setupAC('copoJob', 'copoJobList', (_listas&&_listas.jobs)||[]);
}

function fecharModalCopo() { document.getElementById('modalCopoWrap')?.remove(); }

async function salvarCopo(id) {
  const codigo        = document.getElementById('copoCodigo')?.value?.trim();
  const job            = document.getElementById('copoJob')?.value?.trim();
  const gateDiametro   = parseFloat(document.getElementById('copoGateDiam')?.value) || null;
  const gateTipo       = document.getElementById('copoGateTipo')?.value || null;
  const bocaDiametro   = parseFloat(document.getElementById('copoBocaDiam')?.value) || null;
  const comprimento    = parseFloat(document.getElementById('copoComprimento')?.value) || null;
  const temDifusor     = document.getElementById('copoDifusor')?.checked || false;

  if (!codigo) return toast('Informe o código do copo.', 'erro');
  if (!job) return toast('Selecione o molde.', 'erro');
  if (!(_listas && (_listas.jobs||[]).includes(job))) return toast('Esse molde não existe no cadastro.', 'erro');

  const payload = { codigo, job, gate_diametro: gateDiametro, gate_tipo: gateTipo, boca_diametro: bocaDiametro, comprimento, tem_difusor: temDifusor };

  try {
    if (id) {
      const copoAntigo = _todosCoposCache.find(c => c.id === id);
      const novoNovo = parseInt(document.getElementById('copoEstoqueNovo')?.value) || 0;
      const novoEmbuchado = parseInt(document.getElementById('copoEstoqueEmbuchado')?.value) || 0;
      payload.estoque_novo = novoNovo;
      payload.estoque_embuchado = novoEmbuchado;
      await db._patch('copos', 'id=eq.'+id, payload);
      if (copoAntigo && ((copoAntigo.estoque_novo||0)!==novoNovo || (copoAntigo.estoque_embuchado||0)!==novoEmbuchado)) {
        if (typeof registrarLog === 'function') await registrarLog('copos', id, 'ajustar_estoque', 'estoque',
          `Novo:${copoAntigo.estoque_novo||0} Emb:${copoAntigo.estoque_embuchado||0}`, `Novo:${novoNovo} Emb:${novoEmbuchado}`);
      }
      toast('Copo atualizado!', 'sucesso');
    } else {
      payload.criado_por = _sessao?.nome || null;
      await db._post('copos', payload);
      toast('Copo cadastrado!', 'sucesso');
    }
    fecharModalCopo();
    await carregarPainelCopos();
  } catch(e) {
    toast('Erro ao salvar. Verifique se o código já não está em uso.', 'erro');
  }
}
