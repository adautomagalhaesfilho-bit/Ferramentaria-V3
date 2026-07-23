// ==========================================
// 📄 FICHA.JS — Ficha do Molde V3 + Produção
// ==========================================

var _dadosFicha  = null;
var _lancsFicha  = [];
var _lancsProdFicha = [];
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
    const [res, localizacao, pendencias, histLoc, prodLancs, intervencoes] = await Promise.all([
      db.buscarFicha(job),
      db.buscarLocalizacao(job),
      db._get('molde_pendencias', 'job=eq.' + encodeURIComponent(job) + '&order=criado_em.asc', '*').catch(()=>[]),
      db._get('molde_localizacao_historico', 'job=eq.' + encodeURIComponent(job) + '&order=movido_em.desc', '*').catch(()=>[]),
      db._get('prod_lancamentos', 'molde=eq.' + encodeURIComponent(job) + '&order=data.asc', '*').catch(()=>[]),
      db.listarIntervencoesPorJob(job).catch(()=>[])
    ]);
    res.localizacao  = localizacao;
    res.pendencias   = pendencias  || [];
    res.histLoc      = histLoc     || [];
    res.prodLancamentos = prodLancs || [];
    res.intervencoes = intervencoes || [];

    _dadosFicha     = res;
    _lancsFicha     = res.lancamentos || [];
    _lancsProdFicha = res.prodLancamentos || [];

    if (!res.jobExiste && !_lancsFicha.length && !_lancsProdFicha.length && !res.pendencias.length && !res.intervencoes.length && !res.histLoc.length && !res.localizacao && !(res.anexos&&res.anexos.length)) {
      elConteudo.style.display = 'none';
      elVazio.style.display    = 'block';
      elVazio.innerHTML = '<div style="font-size:48px">🔍</div><div>Nenhum molde encontrado com o nome "' + job + '"</div>';
      return;
    }
    renderizarFicha(job, res);
  } catch(e) {
    elConteudo.innerHTML = '<div class="empty-state">Erro ao carregar ficha.</div>';
    toast('Erro ao carregar ficha.', 'erro');
    console.error(e);
  }
}

