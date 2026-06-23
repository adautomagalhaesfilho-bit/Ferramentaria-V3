// ==========================================
// 📊 DASHBOARD.JS — Indicadores V3
// ==========================================

var _dadosDash = null;
var _chartsDash = {};

async function carregarDashboard() {
  const ini = document.getElementById('dashIni').value;
  const fim = document.getElementById('dashFim').value;
  if (!ini || !fim) return;
  const loader = document.getElementById('dashLoader');
  if (loader) loader.style.display = 'flex';
  try {
    _dadosDash = await db.buscarDashboard(ini, fim);
    const abaAtiva = document.querySelector('.dash-panel.ativo');
    const id = abaAtiva?.id || 'dashGeral';
    const aba = id.replace('dash','').toLowerCase();
    renderizarDashAtivo(aba);
  } catch(e) {
    toast('Erro ao carregar dashboard.', 'erro');
    console.error(e);
  }
  if (loader) loader.style.display = 'none';
}

function renderizarDashAtivo(aba) {
  if (!_dadosDash) { carregarDashboard(); return; }
  const ini = document.getElementById('dashIni').value;
  const fim = document.getElementById('dashFim').value;
  if (aba === 'geral')    desenharGeral(ini, fim);
  else if (aba === 'usinagem') desenharSetor('Usinagem', ini, fim);
  else if (aba === 'bancada')  desenharSetor('Bancada', ini, fim);
  else if (aba === 'projeto')  desenharProjeto(ini, fim);
}

// ==========================================
// 🌐 VISÃO GERAL
// ==========================================
function desenharGeral(ini, fim) {
  const div = document.getElementById('dashGeral');
  if (!div || !_dadosDash) return;
  const lancs = _dadosDash.lancamentos || [];
  const porSetor = {};
  lancs.forEach(l => {
    const s = l.setor || 'Outros';
    if (!porSetor[s]) porSetor[s] = { count:0, mins:0, jobs: new Set() };
    porSetor[s].count++; porSetor[s].mins += l.minutos||0;
    if (l.job) porSetor[s].jobs.add(l.job);
  });
  const totalMins = lancs.reduce((a,l) => a+(l.minutos||0), 0);
  const totalJobs = new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;
  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };

  let html = `<div class="cards-row">
    ${metricCard('📋','Total de Lançamentos',lancs.length,'no período','#0056b3')}
    ${metricCard('⏱️','Horas Produtivas',fmtMin(totalMins),'todos os setores','#10b981')}
    ${metricCard('🔩','Jobs Trabalhados',totalJobs,'moldes únicos','#8b5cf6')}
    ${metricCard('🏭','Setores Ativos',Object.keys(porSetor).length,'de 3 disponíveis','#f59e0b')}
  </div>
  <div class="cards-row">`;
  ['Usinagem','Bancada','Projeto'].forEach(s => {
    const d = porSetor[s] || { count:0, mins:0, jobs: new Set() };
    html += `<div class="metric-card" style="border-left-color:${cors[s]}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:36px;height:36px;background:${cors[s]}20;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">${icos[s]}</div>
        <b style="color:#1e3a5f">${s}</b>
      </div>
      <div style="font-size:20px;font-weight:700;color:${cors[s]}">${d.mins>0?fmtMin(d.mins):'—'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${d.count} lançamentos · ${d.jobs.size} jobs</div>
    </div>`;
  });
  html += `</div>
  <div class="grafico-card">
    <div class="grafico-titulo">📅 Horas por Dia — Todos os Setores</div>
    <div class="grafico-wrap" style="height:260px"><canvas id="chartGeralDias"></canvas></div>
  </div>`;
  div.innerHTML = html;

  // Gráfico por dia
  const porDia = {};
  const dAt = new Date(ini+'T12:00:00'), dFim = new Date(fim+'T12:00:00');
  for (let d = new Date(dAt); d <= dFim; d.setDate(d.getDate()+1)) {
    if (d.getDay()!==0 && d.getDay()!==6) porDia[d.toISOString().split('T')[0]] = {U:0,B:0,P:0};
  }
  lancs.forEach(l => {
    if (!porDia[l.data]) return;
    const s = l.setor;
    if (s==='Usinagem') porDia[l.data].U += l.minutos||0;
    else if (s==='Bancada') porDia[l.data].B += l.minutos||0;
    else if (s==='Projeto') porDia[l.data].P += l.minutos||0;
  });
  const dias = Object.keys(porDia).sort();
  const diasFmt = dias.map(d => d.split('-').slice(1).reverse().join('/'));
  setTimeout(() => criarChart('chartGeralDias', {
    type:'bar',
    data:{ labels:diasFmt, datasets:[
      { label:'Usinagem', data:dias.map(d=>Math.round(porDia[d].U/60*10)/10), backgroundColor:'#0056b3', borderRadius:4, stack:'h' },
      { label:'Bancada',  data:dias.map(d=>Math.round(porDia[d].B/60*10)/10), backgroundColor:'#0891b2', borderRadius:4, stack:'h' },
      { label:'Projeto',  data:dias.map(d=>Math.round(porDia[d].P/60*10)/10), backgroundColor:'#8b5cf6', borderRadius:4, stack:'h' },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{position:'bottom'}, datalabels:{display:false} },
      scales:{ x:{stacked:true}, y:{stacked:true, beginAtZero:true, title:{display:true,text:'Horas'}} }
    }
  }), 100);
}

