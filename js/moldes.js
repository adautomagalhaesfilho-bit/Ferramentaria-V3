// ==========================================
// 🔩 MOLDES.JS — Gestão de Moldes (Kanban)
// ==========================================

var _listaMoldes = [];
var _cardArrastando = null;
var _filtroMoldes = 'todos';

async function carregarMoldes() {
  try {
    _listaMoldes = await db.listarStatusJobs();
    renderizarBoard(_listaMoldes);
  } catch(e) {
    toast('Erro ao carregar moldes.', 'erro');
  }
}

function filtrarMoldes(tipo) {
  if (tipo) _filtroMoldes = tipo;
  const busca = (document.getElementById('buscaMoldes')?.value || '').toUpperCase();
  const filtrado = _listaMoldes.filter(m => {
    if (_filtroMoldes === 'molde'   &&  isServico(m.job)) return false;
    if (_filtroMoldes === 'servico' && !isServico(m.job)) return false;
    if (busca && !m.job.toUpperCase().includes(busca)) return false;
    return true;
  });
  renderizarBoard(filtrado);
}

function isServico(job) {
  if (!job) return false;
  const n = job.toString().toUpperCase();
  return n.startsWith('SV') || n.startsWith('S/');
}

function renderizarBoard(lista) {
  const grupos = { 'Em andamento':[], 'Pausado':[], 'Finalizado':[] };
  lista.forEach(m => { if (grupos[m.status]) grupos[m.status].push(m); });

  const mapa = {
    'Em andamento': { cards:'cardsAndamento', badge:'badgeAndamento' },
    'Pausado':       { cards:'cardsPausado',   badge:'badgePausado'   },
    'Finalizado':    { cards:'cardsFinalizado', badge:'badgeFinalizado' },
  };

  Object.entries(mapa).forEach(([status, ids]) => {
    const items = grupos[status] || [];
    const elBadge = document.getElementById(ids.badge);
    const elCards = document.getElementById(ids.cards);
    if (elBadge) elBadge.innerText = items.length;
    if (!elCards) return;
    if (!items.length) { elCards.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px;font-style:italic">Nenhum item</div>'; return; }
    const moldes   = items.filter(m => !isServico(m.job));
    const servicos = items.filter(m =>  isServico(m.job));
    let html = moldes.map(m => criarCard(m)).join('');
    if (servicos.length) {
      if (moldes.length) html += '<div style="border-top:2px dashed #e2e8f0;margin:12px 0 8px;padding-top:6px;font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:1px">SERVIÇOS</div>';
      html += servicos.map(m => criarCard(m)).join('');
    }
    elCards.innerHTML = html;
  });

  // Drag events
  setTimeout(() => {
    document.querySelectorAll('.card-molde').forEach(card => {
      card.addEventListener('dragstart', function(e) {
        _cardArrastando = this.dataset.job;
        this.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function() { this.style.opacity = '1'; });
    });
  }, 50);
}

function criarCard(m) {
  const corBorda = m.status==='Em andamento'?'#10b981':m.status==='Pausado'?'#f59e0b':'#cbd5e1';
  const jobEsc   = (m.job||'').replace(/'/g,"\\'");
  const ehSv     = isServico(m.job);
  return `<div class="card-molde" draggable="true" data-job="${jobEsc}" style="border-left-color:${corBorda}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        ${ehSv?'<span style="font-size:9px;background:#f1f5f9;color:#64748b;padding:1px 6px;border-radius:4px;font-weight:700;display:inline-block;margin-bottom:4px">SERVIÇO</span><br>':''}
        <div class="card-molde-nome">${m.job||''}</div>
      </div>
      ${m.intervencao>1?`<span style="background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">Interv. ${m.intervencao}</span>`:''}
    </div>
    ${m.descricao?`<div class="card-molde-desc">${m.descricao}</div>`:''}
    <div class="card-molde-footer">
      <span style="font-size:10px;color:#94a3b8">📅 ${m.data_inicio?m.data_inicio.split('-').reverse().join('/'):'—'}</span>
      <div style="display:flex;gap:6px">
        <button onclick="abrirFichaDoMolde('${jobEsc}')" style="background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">📋 Ficha</button>
        ${podeEditar()?`<button onclick="abrirModalStatus('${jobEsc}')" style="background:#f8fafc;border:1px solid #e2e8f0;color:#475569;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">✏️</button>`:''}
      </div>
    </div>
  </div>`;
}

function soltarCard(event, novoStatus) {
  event.preventDefault();
  if (!_cardArrastando) return;
  const job = _cardArrastando; _cardArrastando = null;
  const item = _listaMoldes.find(m => m.job === job);
  if (!item || item.status === novoStatus) return;
  abrirModalStatus(job);
}

function abrirFichaDoMolde(job) {
  document.getElementById('fichaJobInput').value = job;
  irPara('ficha', document.getElementById('menuFicha'));
  setTimeout(() => buscarFicha(), 100);
}
