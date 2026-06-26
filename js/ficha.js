// ==========================================
// 📄 FICHA.JS — Ficha do Molde V3
// ==========================================

var _dadosFicha  = null;
var _lancsFicha  = [];
var _chartsFicha = {};

function abrirFichaMolde(job) {
  document.getElementById('fichaJobInput').value = job;
  irPara('ficha', document.getElementById('menuFicha'));
  setTimeout(() => buscarFicha(), 100);
}

async function buscarFicha() {
  const job = document.getElementById('fichaJobInput').value.trim();
  if (!job) return toast('Digite o nome do molde.', 'erro');
  const elConteudo = document.getElementById('fichaConteudo');
  const elVazio    = document.getElementById('fichaVazio');
  elConteudo.style.display = 'none';
  elVazio.style.display    = 'none';
  elConteudo.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando ficha...</span></div>';
  elConteudo.style.display = 'block';
  try {
    const [res, localizacao, pendencias, histLoc] = await Promise.all([
      db.buscarFicha(job),
      db.buscarLocalizacao(job),
      db._get('molde_pendencias', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*'),
      db._get('molde_localizacao_historico', 'job=eq.' + encodeURIComponent(job) + '&order=movido_em.desc', '*')
    ]);
    res.localizacao = localizacao;
    res.pendencias  = pendencias || [];
    res.histLoc     = histLoc   || [];
    _dadosFicha = res;
    _lancsFicha = res.lancamentos || [];
    if (!_lancsFicha.length) {
      elConteudo.style.display = 'none';
      elVazio.style.display    = 'block';
      elVazio.innerHTML = '<div style="font-size:48px">🔍</div><div>Nenhum lançamento para "' + job + '"</div>';
      return;
    }
    renderizarFicha(job, res);
  } catch(e) {
    elConteudo.innerHTML = '<div class="empty-state">Erro ao carregar ficha.</div>';
    toast('Erro ao carregar ficha.', 'erro');
  }
}

function renderizarFicha(job, res) {
  const lancs   = res.lancamentos || [];
  const hist    = res.statusHistory || [];
  const el      = document.getElementById('fichaConteudo');
  const locAtual = res.localizacao;
  const _locMap = {
    'Em Máquina':      { ico:'🟢', cor:'#10b981', bg:'#d1fae5' },
    'Na Ferramentaria':{ ico:'🔧', cor:'#0056b3', bg:'#dbeafe' },
    'Sala de Molde':   { ico:'📦', cor:'#8b5cf6', bg:'#ede9fe' },
    'Desativado/LOG':  { ico:'🔴', cor:'#ef4444', bg:'#fee2e2' },
  };
  const locInfo = locAtual ? (_locMap[locAtual.localizacao]||{ico:'📍',cor:'#64748b',bg:'#f1f5f9'}) : null;
  const corS    = locInfo?.cor || '#64748b';
  const bgS     = locInfo?.bg  || '#f1f5f9';
  const totalMins = lancs.reduce((a,l)=>a+(l.minutos||0),0);

  const porSetor = {};
  lancs.forEach(l => { const s=l.setor||'Outros'; if (!porSetor[s]) porSetor[s]=0; porSetor[s]+=l.minutos||0; });

  // Horas por tipo de atividade (todos os setores)
  const porTipo = {};
  lancs.forEach(l => {
    const t = l.tipo || 'Sem tipo';
    if (!porTipo[t]) porTipo[t]=0; porTipo[t]+=l.minutos||0;
  });
  const topTipos = Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,10);

  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };
  const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#84cc16'];

  let html = `
  <!-- CABEÇALHO -->
  <div class="card" style="border-left:4px solid ${corS}">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:6px">FICHA DO MOLDE</div>
        <div style="font-size:24px;font-weight:700;color:#1e3a5f;margin-bottom:8px">${job}</div>
        ${locInfo
          ? `<span style="display:inline-flex;align-items:center;gap:6px;background:${bgS};color:${corS};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;border:1px solid ${corS}">
              ${locInfo.ico} ${locAtual.localizacao}
              ${locAtual.maquina?'<span style="font-size:11px;opacity:0.8">· '+locAtual.maquina+'</span>':''}
             </span>`
          : '<span style="background:#f1f5f9;color:#64748b;padding:4px 12px;border-radius:20px;font-size:12px">📍 Localização não registrada</span>'
        }
      </div>
      <div style="text-align:right;font-size:12px;color:#64748b">
        <div>📅 Primeiro: <b>${lancs[0].data.split('-').reverse().join('/')}</b></div>
        <div>🕐 Último: <b>${lancs[lancs.length-1].data.split('-').reverse().join('/')}</b></div>
        <div>🔄 Intervenções: <b>${hist.length||1}</b></div>
      </div>
    </div>
  </div>

  <!-- MÉTRICAS — cards de setor clicáveis -->
  <div class="cards-row">
    <div class="metric-card" style="border-left-color:#10b981">
      <div class="metric-icon">⏱️</div>
      <div class="metric-valor" style="color:#10b981">${fmtMin(totalMins)}</div>
      <div class="metric-label">Total de Horas</div>
    </div>
    ${Object.entries(porSetor).map(([s,m])=>`
    <div class="metric-card" style="border-left-color:${cors[s]||'#64748b'};cursor:pointer;transition:box-shadow 0.2s,transform 0.15s"
      onclick="filtrarFichaSetor('${s}')"
      onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)';this.style.transform='translateY(-2px)'"
      onmouseout="this.style.boxShadow='';this.style.transform=''">
      <div class="metric-icon">${icos[s]||'🏭'}</div>
      <div class="metric-valor" style="color:${cors[s]||'#64748b'}">${fmtMin(m)}</div>
      <div class="metric-label">${s}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:4px">🔍 Clique para filtrar</div>
    </div>`).join('')}
    <div class="metric-card" style="border-left-color:#f59e0b">
      <div class="metric-icon">📋</div>
      <div class="metric-valor" style="color:#f59e0b">${lancs.length}</div>
      <div class="metric-label">Lançamentos</div>
    </div>
  </div>

  <!-- GRÁFICOS: Setor + Técnico + Tipo de Atividade -->
  <div class="graficos-2col">
    <div class="grafico-card">
      <div class="grafico-titulo">🗂️ Horas por Setor</div>
      <div style="height:250px"><canvas id="chartFichaSetores"></canvas></div>
    </div>
    <div class="grafico-card">
      <div class="grafico-titulo">👤 Horas por Técnico</div>
      <div style="height:250px"><canvas id="chartFichaTecnicos"></canvas></div>
    </div>
  </div>
  <div class="grafico-card">
    <div class="grafico-titulo">🔧 Horas por Tipo de Atividade</div>
    <div style="height:280px"><canvas id="chartFichaTipos"></canvas></div>
  </div>

  <!-- LINHA DO TEMPO -->
  <div class="card">
    <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:16px">📅 Linha do Tempo</div>
    <div id="fichaTimeline"></div>
  </div>

  <!-- HISTÓRICO COMPLETO COM FILTROS -->
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">☷ Histórico Completo</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="fichaFiltroSetor" onchange="filtrarFicha()" style="border-color:#10b981">
          <option value="Todos">Todos os Setores</option>
          <option value="Usinagem">⚙️ Usinagem</option>
          <option value="Bancada">🛠️ Bancada</option>
          <option value="Projeto">📐 Projeto</option>
        </select>
        <div id="fichaFiltroMaqDiv" style="display:none">
          <select id="fichaFiltroMaq" onchange="aplicarFiltrosFicha()"><option value="Todas">Todas as Máquinas</option></select>
        </div>
        <div id="fichaFiltroTipoDiv" style="display:none">
          <select id="fichaFiltroTipo" onchange="aplicarFiltrosFicha()"><option value="Todos">Todos os Serviços</option></select>
        </div>
        <div id="fichaFiltroAreaDiv" style="display:none">
          <select id="fichaFiltroArea" onchange="aplicarFiltrosFicha()"><option value="Todas">Todas as Áreas</option></select>
        </div>
        <button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="limparFiltrosFicha()">✕ Limpar</button>
        <button class="btn-success" onclick="exportarFichaCSV()" style="padding:6px 14px;font-size:12px">📥 CSV</button>
      </div>
    </div>
    <div id="fichaResumo" style="display:none;margin-bottom:12px" class="resumo-bar"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Setor</th><th>Técnico</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Horas</th><th>Descrição</th></tr></thead>
        <tbody id="tbodyFicha"></tbody>
      </table>
    </div>
  </div>`;

  el.innerHTML = html;

  // ==========================================
  // GRÁFICOS
  // ==========================================
  setTimeout(() => {
    // 1. Donut — Setores
    const setorEnt = Object.entries(porSetor);
    if (_chartsFicha['setores']) _chartsFicha['setores'].destroy();
    const ctx1 = document.getElementById('chartFichaSetores');
    if (ctx1) _chartsFicha['setores'] = new Chart(ctx1, {
      type:'doughnut',
      data:{ labels:setorEnt.map(e=>e[0]), datasets:[{ data:setorEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false,
        onClick:(evt,els)=>{ if(els.length) filtrarFichaSetor(setorEnt[els[0].index][0]); },
        plugins:{ legend:{position:'bottom'}, datalabels:{color:'#fff',font:{weight:'bold',size:13},
          formatter:(v,ctx2)=>{ const t=ctx2.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }},
          tooltip:{callbacks:{title:()=>'Clique para filtrar'}} }
      }
    });

    // 2. Barras — Técnicos
    const porFunc = {};
    lancs.forEach(l => { const f=l.funcionario||'-'; if (!porFunc[f]) porFunc[f]=0; porFunc[f]+=l.minutos||0; });
    const funcEnt = Object.entries(porFunc).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if (_chartsFicha['tecnicos']) _chartsFicha['tecnicos'].destroy();
    const ctx2 = document.getElementById('chartFichaTecnicos');
    if (ctx2) _chartsFicha['tecnicos'] = new Chart(ctx2, {
      type:'bar',
      data:{ labels:funcEnt.map(e=>e[0]), datasets:[{ data:funcEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'} },
        scales:{ y:{beginAtZero:true, title:{display:true,text:'Horas'}} }
      }
    });

    // 3. Barras horizontais — Tipos de Atividade (NOVO)
    if (_chartsFicha['tipos']) _chartsFicha['tipos'].destroy();
    const ctx3 = document.getElementById('chartFichaTipos');
    if (ctx3 && topTipos.length) _chartsFicha['tipos'] = new Chart(ctx3, {
      type:'bar',
      data:{
        labels: topTipos.map(e=>e[0]),
        datasets:[{
          data: topTipos.map(e=>Math.round(e[1]/60*10)/10),
          backgroundColor: topTipos.map((_,i)=>paleta[i%paleta.length]),
          borderRadius: 6
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{
          legend:{display:false},
          datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'}
        },
        scales:{ x:{beginAtZero:true, title:{display:true,text:'Horas'}} }
      }
    });
  }, 100);

  renderizarTimeline(hist, lancs, res.pendencias || [], res.localizacao || null, res.histLoc || []);
  renderizarTabelaFicha(lancs);
}

// ==========================================
// FILTRO POR SETOR — chamado pelo clique no card ou no gráfico
// ==========================================
function filtrarFichaSetor(setor) {
  // Atualiza o select de setor
  const sel = document.getElementById('fichaFiltroSetor');
  if (sel) sel.value = setor;

  // Mostra/esconde filtros secundários
  filtrarFicha();

  // Scroll suave até a tabela
  const tabela = document.querySelector('.card:last-of-type');
  if (tabela) tabela.scrollIntoView({ behavior:'smooth', block:'start' });
}

function limparFiltrosFicha() {
  const sel = document.getElementById('fichaFiltroSetor');
  if (sel) sel.value = 'Todos';
  filtrarFicha();
}

// ==========================================
// LINHA DO TEMPO
// ==========================================
function renderizarTimeline(hist, lancs, pendencias, localizacao, histLoc) {
  const el = document.getElementById('fichaTimeline');
  if (!el) return;

  const locMap = {
    'Em Máquina':      { ico:'🟢', cor:'#10b981', bg:'#d1fae5' },
    'Na Ferramentaria':{ ico:'🔧', cor:'#0056b3', bg:'#dbeafe' },
    'Sala de Molde':   { ico:'📦', cor:'#8b5cf6', bg:'#ede9fe' },
    'Desativado/LOG':  { ico:'🔴', cor:'#ef4444', bg:'#fee2e2' },
  };
  const locInfo = localizacao ? locMap[localizacao.localizacao] : null;
  const abertas    = (pendencias||[]).filter(p => !p.concluido);
  const concluidas = (pendencias||[]).filter(p =>  p.concluido);

  let html = '<div style="position:relative;padding-left:32px">';

  // 1. Localização atual (PCM)
  if (localizacao) {
    const li = locInfo || { ico:'📍', cor:'#64748b', bg:'#f1f5f9' };
    html += `<div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:${li.cor};border:2px solid #fff;box-shadow:0 0 0 2px ${li.cor}"></div>
      <div style="background:${li.bg};border-radius:10px;border:1px solid ${li.cor}40;border-left:3px solid ${li.cor};padding:14px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-size:13px;font-weight:700;color:${li.cor}">${li.ico} ${localizacao.localizacao}</span>
            ${localizacao.maquina?`<span style="font-size:12px;color:#64748b;margin-left:8px">⚙️ ${localizacao.maquina}</span>`:''}
          </div>
          <span style="font-size:11px;color:#94a3b8">📅 ${localizacao.atualizado_em?new Date(localizacao.atualizado_em).toLocaleDateString('pt-BR'):'—'} · 👤 ${localizacao.atualizado_por||'—'}</span>
        </div>
        ${localizacao.observacao?`<div style="font-size:12px;color:#64748b;margin-top:8px">📝 ${localizacao.observacao}</div>`:''}
      </div>
    </div>`;
  }

  // 2. Checklist de pendências
  if (pendencias && pendencias.length) {
    html += `<div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 0 0 2px #f59e0b"></div>
      <div style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;border-left:3px solid #f59e0b;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:12px">
          ✅ Pendências
          ${abertas.length?`<span style="background:#ef4444;color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:8px">${abertas.length} abertas</span>`:'<span style="background:#10b981;color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:8px">Todas concluídas</span>'}
        </div>
        ${abertas.map(p=>`
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dashed #fde68a">
            <span style="color:#f59e0b;font-size:14px;margin-top:1px">○</span>
            <div style="flex:1">
              <div style="font-size:13px;color:#1e3a5f">${p.texto}</div>
              <div style="font-size:10px;color:#94a3b8">👤 ${p.criado_por||'—'} · 📅 ${p.criado_em?new Date(p.criado_em).toLocaleDateString('pt-BR'):'—'}</div>
            </div>
          </div>`).join('')}
        ${concluidas.length?`
          <div style="margin-top:10px;font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:1px">CONCLUÍDAS</div>
          ${concluidas.map(p=>`
            <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;opacity:0.6">
              <span style="color:#10b981;font-size:14px;margin-top:1px">✓</span>
              <div style="flex:1">
                <div style="font-size:12px;color:#64748b;text-decoration:line-through">${p.texto}</div>
                <div style="font-size:10px;color:#94a3b8">✅ ${p.data_conclusao?new Date(p.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
              </div>
            </div>`).join('')}
        `:''}
      </div>
    </div>`;
  } else {
    html += `<div style="position:relative;margin-bottom:16px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#e2e8f0;border:2px solid #fff"></div>
      <div style="color:#94a3b8;font-size:13px;padding:8px 0">Nenhuma pendência registrada pelo PCM.</div>
    </div>`;
  }

  // 3. Trocas de copo
  const copos = lancs.filter(l => l.trocaCopo===true||l.trocaCopo==='true');
  if (copos.length) {
    html += `<div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#0891b2;border:2px solid #fff;box-shadow:0 0 0 2px #0891b2"></div>
      <div style="background:#e0f2fe;border-radius:10px;border:1px solid #bae6fd;border-left:3px solid #0891b2;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:10px">🔄 Histórico de Troca de Copo</div>
        ${copos.map(l=>`
          <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed #bae6fd;font-size:12px">
            <span style="color:#0369a1;font-weight:600">${l.data?l.data.split('-').reverse().join('/'):'—'}</span>
            <span style="background:${l.tipoCopo==='Novo'?'#d1fae5':'#e0f2fe'};color:${l.tipoCopo==='Novo'?'#059669':'#0369a1'};padding:1px 8px;border-radius:8px;font-weight:700">${l.tipoCopo||'—'}</span>
            <span style="color:#64748b">👤 ${l.funcionario||'—'}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // 4. Histórico de movimentação (PCM)
  if (histLoc && histLoc.length) {
    const locMapH = {
      'Em Máquina':      { ico:'🟢', cor:'#10b981', bg:'#d1fae5' },
      'Na Ferramentaria':{ ico:'🔧', cor:'#0056b3', bg:'#dbeafe' },
      'Sala de Molde':   { ico:'📦', cor:'#8b5cf6', bg:'#ede9fe' },
      'Desativado/LOG':  { ico:'🔴', cor:'#ef4444', bg:'#fee2e2' },
    };
    html += `<div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#475569;border:2px solid #fff;box-shadow:0 0 0 2px #475569"></div>
      <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;border-left:3px solid #475569;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:12px">🗺️ Histórico de Movimentação</div>
        ${histLoc.map(h => {
          const li = locMapH[h.localizacao] || { ico:'📍', cor:'#64748b', bg:'#f1f5f9' };
          const dt = h.movido_em ? new Date(h.movido_em).toLocaleDateString('pt-BR') : '—';
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed #e2e8f0">
            <span style="background:${li.bg};color:${li.cor};font-size:11px;padding:2px 8px;border-radius:8px;font-weight:700;white-space:nowrap">${li.ico} ${h.localizacao}</span>
            ${h.maquina?`<span style="font-size:11px;color:#64748b">🏭 ${h.maquina}</span>`:''}
            <span style="font-size:11px;color:#94a3b8;margin-left:auto;white-space:nowrap">📅 ${dt} · 👤 ${h.movido_por||'—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

// ==========================================
// TABELA
// ==========================================
function renderizarTabelaFicha(lancs) {
  const tbody = document.getElementById('tbodyFicha');
  if (!tbody) return;
  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };
  tbody.innerHTML = lancs.map(l => `<tr>
    <td><b>${l.data?l.data.split('-').reverse().join('/'):'—'}</b></td>
    <td><span style="color:${cors[l.setor]||'#64748b'};font-weight:600;font-size:12px">${icos[l.setor]||'🏭'} ${l.setor}</span></td>
    <td>${l.funcionario||'—'}</td>
    <td>${l.tipo||'—'}</td>
    <td style="font-size:12px">${l.horaInicio||'—'}</td>
    <td style="font-size:12px">${l.horaFim||'—'}</td>
    <td style="color:#10b981;font-weight:700">${l.hrProd||'—'}</td>
    <td style="font-size:12px;color:#64748b">${l.descricao||'—'}</td>
  </tr>`).join('') || '<tr><td colspan="8" class="empty-msg">Nenhum lançamento.</td></tr>';
}

// ==========================================
// FILTROS DA TABELA
// ==========================================
function filtrarFicha() {
  const setor   = document.getElementById('fichaFiltroSetor').value;
  const maqDiv  = document.getElementById('fichaFiltroMaqDiv');
  const tipoDiv = document.getElementById('fichaFiltroTipoDiv');
  const areaDiv = document.getElementById('fichaFiltroAreaDiv');

  if (maqDiv)  maqDiv.style.display  = setor==='Usinagem' ? '' : 'none';
  if (tipoDiv) tipoDiv.style.display = setor==='Bancada'  ? '' : 'none';
  if (areaDiv) areaDiv.style.display = setor==='Projeto'  ? '' : 'none';

  if (setor === 'Usinagem') {
    const sel = document.getElementById('fichaFiltroMaq');
    if (sel) {
      const mqs = [...new Set(_lancsFicha.filter(l=>l.setor==='Usinagem'&&l.maquina).map(l=>l.maquina))];
      sel.innerHTML = '<option value="Todas">Todas as Máquinas</option>' + mqs.map(m=>`<option value="${m}">${m}</option>`).join('');
    }
  } else if (setor === 'Bancada') {
    const sel = document.getElementById('fichaFiltroTipo');
    if (sel) {
      const ts = [...new Set(_lancsFicha.filter(l=>l.setor==='Bancada'&&l.tipo).map(l=>l.tipo))];
      sel.innerHTML = '<option value="Todos">Todos os Serviços</option>' + ts.map(t=>`<option value="${t}">${t}</option>`).join('');
    }
  } else if (setor === 'Projeto') {
    const sel = document.getElementById('fichaFiltroArea');
    if (sel) {
      const as = [...new Set(_lancsFicha.filter(l=>l.setor==='Projeto'&&l.area).map(l=>l.area))];
      sel.innerHTML = '<option value="Todas">Todas as Áreas</option>' + as.map(a=>`<option value="${a}">${a}</option>`).join('');
    }
  }

  ['fichaFiltroMaq','fichaFiltroTipo','fichaFiltroArea'].forEach(id => {
    const s = document.getElementById(id); if (s) s.selectedIndex = 0;
  });
  aplicarFiltrosFicha();
}

function aplicarFiltrosFicha() {
  const setor = document.getElementById('fichaFiltroSetor').value;
  const maq   = document.getElementById('fichaFiltroMaq')?.value  || 'Todas';
  const tipo  = document.getElementById('fichaFiltroTipo')?.value || 'Todos';
  const area  = document.getElementById('fichaFiltroArea')?.value || 'Todas';

  const filtrado = _lancsFicha.filter(l => {
    if (setor!=='Todos' && l.setor!==setor) return false;
    if (setor==='Usinagem' && maq!=='Todas'  && l.maquina!==maq)  return false;
    if (setor==='Bancada'  && tipo!=='Todos' && l.tipo!==tipo)    return false;
    if (setor==='Projeto'  && area!=='Todas' && l.area!==area)    return false;
    return true;
  });

  const totalMins = filtrado.reduce((a,l)=>a+(l.minutos||0),0);
  const elRes = document.getElementById('fichaResumo');
  if (elRes) {
    const temFiltro = setor !== 'Todos';
    elRes.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span style="font-size:13px;font-weight:600;color:#1e3a5f">
        ${temFiltro ? '🔍 Filtro: <b>'+setor+'</b>' : '📊 Resultado:'}
      </span>
      <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">📋 <b>${filtrado.length} lançamentos</b></span>
      ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bae6fd;font-size:13px;color:#0369a1">⏱️ <b>${fmtMin(totalMins)}</b></span>`:''}
    </div>`;
    elRes.style.display = 'block';
  }
  renderizarTabelaFicha(filtrado);
}

// ==========================================
// EXPORTAR CSV
// ==========================================
function exportarFichaCSV() {
  if (!_lancsFicha.length) return toast('Nenhum dado para exportar.', 'erro');
  const job = document.getElementById('fichaJobInput').value;
  const linhas = [['Data','Setor','Técnico','Tipo','Início','Fim','Horas','Descrição'].join(';')];
  _lancsFicha.forEach(l => linhas.push([
    l.data, l.setor, l.funcionario, l.tipo||'',
    l.horaInicio||'', l.horaFim||'', l.hrProd||'',
    (l.descricao||'').replace(/;/g,',')
  ].join(';')));
  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `Ficha_${job.replace(/\s/g,'_')}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!', 'sucesso');
}