// ==========================================
// ⚙️ 🛠️ SETOR (Usinagem / Bancada)
// ==========================================
function desenharSetor(setor, ini, fim) {
  const divId = setor === 'Usinagem' ? 'dashUsinagem' : 'dashBancada';
  const div = document.getElementById(divId);
  if (!div || !_dadosDash) return;
  const cor = setor === 'Usinagem' ? '#0056b3' : '#0891b2';
  const ico = setor === 'Usinagem' ? '⚙️' : '🛠️';
  const lancs = (_dadosDash.lancamentos||[]).filter(l => l.setor === setor);

  if (!lancs.length) { div.innerHTML = `<div class="empty-state"><div style="font-size:48px">${ico}</div><div>Nenhum lançamento de ${setor} no período.</div></div>`; return; }

  const totalMins = lancs.reduce((a,l)=>a+(l.minutos||0),0);
  const totalJobs = new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;

  // Por operador
  const porOp = {};
  lancs.forEach(l => {
    const f = l.funcionario||'-';
    if (f.toUpperCase().includes('SEM OPERADOR')) return;
    if (!porOp[f]) porOp[f] = 0;
    porOp[f] += l.minutos||0;
  });
  const opEntries = Object.entries(porOp).map(([nome,mins]) => {
    const meta = calcularMeta(ini, fim, nome, _dadosDash);
    const pct  = meta > 0 ? Math.round(mins/meta*100) : 0;
    return { nome, mins, meta, pct };
  }).sort((a,b) => b.pct-a.pct);
  const totalMeta = opEntries.reduce((a,o)=>a+o.meta,0);
  const pctEquipe = totalMeta > 0 ? Math.round(totalMins/totalMeta*100) : 0;

  // Por máquina (Usinagem)
  const porMaq = {};
  if (setor === 'Usinagem') {
    lancs.forEach(l => { if (!l.maquina||l.maquina==='Sem Máquina') return; if (!porMaq[l.maquina]) porMaq[l.maquina]=0; porMaq[l.maquina]+=l.minutos||0; });
  }

  // Dias úteis
  let diasUteis = 0;
  for (let d = new Date(ini+'T12:00:00'); d <= new Date(fim+'T12:00:00'); d.setDate(d.getDate()+1)) {
    const ds = d.toISOString().split('T')[0];
    if (d.getDay()!==0 && d.getDay()!==6 && !(_dadosDash.feriados||[]).includes(ds)) diasUteis++;
  }
  const capMaqDia = 508;
  const capTotal  = capMaqDia * diasUteis;
  const numMaq    = Object.keys(porMaq).length;
  const totalMaqMins = Object.values(porMaq).reduce((a,b)=>a+b,0);
  const pctMaq = numMaq > 0 && capTotal > 0 ? Math.round(totalMaqMins/(capTotal*numMaq)*100) : 0;

  // Top jobs
  const porJob = {};
  lancs.forEach(l => { if (!l.job) return; if (!porJob[l.job]) porJob[l.job]=0; porJob[l.job]+=l.minutos||0; });
  const topJobs = Object.entries(porJob).sort((a,b)=>b[1]-a[1]).slice(0,10);

  // Tipos
  const porTipo = {};
  lancs.forEach(l => { const t=l.tipo||'Outros'; if (!porTipo[t]) porTipo[t]=0; porTipo[t]+=l.minutos||0; });

  const badgePct = (pct) => {
    const cor2 = pct>=90?'#059669':pct>=70?'#92400e':'#b91c1c';
    const bg   = pct>=90?'#d1fae5':pct>=70?'#fef3c7':'#fee2e2';
    const txt  = pct>=90?'✅ Meta':pct>=70?'⚠️ OK':'🔴 Baixo';
    return `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${bg};color:${cor2}">${txt}</span>`;
  };

  const chartSufixo = setor === 'Usinagem' ? 'U' : 'B';
  const paleta = [cor,'#10b981','#8b5cf6','#f59e0b','#ef4444','#0ea5e9','#ec4899','#14b8a6'];

  let html = `<div class="cards-row">
    ${metricCard('⏱️','Horas Produtivas',fmtMin(totalMins),'total da equipe',cor)}
    ${metricCard('🔩','Jobs Trabalhados',totalJobs,'moldes únicos','#10b981')}
    ${metricCard('👥','Ocupação da Equipe',pctEquipe+'%','vs meta do período',pctEquipe>=90?'#10b981':pctEquipe>=70?'#f59e0b':'#ef4444',badgePct(pctEquipe))}
    ${setor==='Usinagem'?metricCard('⚙️','Ocupação Máquinas',pctMaq+'%','média das máquinas',pctMaq>=80?'#10b981':pctMaq>=50?cor:'#f59e0b',`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#dbeafe;color:#1d4ed8">${numMaq} máquinas</span>`):''}
    ${metricCard('📋','Lançamentos',lancs.length,'no período','#8b5cf6')}
  </div>`;

  // Desempenho operadores
  html += `<div class="card"><div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:20px;">👤 Desempenho Individual</div>`;
  opEntries.forEach(op => {
    const corOp = op.pct>=100?'#10b981':op.pct>=70?cor:'#ef4444';
    const badgeOp = op.pct>=100?`<span style="background:#d1fae5;color:#059669;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">✅ Meta</span>`:
      op.pct>=70?`<span style="background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">📈 OK</span>`:
      `<span style="background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">⚠️ Baixo</span>`;
    html += `<div class="barra-wrap">
      <div class="barra-header">
        <div class="barra-nome">${op.nome} ${badgeOp}</div>
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:12px;color:#64748b">${fmtMin(op.mins)}</span>
          <span class="barra-valor" style="color:${corOp}">${op.pct}%</span>
        </div>
      </div>
      <div class="barra-track"><div class="barra-fill" style="width:${Math.min(op.pct,100)}%;background:${corOp}"></div></div>
    </div>`;
  });
  html += '</div>';

  // Máquinas (Usinagem)
  if (setor === 'Usinagem' && Object.keys(porMaq).length > 0) {
    html += `<div class="card"><div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:20px;">🤖 Ocupação das Máquinas</div>`;
    Object.entries(porMaq).sort((a,b)=>b[1]-a[1]).forEach(([maq,mins]) => {
      const pct = capTotal>0?Math.round(mins/capTotal*100):0;
      const corM = pct>=80?'#10b981':pct>=50?cor:'#f59e0b';
      html += `<div class="barra-wrap">
        <div class="barra-header">
          <div class="barra-nome">${maq}</div>
          <div style="display:flex;gap:12px;align-items:center">
            <span style="font-size:12px;color:#64748b">${fmtMin(mins)}</span>
            <span class="barra-valor" style="color:${corM}">${pct}%</span>
          </div>
        </div>
        <div class="barra-track"><div class="barra-fill" style="width:${Math.min(pct,100)}%;background:${corM}"></div></div>
      </div>`;
    });
    html += '</div>';
  }

  // Gráficos
  html += `<div class="graficos-2col">
    <div class="grafico-card" style="flex:2;min-width:300px">
      <div class="grafico-titulo">🔩 Top 10 Jobs — Horas Investidas</div>
      <div class="grafico-wrap" style="height:320px"><canvas id="chart${chartSufixo}Jobs"></canvas></div>
    </div>
    <div class="grafico-card" style="flex:1;min-width:240px">
      <div class="grafico-titulo">${setor==='Usinagem'?'🗂️ Tipos de Serviço':'🗂️ Categoria Mestra'}</div>
      <div class="grafico-wrap" style="height:320px"><canvas id="chart${chartSufixo}Tipos"></canvas></div>
    </div>
  </div>`;

  div.innerHTML = html;

  setTimeout(() => {
    criarChart('chart' + chartSufixo + 'Jobs', { type:'bar',
      data:{ labels:topJobs.map(e=>e[0]), datasets:[{ data:topJobs.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        onClick:(evt,els)=>{ if(els.length) abrirFichaMolde(topJobs[els[0].index][0]); },
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'},
          tooltip:{callbacks:{title:()=>'Clique para ver a Ficha'}} },
        scales:{ x:{beginAtZero:true,title:{display:true,text:'Horas'}} }
      }
    });
    const tipoEnt = Object.entries(porTipo).sort((a,b)=>b[1]-a[1]);
    criarChart('chart' + chartSufixo + 'Tipos', { type:'doughnut',
      data:{ labels:tipoEnt.map(e=>e[0]), datasets:[{ data:tipoEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}},
          datalabels:{color:'#fff',font:{weight:'bold',size:12},formatter:(v,ctx)=>{ const t=ctx.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }} }
      }
    });
  }, 100);
}