function renderizarFicha(job, res) {
  const lancs     = res.lancamentos || [];
  const prodLancs = res.prodLancamentos || [];
  const hist      = res.statusHistory || [];
  const el        = document.getElementById('fichaConteudo');
  const locAtual  = res.localizacao;

  const _locMap = {
    'Em Máquina':      { ico:'🟢', cor:'#10b981', bg:'#d1fae5' },
    'Na Ferramentaria':{ ico:'🔧', cor:'#0056b3', bg:'#dbeafe' },
    'Sala de Molde':   { ico:'📦', cor:'#8b5cf6', bg:'#ede9fe' },
    'Desativado/LOG':  { ico:'🔴', cor:'#ef4444', bg:'#fee2e2' },
  };
  const locInfo = locAtual ? (_locMap[locAtual.localizacao]||{ico:'📍',cor:'#64748b',bg:'#f1f5f9'}) : null;
  const corS    = locInfo?.cor || '#64748b';
  const bgS     = locInfo?.bg  || '#f1f5f9';

  // Totais
  const totalMins     = lancs.reduce((a,l)=>a+(l.minutos||0),0);
  const totalMinsProd = prodLancs.reduce((a,l)=>a+(l.minutos||0),0);

  // Horas por setor (Ferramentaria)
  const porSetor = {};
  lancs.forEach(l => { const s=l.setor||'Outros'; if (!porSetor[s]) porSetor[s]=0; porSetor[s]+=l.minutos||0; });
  if (totalMinsProd > 0) porSetor['Produção'] = totalMinsProd;

  // Horas por tipo
  const porTipo = {};
  lancs.forEach(l => { const t=l.tipo||'Sem tipo'; if (!porTipo[t]) porTipo[t]=0; porTipo[t]+=l.minutos||0; });
  prodLancs.forEach(l => { const t=l.tipo||'Sem tipo'; if (!porTipo[t]) porTipo[t]=0; porTipo[t]+=l.minutos||0; });
  const topTipos = Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,10);

  // Horas por técnico (todos os setores)
  const porFunc = {};
  lancs.forEach(l => { const f=l.funcionario||'-'; if (!porFunc[f]) porFunc[f]=0; porFunc[f]+=l.minutos||0; });
  prodLancs.forEach(l => {
    const tecs = Array.isArray(l.tecnicos) ? l.tecnicos : (l.tecnicos||'').split(',').map(t=>t.trim()).filter(Boolean);
    tecs.forEach(f => { if (!porFunc[f]) porFunc[f]=0; porFunc[f]+=l.minutos||0; });
  });

  const cors   = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', 'Produção':'#10b981' };
  const icos   = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐', 'Produção':'🏭' };
  const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#84cc16'];

  // Data primeiro e último lançamento (todos os setores)
  const todasDatas = [
    ...lancs.map(l=>l.data),
    ...prodLancs.map(l=>l.data)
  ].filter(Boolean).sort();
  const dataPrimeiro = todasDatas[0] || '';
  const dataUltimo   = todasDatas[todasDatas.length-1] || '';
  const totalLancs   = lancs.length + prodLancs.length;

  let html = `
  <div class="card" style="border-left:4px solid ${corS}">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:6px">FICHA DO MOLDE</div>
        <div style="font-size:24px;font-weight:700;color:#1e3a5f;margin-bottom:8px">${job}${res.numCavidades?` <span style="font-size:13px;font-weight:600;color:#64748b;background:#f1f5f9;padding:3px 10px;border-radius:12px;vertical-align:middle">${res.numCavidades} cavidade${res.numCavidades>1?'s':''}</span>`:''}</div>
        ${locInfo
          ? `<span style="display:inline-flex;align-items:center;gap:6px;background:${bgS};color:${corS};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;border:1px solid ${corS}">
              ${locInfo.ico} ${locAtual.localizacao}
              ${locAtual.maquina?'<span style="font-size:11px;opacity:0.8">· '+locAtual.maquina+'</span>':''}
             </span>`
          : '<span style="background:#f1f5f9;color:#64748b;padding:4px 12px;border-radius:20px;font-size:12px">📍 Localização não registrada</span>'
        }
      </div>
      <div style="text-align:right;font-size:12px;color:#64748b">
        <div>📅 Primeiro: <b>${dataPrimeiro?dataPrimeiro.split('-').reverse().join('/'):'—'}</b></div>
        <div>🕐 Último: <b>${dataUltimo?dataUltimo.split('-').reverse().join('/'):'—'}</b></div>
        <div>🔄 Intervenções: <b>${hist.length||1}</b></div>
      </div>
    </div>
  </div>

  <div class="cards-row">
    <div class="metric-card" style="border-left-color:#10b981">
      <div class="metric-icon">⏱️</div>
      <div class="metric-valor" style="color:#10b981">${fmtMin(totalMins+totalMinsProd)}</div>
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
      <div class="metric-valor" style="color:#f59e0b">${totalLancs}</div>
      <div class="metric-label">Lançamentos</div>
    </div>
  </div>

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

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">📷 Fotos e Vídeos</div>
      <button class="btn-primary" style="font-size:12px;padding:6px 14px" onclick="abrirModalAnexoMolde('${job.replace(/'/g,"\\'")}')">+ Anexar</button>
    </div>
    ${typeof renderizarGaleriaAnexosMolde === 'function' ? renderizarGaleriaAnexosMolde(res.anexos||[]) : ''}
  </div>

  <div class="card" style="border-left:4px solid #059669">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">🛠️ Histórico de Intervenções</div>
      ${typeof podeRegistrarIntervencao === 'function' && podeRegistrarIntervencao()
        ? `<button class="btn-success" style="font-size:12px;padding:6px 14px" onclick="abrirModalIntervencao('${job.replace(/'/g,"\\'")}')">+ Registrar Intervenção</button>`
        : ''}
    </div>
    <div id="fichaIntervencoes">${typeof renderizarIntervencoesHTML==='function' ? renderizarIntervencoesHTML(res.intervencoes||[], job) : ''}</div>
  </div>

  <div class="card">
    <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:16px">📅 Linha do Tempo</div>
    <div id="fichaTimeline"></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">☷ Histórico Completo</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="fichaFiltroSetor" onchange="filtrarFicha()" style="border-color:#10b981">
          <option value="Todos">Todos os Setores</option>
          <option value="Usinagem">⚙️ Usinagem</option>
          <option value="Bancada">🛠️ Bancada</option>
          <option value="Projeto">📐 Projeto</option>
          <option value="Produção">🏭 Produção</option>
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
        <div id="fichaFiltroInjetDiv" style="display:none">
          <select id="fichaFiltroInjet" onchange="aplicarFiltrosFicha()"><option value="Todas">Todas as Injetoras</option></select>
        </div>
        <button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="limparFiltrosFicha()">✕ Limpar</button>
        <button class="btn-success" onclick="exportarFichaCSV()" style="padding:6px 14px;font-size:12px">📥 CSV</button>
      </div>
    </div>
    <div id="fichaResumo" style="display:none;margin-bottom:12px" class="resumo-bar"></div>
    <div class="table-wrap">
      <table>
        <thead id="fichaTableHead">
          <tr><th>Data</th><th>Setor</th><th>Técnico</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Horas</th><th>Descrição</th></tr>
        </thead>
        <tbody id="tbodyFicha"></tbody>
      </table>
    </div>
  </div>`;

  el.innerHTML = html;

  setTimeout(() => {
    // Gráfico Setores
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

    // Gráfico Técnicos
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

    // Gráfico Tipos
    if (_chartsFicha['tipos']) _chartsFicha['tipos'].destroy();
    const ctx3 = document.getElementById('chartFichaTipos');
    if (ctx3 && topTipos.length) _chartsFicha['tipos'] = new Chart(ctx3, {
      type:'bar',
      data:{ labels:topTipos.map(e=>e[0]), datasets:[{ data:topTipos.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:topTipos.map((_,i)=>paleta[i%paleta.length]), borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'} },
        scales:{ x:{beginAtZero:true, title:{display:true,text:'Horas'}} }
      }
    });
  }, 100);

  renderizarTimeline(hist, lancs, res.pendencias||[], res.localizacao||null, res.histLoc||[]);
  renderizarTabelaFicha(_lancsFicha, _lancsProdFicha);
}

function filtrarFichaSetor(setor) {
  const sel = document.getElementById('fichaFiltroSetor');
  if (sel) sel.value = setor;
  filtrarFicha();
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

  const abertas    = (pendencias||[]).filter(p => !p.concluido);
  const concluidas = (pendencias||[]).filter(p =>  p.concluido);

  let html = '<div style="position:relative;padding-left:32px">';

  // 1. Checklist de pendências
  if (pendencias && pendencias.length) {
    html += `<div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 0 0 2px #f59e0b"></div>
      <div style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;border-left:3px solid #f59e0b;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:12px">
          ✅ Pendências
          ${abertas.length
            ? `<span style="background:#ef4444;color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:8px">${abertas.length} abertas</span>`
            : '<span style="background:#10b981;color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:8px">Todas concluídas</span>'}
        </div>
        ${abertas.map(p=>`
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dashed #fde68a">
            <span style="color:#f59e0b;font-size:14px;margin-top:1px">○</span>
            <div style="flex:1">
              <div style="font-size:13px;color:#1e3a5f">${p.texto}</div>
              <div style="font-size:10px;color:#94a3b8">👤 ${p.criado_por||'—'} · 📅 ${p.criado_em?new Date(p.criado_em).toLocaleDateString('pt-BR'):'—'}</div>
            </div>
          </div>`).join('')}
        ${concluidas.length ? `
          <div style="margin-top:10px;font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:1px">CONCLUÍDAS</div>
          ${concluidas.map(p=>`
            <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;opacity:0.6">
              <span style="color:#10b981;font-size:14px;margin-top:1px">✓</span>
              <div style="flex:1">
                <div style="font-size:12px;color:#64748b;text-decoration:line-through">${p.texto}</div>
                <div style="font-size:10px;color:#94a3b8">✅ ${p.data_conclusao?new Date(p.data_conclusao+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</div>
              </div>
            </div>`).join('')}
        ` : ''}
      </div>
    </div>`;
  } else {
    html += `<div style="position:relative;margin-bottom:16px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#e2e8f0;border:2px solid #fff"></div>
      <div style="color:#94a3b8;font-size:13px;padding:8px 0">Nenhuma pendência registrada pelo PCM.</div>
    </div>`;
  }

  // 2. Histórico de troca de copo
  const copos = lancs.filter(l => l.trocaCopo===true || l.trocaCopo==='true');
  if (copos.length) {
    html += `<div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#0891b2;border:2px solid #fff;box-shadow:0 0 0 2px #0891b2"></div>
      <div style="background:#e0f2fe;border-radius:10px;border:1px solid #bae6fd;border-left:3px solid #0891b2;padding:14px 16px">
        <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:10px">🔄 Histórico de Troca de Copo</div>
        ${copos.map(l=>`
          <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed #bae6fd;font-size:12px;flex-wrap:wrap;align-items:center">
            <span style="color:#0369a1;font-weight:600">${l.data?l.data.split('-').reverse().join('/'):'—'}</span>
            <span style="background:${l.tipoCopo==='Novo'?'#d1fae5':'#e0f2fe'};color:${l.tipoCopo==='Novo'?'#059669':'#0369a1'};padding:1px 8px;border-radius:8px;font-weight:700">${l.tipoCopo||'—'}</span>
            ${l.descricaoCopo?`<span style="color:#64748b">📝 ${l.descricaoCopo}</span>`:''}
          </div>`).join('')}
      </div>
    </div>`;
  }

  // 3. Histórico de movimentação (PCM)
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
// TABELA — Ferramentaria + Produção
// ==========================================
function renderizarTabelaFicha(lancs, prodLancs) {
  const tbody = document.getElementById('tbodyFicha');
  if (!tbody) return;

  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', 'Produção':'#10b981' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐', 'Produção':'🏭' };

  // Converte prod_lancamentos para formato compatível
  const prodFormatado = (prodLancs||[]).map(l => ({
    data:       l.data,
    setor:      'Produção',
    funcionario: Array.isArray(l.tecnicos) ? l.tecnicos.join(', ') : (l.tecnicos||'—'),
    tipo:       l.tipo || '—',
    horaInicio: l.hora_inicio ? l.hora_inicio.substring(0,5) : '',
    horaFim:    l.hora_fim    ? l.hora_fim.substring(0,5)    : '',
    minutos:    l.minutos || 0,
    hrProd:     fmtMin(l.minutos||0),
    descricao:  [l.atividade, l.descricao].filter(Boolean).join(' — ') || '—',
    injetora:   l.injetora || '—',
    _isProd:    true
  }));

  // Une e ordena por data
  const todos = [...(lancs||[]), ...prodFormatado].sort((a,b)=>a.data>b.data?1:a.data<b.data?-1:0);

  if (!todos.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum lançamento.</td></tr>';
    return;
  }

  tbody.innerHTML = todos.map(l => `<tr>
    <td><b>${l.data?l.data.split('-').reverse().join('/'):'—'}</b></td>
    <td><span style="color:${cors[l.setor]||'#64748b'};font-weight:600;font-size:12px">${icos[l.setor]||'🏭'} ${l.setor}</span></td>
    <td style="font-size:12px">${(l.funcionario||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(t):t).join(', ') || '—'}${l._isProd&&l.injetora?`<br><span style="color:#94a3b8;font-size:11px">🏭 ${l.injetora}</span>`:''}</td>
    <td>${l.tipo||'—'}</td>
    <td style="font-size:12px">${l.horaInicio||'—'}</td>
    <td style="font-size:12px">${l.horaFim||'—'}</td>
    <td style="color:#10b981;font-weight:700">${l.hrProd||'—'}</td>
    <td style="font-size:12px;color:#64748b">${l.descricao||'—'}</td>
  </tr>`).join('');
}

// ==========================================
// FILTROS DA TABELA
// ==========================================
function filtrarFicha() {
  const setor   = document.getElementById('fichaFiltroSetor').value;
  const maqDiv  = document.getElementById('fichaFiltroMaqDiv');
  const tipoDiv = document.getElementById('fichaFiltroTipoDiv');
  const areaDiv = document.getElementById('fichaFiltroAreaDiv');
  const injDiv  = document.getElementById('fichaFiltroInjetDiv');

  if (maqDiv)  maqDiv.style.display  = setor==='Usinagem'  ? '' : 'none';
  if (tipoDiv) tipoDiv.style.display = setor==='Bancada'   ? '' : 'none';
  if (areaDiv) areaDiv.style.display = setor==='Projeto'   ? '' : 'none';
  if (injDiv)  injDiv.style.display  = setor==='Produção'  ? '' : 'none';

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
  } else if (setor === 'Produção') {
    const sel = document.getElementById('fichaFiltroInjet');
    if (sel) {
      const injs = [...new Set(_lancsProdFicha.filter(l=>l.injetora).map(l=>l.injetora))];
      sel.innerHTML = '<option value="Todas">Todas as Injetoras</option>' + injs.map(i=>`<option value="${i}">${i}</option>`).join('');
    }
  }

  ['fichaFiltroMaq','fichaFiltroTipo','fichaFiltroArea','fichaFiltroInjet'].forEach(id => {
    const s = document.getElementById(id); if (s) s.selectedIndex = 0;
  });
  aplicarFiltrosFicha();
}

function aplicarFiltrosFicha() {
  const setor = document.getElementById('fichaFiltroSetor').value;
  const maq   = document.getElementById('fichaFiltroMaq')?.value   || 'Todas';
  const tipo  = document.getElementById('fichaFiltroTipo')?.value  || 'Todos';
  const area  = document.getElementById('fichaFiltroArea')?.value  || 'Todas';
  const injet = document.getElementById('fichaFiltroInjet')?.value || 'Todas';

  let lancsFiltrados = _lancsFicha.filter(l => {
    if (setor!=='Todos' && setor!=='Produção' && l.setor!==setor) return false;
    if (setor==='Produção') return false; // Produção vem de outra tabela
    if (setor==='Usinagem' && maq!=='Todas'  && l.maquina!==maq)  return false;
    if (setor==='Bancada'  && tipo!=='Todos' && l.tipo!==tipo)    return false;
    if (setor==='Projeto'  && area!=='Todas' && l.area!==area)    return false;
    return true;
  });

  let prodFiltrados = setor==='Todos' || setor==='Produção'
    ? _lancsProdFicha.filter(l => {
        if (injet!=='Todas' && l.injetora!==injet) return false;
        return true;
      })
    : [];

  const totalMins = [
    ...lancsFiltrados.map(l=>l.minutos||0),
    ...prodFiltrados.map(l=>l.minutos||0)
  ].reduce((a,b)=>a+b,0);

  const totalLancs = lancsFiltrados.length + prodFiltrados.length;

  const elRes = document.getElementById('fichaResumo');
  if (elRes) {
    const temFiltro = setor !== 'Todos';
    elRes.innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span style="font-size:13px;font-weight:600;color:#1e3a5f">${temFiltro?'🔍 Filtro: <b>'+setor+'</b>':'📊 Resultado:'}</span>
      <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">📋 <b>${totalLancs} lançamentos</b></span>
      ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bae6fd;font-size:13px;color:#0369a1">⏱️ <b>${fmtMin(totalMins)}</b></span>`:''}
    </div>`;
    elRes.style.display = 'block';
  }

  renderizarTabelaFicha(lancsFiltrados, prodFiltrados);
}

// ==========================================
// EXPORTAR CSV
// ==========================================
function exportarFichaCSV() {
  if (!_lancsFicha.length && !_lancsProdFicha.length) return toast('Nenhum dado para exportar.', 'erro');
  const job = document.getElementById('fichaJobInput').value;

  const linhas = [['Data','Setor','Técnico','Tipo','Injetora','Início','Fim','Horas','Descrição'].join(';')];

  _lancsFicha.forEach(l => linhas.push([
    l.data, l.setor, l.funcionario, l.tipo||'', '',
    l.horaInicio||'', l.horaFim||'', l.hrProd||'',
    (l.descricao||'').replace(/;/g,',')
  ].join(';')));

  _lancsProdFicha.forEach(l => {
    const tecs = Array.isArray(l.tecnicos) ? l.tecnicos.join(' / ') : (l.tecnicos||'');
    const desc = [l.atividade, l.descricao].filter(Boolean).join(' — ');
    linhas.push([
      l.data, 'Produção', tecs, l.tipo||'', l.injetora||'',
      l.hora_inicio?l.hora_inicio.substring(0,5):'',
      l.hora_fim?l.hora_fim.substring(0,5):'',
      fmtMin(l.minutos||0),
      desc.replace(/;/g,',')
    ].join(';'));
  });

  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `Ficha_${job.replace(/\s/g,'_')}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!', 'sucesso');
}