// ==========================================
// 📐 PROJETO
// ==========================================
function desenharProjeto(ini, fim) {
  const div = document.getElementById('dashProjeto');
  if (!div || !_dadosDash) return;
  const lancs = (_dadosDash.lancamentos||[]).filter(l => l.setor === 'Projeto');
  if (!lancs.length) { div.innerHTML = '<div class="empty-state"><div style="font-size:48px">📐</div><div>Nenhum lançamento de Projeto no período.</div></div>'; return; }

  const totalLanc = lancs.length;
  const totalJobs = new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;
  const totalFin  = lancs.filter(l=>l.status==='Finalizado').length;
  const porFunc   = {};
  lancs.forEach(l => { const f=l.funcionario||'-'; if (!porFunc[f]) porFunc[f]=0; porFunc[f]++; });
  const funcEnt = Object.entries(porFunc).sort((a,b)=>b[1]-a[1]);
  const porArea = {};
  lancs.forEach(l => { const a=l.area||'Sem Área'; if (!porArea[a]) porArea[a]=0; porArea[a]++; });
  const porJob = {};
  lancs.forEach(l => { if (!l.job) return; if (!porJob[l.job]) porJob[l.job]=0; porJob[l.job]++; });
  const topJobs = Object.entries(porJob).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const paleta = ['#8b5cf6','#10b981','#0ea5e9','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6'];

  let html = `<div class="cards-row">
    ${metricCard('📋','Total de Lançamentos',totalLanc,'no período','#8b5cf6')}
    ${metricCard('🔩','Jobs Envolvidos',totalJobs,'moldes únicos','#10b981')}
    ${metricCard('👤','Funcionários Ativos',Object.keys(porFunc).length,'no período','#0ea5e9')}
    ${metricCard('🟢','Finalizados',totalFin+' / '+totalLanc,'lançamentos','#f59e0b')}
  </div>
  <div class="card"><div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:20px;">👤 Lançamentos por Funcionário</div>`;
  funcEnt.forEach(([nome,qtd]) => {
    const pct = totalLanc>0?Math.round(qtd/totalLanc*100):0;
    html += `<div class="barra-wrap">
      <div class="barra-header"><div class="barra-nome">${nome}</div>
        <div style="display:flex;gap:12px;align-items:center"><span style="font-size:12px;color:#64748b">${qtd} lançamentos</span><span class="barra-valor" style="color:#8b5cf6">${pct}%</span></div>
      </div>
      <div class="barra-track"><div class="barra-fill" style="width:${Math.min(pct,100)}%;background:#8b5cf6"></div></div>
    </div>`;
  });
  html += `</div><div class="graficos-2col">
    <div class="grafico-card" style="flex:2;min-width:300px">
      <div class="grafico-titulo">🔩 Top 10 Jobs</div>
      <div class="grafico-wrap" style="height:320px"><canvas id="chartPJobs"></canvas></div>
    </div>
    <div class="grafico-card" style="flex:1;min-width:240px">
      <div class="grafico-titulo">📍 Por Área</div>
      <div class="grafico-wrap" style="height:320px"><canvas id="chartPAreas"></canvas></div>
    </div>
  </div>`;
  div.innerHTML = html;

  setTimeout(() => {
    criarChart('chartPJobs', { type:'bar', data:{ labels:topJobs.map(e=>e[0]), datasets:[{ data:topJobs.map(e=>e[1]), backgroundColor:paleta, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        onClick:(evt,els)=>{ if(els.length) abrirFichaMolde(topJobs[els[0].index][0]); },
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'}},
          tooltip:{callbacks:{title:()=>'Clique para ver a Ficha'}} },
        scales:{ x:{beginAtZero:true, ticks:{stepSize:1}} }
      }
    });
    const areaEnt = Object.entries(porArea).sort((a,b)=>b[1]-a[1]);
    criarChart('chartPAreas', { type:'doughnut', data:{ labels:areaEnt.map(e=>e[0]), datasets:[{ data:areaEnt.map(e=>e[1]), backgroundColor:paleta, borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}},
          datalabels:{color:'#fff',font:{weight:'bold',size:12},formatter:(v,ctx)=>{ const t=ctx.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }} }
      }
    });
  }, 100);
}

// ==========================================
// 🛠️ HELPERS
// ==========================================
function metricCard(ico, titulo, valor, sub, cor, extra) {
  return `<div class="metric-card" style="border-left-color:${cor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="metric-icon">${ico}</div>${extra?`<div>${extra}</div>`:''}
    </div>
    <div class="metric-valor" style="color:${cor}">${valor}</div>
    <div class="metric-label">${titulo}</div>
    <div class="metric-sub">${sub}</div>
  </div>`;
}

function criarChart(id, config) {
  const ctx = document.getElementById(id); if (!ctx) return;
  if (_chartsDash[id]) _chartsDash[id].destroy();
  _chartsDash[id] = new Chart(ctx, config);
}

function calcularMeta(ini, fim, nome, dados) {
  const funcRH = (dados.funcionarios||[]).find(f => f.nome === nome);
  const turno  = funcRH?.turno || 'ADM';
  const adm    = funcRH?.admissao || '1900-01-01';
  const dem    = funcRH?.demissao || '2099-12-31';
  const feriados = dados.feriados || [];
  const ferias = (dados.ferias||[]).filter(f => f.funcionario === nome);
  const marco  = new Date('2026-02-09T12:00:00');
  let mins = 0;
  for (let d = new Date(ini+'T12:00:00'); d <= new Date(fim+'T12:00:00'); d.setDate(d.getDate()+1)) {
    const ds = d.toISOString().split('T')[0];
    if (ds < adm || ds > dem) continue;
    const deFerias = ferias.some(f => ds >= f.inicio && ds <= f.fim && f.motivo === 'Férias');
    if (deFerias) continue;
    if (turno === 'Turma A' || turno === 'Turma B') {
      const diff  = d.getTime() - marco.getTime();
      const cycle = ((Math.floor(diff/86400000) % 4) + 4) % 4;
      const trab  = (turno==='Turma A' && (cycle===0||cycle===1)) || (turno==='Turma B' && (cycle===2||cycle===3));
      if (trab) mins += 660;
    } else {
      if (d.getDay()!==0 && d.getDay()!==6 && !feriados.includes(ds)) mins += 510;
    }
  }
  return mins;
}
