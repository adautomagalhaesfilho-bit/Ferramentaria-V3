// ==========================================
// 📊 DASHBOARD.JS — V3 com Turnos Reais
// ==========================================

var _dadosDash = null;
var _chartsDash = {};

// ==========================================
// 🔄 RODÍZIO 2x2
// ==========================================
const RODIZIO_START = new Date('2026-02-17T12:00:00');
function turmaEmDia(data) {
  const d = new Date(data + 'T12:00:00');
  const diff = Math.floor((d - RODIZIO_START) / 86400000);
  const cycle = ((diff % 4) + 4) % 4;
  return (cycle === 0 || cycle === 1) ? 'Turma A' : 'Turma B';
}

function funcTrabalhaEmDia(turno, dataStr, feriados) {
  const d = new Date(dataStr + 'T12:00:00');
  const diaSem = d.getDay();
  const isFeriado = (feriados || []).includes(dataStr);
  if (turno === '5x2')    return diaSem !== 0 && diaSem !== 6 && !isFeriado;
  if (turno === '6x1')    return diaSem !== 0 && !isFeriado;
  if (turno === 'Turma A' || turno === 'Turma B') return turmaEmDia(dataStr) === turno;
  if (turno === 'Estágio') return diaSem !== 0 && diaSem !== 6 && !isFeriado;
  return diaSem !== 0 && diaSem !== 6 && !isFeriado;
}

function capMinutosPorTurno(turno) {
  if (turno === '5x2')    return 528;
  if (turno === 'Turma A' || turno === 'Turma B') return 660;
  if (turno === '6x1')    return 440;
  if (turno === 'Estágio') return 440;
  return 528;
}

// Supervisores/Encarregados são excluídos dos cálculos de ocupação/produtividade
// (aparecem nas listas de técnico para lançamento, mas não contam na meta da equipe)
function isSupervisor(nome, dados) {
  const funcRH = (dados.funcionarios || []).find(f => f.nome === nome);
  if (!funcRH) return false;
  return funcRH.setor === 'Supervisão' || funcRH.cargo === 'Supervisor' || funcRH.cargo === 'Encarregado';
}

// ==========================================
// 🕐 CALCULAR META
// ==========================================
function calcularMeta(ini, fim, nome, dados) {
  const funcRH  = (dados.funcionarios || []).find(f => f.nome === nome);
  const turno   = funcRH?.turno || '5x2';
  const adm     = funcRH?.admissao || '1900-01-01';
  const dem     = funcRH?.demissao || '2099-12-31';
  const feriados = dados.feriados || [];
  const ferias   = (dados.ferias || []).filter(f => f.funcionario === nome);
  const parciais = (dados.parciais || []).filter(p => p.funcionario === nome);
  const capMin   = capMinutosPorTurno(turno);
  let mins = 0;
  for (let d = new Date(ini + 'T12:00:00'); d <= new Date(fim + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split('T')[0];
    if (ds < adm || ds > dem) continue;
    const deFerias = ferias.some(f => ds >= f.inicio && ds <= f.fim && f.motivo === 'Férias');
    if (deFerias) continue;
    if (!funcTrabalhaEmDia(turno, ds, feriados)) continue;
    let minsDia = capMin;
    parciais.filter(p => p.data === ds).forEach(p => {
      if (p.inicio && p.fim) {
        const toMin = h => { const [hh,mm] = h.split(':'); return parseInt(hh)*60+parseInt(mm); };
        minsDia -= Math.max(0, toMin(p.fim) - toMin(p.inicio));
      }
    });
    mins += Math.max(0, minsDia);
  }
  return mins;
}

function calcularCapBancada(ini, fim, dados) {
  const feriados = dados.feriados || [];
  const funcsBancada = (dados.funcionarios || []).filter(f => f.setor === 'Bancada' && f.ativo !== false);
  let totalCap = 0;
  for (let d = new Date(ini + 'T12:00:00'); d <= new Date(fim + 'T12:00:00'); d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split('T')[0];
    funcsBancada.forEach(f => {
      const adm = f.admissao || '1900-01-01';
      const dem = f.demissao || '2099-12-31';
      if (ds < adm || ds > dem) return;
      const ferias = (dados.ferias || []).filter(fe => fe.funcionario === f.nome);
      const deFerias = ferias.some(fe => ds >= fe.inicio && ds <= fe.fim && fe.motivo === 'Férias');
      if (deFerias) return;
      if (funcTrabalhaEmDia(f.turno || '5x2', ds, feriados)) totalCap += capMinutosPorTurno(f.turno || '5x2');
    });
  }
  return totalCap;
}

async function carregarDashboard() {
  const ini = document.getElementById('dashIni')?.value;
  const fim = document.getElementById('dashFim')?.value;
  if (!ini || !fim) return;
  if (typeof carregarAlertaPendencias === 'function') carregarAlertaPendencias();
  const loader = document.getElementById('dashLoader');
  if (loader) loader.style.display = 'flex';
  try {
    _dadosDash = await db.buscarDashboard(ini, fim);
    const abaAtiva = document.querySelector('.dash-panel.ativo');
    const id = abaAtiva?.id || 'dashGeral';
    const aba = id.replace('dash','').toLowerCase();
    renderizarDashAtivo(aba);
  } catch(e) { toast('Erro ao carregar dashboard.','erro'); console.error(e); }
  if (loader) loader.style.display = 'none';
}

function renderizarDashAtivo(aba) {
  if (!_dadosDash) { carregarDashboard(); return; }
  const ini = document.getElementById('dashIni')?.value;
  const fim = document.getElementById('dashFim')?.value;
  if (aba==='geral')         desenharGeral(ini, fim);
  else if (aba==='usinagem') desenharSetor('Usinagem', ini, fim);
  else if (aba==='bancada')  desenharSetor('Bancada', ini, fim);
  else if (aba==='projeto')  desenharProjeto(ini, fim);
  else if (aba==='producao') desenharProducao(ini, fim);
}

// ==========================================
// 🌐 VISÃO GERAL
// ==========================================
function desenharGeral(ini, fim) {
  const div = document.getElementById('dashGeral');
  if (!div || !_dadosDash) return;
  const lancs = _dadosDash.lancamentos || [];
  const prod  = _dadosDash.prodLancamentos || [];
  const porSetor = {};
  lancs.forEach(l => {
    const s = l.setor||'Outros';
    if (!porSetor[s]) porSetor[s] = { count:0, mins:0, jobs:new Set() };
    porSetor[s].count++; porSetor[s].mins += l.minutos||0;
    if (l.job) porSetor[s].jobs.add(l.job);
  });
  const totalMins   = lancs.reduce((a,l)=>a+(l.minutos||0),0);
  const totalJobs   = new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;
  const totalProd   = prod.length;
  const prodParadas = prod.filter(p=>p.maquina_parada).length;
  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };

  const porMolde = {};
  lancs.filter(l=>l.job).forEach(l => { if(!porMolde[l.job]) porMolde[l.job]=0; porMolde[l.job]+=(l.minutos||0); });
  const topMoldes = Object.entries(porMolde).sort((a,b)=>b[1]-a[1]).slice(0,10);

  let html = `<div class="cards-row">
    ${metricCard('📋','Total de Lançamentos',lancs.length,'no período','#0056b3')}
    ${metricCard('⏱️','Horas Produtivas',fmtMin(totalMins),'todos os setores','#10b981')}
    ${metricCard('🔩','Jobs Trabalhados',totalJobs,'moldes únicos','#8b5cf6')}
    ${metricCard('🏭','Manutenções',totalProd,'Produção/Setup','#f59e0b',prodParadas?`<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700">${prodParadas} paradas</span>`:'')}
  </div><div class="cards-row">`;

  ['Usinagem','Bancada','Projeto'].forEach(s => {
    const d = porSetor[s] || { count:0, mins:0, jobs:new Set() };
    html += `<div class="metric-card" style="border-left-color:${cors[s]}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:36px;height:36px;background:${cors[s]}20;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px">${icos[s]}</div>
        <b style="color:#1e3a5f">${s}</b>
      </div>
      <div style="font-size:20px;font-weight:700;color:${cors[s]}">${d.mins>0?fmtMin(d.mins):'—'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${d.count} lançamentos · ${d.jobs.size} jobs</div>
    </div>`;
  });
  html += `</div>`;

  if (topMoldes.length > 0) {
    html += `<div class="grafico-card"><div class="grafico-titulo">🔩 Moldes Mais Trabalhados — Todos os Setores</div><div style="height:320px"><canvas id="chartGeralMoldes"></canvas></div></div>`;
  }
  html += `<div class="grafico-card"><div class="grafico-titulo">📅 Horas por Dia — Todos os Setores</div><div style="height:260px"><canvas id="chartGeralDias"></canvas></div></div>`;
  div.innerHTML = html;

  const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#84cc16'];
  const feriados = _dadosDash.feriados || [];
  setTimeout(() => {
    if (topMoldes.length > 0) {
      criarChart('chartGeralMoldes', { type:'bar',
        data:{ labels:topMoldes.map(e=>e[0]), datasets:[{ data:topMoldes.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderRadius:6 }] },
        options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
          onClick:(evt,els)=>{ if(els.length) abrirFichaMolde(topMoldes[els[0].index][0]); },
          plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'},
            tooltip:{callbacks:{title:()=>'Clique para ver a Ficha'}} },
          scales:{ x:{beginAtZero:true,title:{display:true,text:'Horas'}} }
        }
      });
    }
    const porDia = {};
    for(let d=new Date(ini+'T12:00:00');d<=new Date(fim+'T12:00:00');d.setDate(d.getDate()+1)) {
      const ds=d.toISOString().split('T')[0];
      if(d.getDay()!==0&&!feriados.includes(ds)) porDia[ds]={U:0,B:0,P:0};
    }
    lancs.forEach(l => {
      if(!porDia[l.data]) return;
      if(l.setor==='Usinagem') porDia[l.data].U+=l.minutos||0;
      else if(l.setor==='Bancada') porDia[l.data].B+=l.minutos||0;
      else if(l.setor==='Projeto') porDia[l.data].P+=l.minutos||0;
    });
    const dias=Object.keys(porDia).sort();
    const diasFmt=dias.map(d=>d.split('-').slice(1).reverse().join('/'));
    criarChart('chartGeralDias',{ type:'bar',
      data:{ labels:diasFmt, datasets:[
        { label:'Usinagem', data:dias.map(d=>Math.round(porDia[d].U/60*10)/10), backgroundColor:'#0056b3', borderRadius:4, stack:'h' },
        { label:'Bancada',  data:dias.map(d=>Math.round(porDia[d].B/60*10)/10), backgroundColor:'#0891b2', borderRadius:4, stack:'h' },
        { label:'Projeto',  data:dias.map(d=>Math.round(porDia[d].P/60*10)/10), backgroundColor:'#8b5cf6', borderRadius:4, stack:'h' },
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom'}, datalabels:{display:false} },
        scales:{ x:{stacked:true}, y:{stacked:true,beginAtZero:true,title:{display:true,text:'Horas'}} }
      }
    });
  }, 100);
}

// ==========================================
// ⚙️ 🛠️ SETOR
// ==========================================
function desenharSetor(setor, ini, fim) {
  const divId = setor==='Usinagem'?'dashUsinagem':'dashBancada';
  const div   = document.getElementById(divId);
  if (!div || !_dadosDash) return;
  const cor   = setor==='Usinagem'?'#0056b3':'#0891b2';
  const lancs = (_dadosDash.lancamentos||[]).filter(l=>l.setor===setor);
  if (!lancs.length) { div.innerHTML=`<div class="empty-state"><div style="font-size:48px">${setor==='Usinagem'?'⚙️':'🛠️'}</div><div>Nenhum lançamento de ${setor} no período.</div></div>`; return; }

  const feriados  = _dadosDash.feriados || [];
  const totalMins = lancs.reduce((a,l)=>a+(l.minutos||0),0);
  const totalJobs = new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;

  // Exclui supervisores das horas produtivas do setor (têm função administrativa)
  const lancsSemSupervisor = lancs.filter(l => !isSupervisor(l.funcionario, _dadosDash));
  const totalMinsSemSup = lancsSemSupervisor.reduce((a,l)=>a+(l.minutos||0),0);

  const horasExtras = lancsSemSupervisor.filter(l => {
    const funcRH = (_dadosDash.funcionarios||[]).find(f=>f.nome===l.funcionario);
    const turno  = funcRH?.turno || '5x2';
    return !funcTrabalhaEmDia(turno, l.data, feriados);
  }).reduce((a,l)=>a+(l.minutos||0),0);

  const porOp = {};
  lancsSemSupervisor.forEach(l => {
    const f=l.funcionario||'—';
    if(f.toUpperCase().includes('SEM OPERADOR')) return;
    if(!porOp[f]) porOp[f]=0; porOp[f]+=l.minutos||0;
  });
  const opEntries = Object.entries(porOp).map(([nome,mins]) => {
    const meta = calcularMeta(ini, fim, nome, _dadosDash);
    const pct  = meta>0?Math.round(mins/meta*100):0;
    return { nome, mins, meta, pct };
  }).sort((a,b)=>b.pct-a.pct);
  const totalMeta = opEntries.reduce((a,o)=>a+o.meta,0);
  const pctEquipe = totalMeta>0?Math.round(totalMinsSemSup/totalMeta*100):0;

  const porMaq = {};
  if(setor==='Usinagem') lancs.forEach(l=>{ if(!l.maquina||l.maquina==='Sem Máquina') return; if(!porMaq[l.maquina]) porMaq[l.maquina]=0; porMaq[l.maquina]+=l.minutos||0; });

  let diasUteis = 0;
  for(let d=new Date(ini+'T12:00:00');d<=new Date(fim+'T12:00:00');d.setDate(d.getDate()+1)) {
    const ds=d.toISOString().split('T')[0];
    if(d.getDay()!==0&&d.getDay()!==6&&!feriados.includes(ds)) diasUteis++;
  }
  const capTotal  = 528 * diasUteis;
  const numMaq    = Object.keys(porMaq).length;
  const capBancada = setor==='Bancada' ? calcularCapBancada(ini, fim, _dadosDash) : 0;
  const pctBancada = capBancada>0?Math.round(totalMinsSemSup/capBancada*100):0;

  const porJob={};
  lancs.forEach(l=>{ if(!l.job) return; if(!porJob[l.job]) porJob[l.job]=0; porJob[l.job]+=l.minutos||0; });
  const topJobs=Object.entries(porJob).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const porTipo={};
  lancs.forEach(l=>{ const t=l.tipo||'Outros'; if(!porTipo[t]) porTipo[t]=0; porTipo[t]+=l.minutos||0; });

  const badgePct = pct => {
    const c=pct>=90?'#059669':pct>=70?'#92400e':'#b91c1c';
    const bg=pct>=90?'#d1fae5':pct>=70?'#fef3c7':'#fee2e2';
    const t=pct>=90?'✅ Meta':pct>=70?'⚠️ OK':'🔴 Baixo';
    return `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${bg};color:${c}">${t}</span>`;
  };

  const sx=setor==='Usinagem'?'U':'B';
  const paleta=['#0056b3','#10b981','#8b5cf6','#f59e0b','#ef4444','#0ea5e9','#ec4899','#14b8a6'];

  let html=`<div class="cards-row">
    ${metricCard('⏱️','Horas Produtivas',fmtMin(totalMinsSemSup),'total da equipe (sem supervisão)',cor)}
    ${metricCard('🔩','Jobs Trabalhados',totalJobs,'moldes únicos','#10b981')}
    ${metricCard('👥','Ocupação da Equipe',pctEquipe+'%','vs meta do período',pctEquipe>=90?'#10b981':pctEquipe>=70?'#f59e0b':'#ef4444',badgePct(pctEquipe))}
    ${setor==='Usinagem'
      ? metricCard('⚙️','Ocupação Máquinas',numMaq>0?Math.round(Object.values(porMaq).reduce((a,b)=>a+b,0)/(capTotal*numMaq)*100)+'%':'—','média das máquinas','#0056b3',`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#dbeafe;color:#1d4ed8">${numMaq} máquinas</span>`)
      : metricCard('🛠️','Ocupação Bancada',pctBancada+'%','vs capacidade real',pctBancada>=90?'#10b981':pctBancada>=70?'#f59e0b':'#ef4444',badgePct(pctBancada))
    }
    ${metricCard('📋','Lançamentos',lancs.length,'no período','#8b5cf6')}
    ${horasExtras>0?metricCard('⏰','Horas Extras',fmtMin(horasExtras),'fora do expediente','#f59e0b'):''}
  </div>`;

  // Guarda estado para os filtros de seleção
  _dashEstado = { opEntries, porMaq, cor, capTotal, funcionarios: _dadosDash.funcionarios||[] };

  const opOrdenados = [...opEntries].sort((a,b)=>a.nome.localeCompare(b.nome));
  html+=`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">👤 Desempenho Individual</div>
      <select id="selFiltroPessoaOcup" onchange="filtrarOcupacaoPessoa()" style="width:auto;font-size:12px">
        <option value="Todos">Todos os Técnicos</option>
        ${opOrdenados.map(o=>`<option value="${o.nome}">${o.nome}</option>`).join('')}
      </select>
    </div>
    <div id="listaOcupacaoPessoas">${_renderBarrasPessoas(opEntries)}</div>
  </div>`;

  if(setor==='Usinagem'&&numMaq>0){
    const maqOrdenadas = Object.keys(porMaq).sort();
    html+=`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <div style="font-weight:700;color:#1e3a5f;font-size:15px">🤖 Ocupação das Máquinas</div>
        <select id="selFiltroMaquina" onchange="filtrarOcupacaoMaquina()" style="width:auto;font-size:12px">
          <option value="Todas">Todas as Máquinas</option>
          ${maqOrdenadas.map(m=>`<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
      <div id="listaOcupacaoMaquinas">${_renderBarrasMaquinas(porMaq)}</div>
    </div>`;
  }

  html+=`<div class="graficos-2col">
    <div class="grafico-card" style="flex:2;min-width:300px"><div class="grafico-titulo">🔩 Top 10 Jobs</div><div style="height:320px"><canvas id="chart${sx}Jobs"></canvas></div></div>
    <div class="grafico-card" style="flex:1;min-width:240px"><div class="grafico-titulo">🗂️ Tipos</div><div style="height:320px"><canvas id="chart${sx}Tipos"></canvas></div></div>
  </div>`;

  div.innerHTML=html;
  setTimeout(()=>{
    criarChart('chart'+sx+'Jobs',{ type:'bar',
      data:{ labels:topJobs.map(e=>e[0]), datasets:[{ data:topJobs.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        onClick:(evt,els)=>{ if(els.length) abrirFichaMolde(topJobs[els[0].index][0]); },
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'},
          tooltip:{callbacks:{title:()=>'Clique para ver a Ficha'}} },
        scales:{ x:{beginAtZero:true} }
      }
    });
    const tipoEnt=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]);
    criarChart('chart'+sx+'Tipos',{ type:'doughnut',
      data:{ labels:tipoEnt.map(e=>e[0]), datasets:[{ data:tipoEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}},
          datalabels:{color:'#fff',font:{weight:'bold',size:12},formatter:(v,ctx)=>{ const t=ctx.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }} }
      }
    });
  },100);
}

// ==========================================
// 📐 PROJETO
// ==========================================
function desenharProjeto(ini,fim){
  const div=document.getElementById('dashProjeto');
  if(!div||!_dadosDash) return;
  const lancs=(_dadosDash.lancamentos||[]).filter(l=>l.setor==='Projeto');
  if(!lancs.length){div.innerHTML='<div class="empty-state"><div style="font-size:48px">📐</div><div>Nenhum lançamento de Projeto no período.</div></div>';return;}
  const totalLanc=lancs.length;
  const totalJobs=new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;
  const totalFin=lancs.filter(l=>l.status==='Finalizado').length;
  const porFunc={};
  lancs.forEach(l=>{const f=l.funcionario||'—';if(!porFunc[f])porFunc[f]=0;porFunc[f]++;});
  const funcEnt=Object.entries(porFunc).sort((a,b)=>b[1]-a[1]);
  const porArea={};
  lancs.forEach(l=>{const a=l.area||'Sem Área';if(!porArea[a])porArea[a]=0;porArea[a]++;});
  const porJob={};
  lancs.forEach(l=>{if(!l.job) return;if(!porJob[l.job])porJob[l.job]=0;porJob[l.job]++;});
  const topJobs=Object.entries(porJob).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const paleta=['#8b5cf6','#10b981','#0ea5e9','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6'];

  let html=`<div class="cards-row">
    ${metricCard('📋','Total de Lançamentos',totalLanc,'no período','#8b5cf6')}
    ${metricCard('🔩','Jobs Envolvidos',totalJobs,'moldes únicos','#10b981')}
    ${metricCard('👤','Funcionários Ativos',Object.keys(porFunc).length,'no período','#0ea5e9')}
    ${metricCard('🟢','Finalizados',totalFin+' / '+totalLanc,'lançamentos','#f59e0b')}
  </div><div class="card"><div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:20px">👤 Lançamentos por Funcionário</div>`;
  funcEnt.forEach(([nome,qtd])=>{
    const pct=totalLanc>0?Math.round(qtd/totalLanc*100):0;
    html+=`<div class="barra-wrap"><div class="barra-header"><div class="barra-nome">${nome}</div>
      <div style="display:flex;gap:12px;align-items:center"><span style="font-size:12px;color:#64748b">${qtd} lançamentos</span><span class="barra-valor" style="color:#8b5cf6">${pct}%</span></div>
    </div><div class="barra-track"><div class="barra-fill" style="width:${Math.min(pct,100)}%;background:#8b5cf6"></div></div></div>`;
  });
  html+=`</div><div class="graficos-2col">
    <div class="grafico-card" style="flex:2;min-width:300px"><div class="grafico-titulo">🔩 Top 10 Jobs</div><div style="height:320px"><canvas id="chartPJobs"></canvas></div></div>
    <div class="grafico-card" style="flex:1;min-width:240px"><div class="grafico-titulo">📍 Por Área</div><div style="height:320px"><canvas id="chartPAreas"></canvas></div></div>
  </div>`;
  div.innerHTML=html;
  setTimeout(()=>{
    criarChart('chartPJobs',{type:'bar',data:{labels:topJobs.map(e=>e[0]),datasets:[{data:topJobs.map(e=>e[1]),backgroundColor:paleta,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',onClick:(evt,els)=>{if(els.length)abrirFichaMolde(topJobs[els[0].index][0]);},plugins:{legend:{display:false},datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'}},tooltip:{callbacks:{title:()=>'Clique para ver a Ficha'}}},scales:{x:{beginAtZero:true,ticks:{stepSize:1}}}}});
    const areaEnt=Object.entries(porArea).sort((a,b)=>b[1]-a[1]);
    criarChart('chartPAreas',{type:'doughnut',data:{labels:areaEnt.map(e=>e[0]),datasets:[{data:areaEnt.map(e=>e[1]),backgroundColor:paleta,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}},datalabels:{color:'#fff',font:{weight:'bold',size:12},formatter:(v,ctx)=>{const t=ctx.dataset.data.reduce((a,b)=>a+b,0);return t>0?Math.round(v/t*100)+'%':'';}}}}}); 
  },100);
}

// ==========================================
// 🏭 PRODUÇÃO
// ==========================================
function desenharProducao(ini,fim){
  const div=document.getElementById('dashProducao');
  if(!div||!_dadosDash) return;

  const _render = prod => {
    if(!prod||!prod.length){div.innerHTML='<div class="empty-state"><div style="font-size:48px">🏭</div><div>Nenhum lançamento de Produção no período.</div></div>';return;}

    const total=prod.length;
    const hoje=new Date().toISOString().split('T')[0];
    const totalHoje=prod.filter(p=>p.data===hoje).length;
    const minsTotal=prod.reduce((a,p)=>a+(p.minutos||0),0);
    const minsMedio=total>0?Math.round(minsTotal/total):0;
    const naoPlaj=prod.filter(p=>p.maquina_parada).length;

    // MTTR — aceita ambos os nomes de tipo
    const corretivas=prod.filter(p=>(p.tipo==='Corretiva'||p.tipo==='Manutenção Corretiva')&&p.minutos>0);
    const mttr=corretivas.length>0?Math.round(corretivas.reduce((a,p)=>a+(p.minutos||0),0)/corretivas.length):0;

    // Cores por tipo — aceita ambos os nomes
    const coresTipo={
      'Setup':'#0056b3',
      'Preventiva':'#10b981',
      'Manutenção Preventiva':'#10b981',
      'Corretiva':'#ef4444',
      'Manutenção Corretiva':'#ef4444',
      'Inspeção':'#f59e0b'
    };

    // Agrupa tipos similares para exibição
    const porTipoDisplay={};
    prod.forEach(p=>{
      let tipo = p.tipo || 'Outros';
      // Normaliza para exibição
      if(tipo==='Manutenção Preventiva') tipo='Preventiva';
      if(tipo==='Manutenção Corretiva')  tipo='Corretiva';
      if(!porTipoDisplay[tipo]) porTipoDisplay[tipo]=0;
      porTipoDisplay[tipo]++;
    });

    // Top técnicos
    const porTec={};
    prod.forEach(p=>{
      const tecs = Array.isArray(p.tecnicos) ? p.tecnicos : (p.tecnicos||'').split(',');
      tecs.forEach(t=>{ const tn=t.trim(); if(!tn) return; if(!porTec[tn]) porTec[tn]={count:0,mins:0}; porTec[tn].count++; porTec[tn].mins+=p.minutos||0; });
    });
    const topTec=Object.entries(porTec).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
    const maxTec=topTec.length>0?topTec[0][1].count:1;

    // Por injetora
    const porInj={};
    prod.forEach(p=>{if(!porInj[p.injetora])porInj[p.injetora]=0;porInj[p.injetora]++;});
    const topInj=Object.entries(porInj).sort((a,b)=>b[1]-a[1]).slice(0,8);

    const paleta=['#0056b3','#10b981','#ef4444','#f59e0b','#8b5cf6','#0891b2','#ec4899','#14b8a6'];
    const coresDisplay=['#0056b3','#ef4444','#10b981','#f59e0b','#8b5cf6'];

    let html=`<div class="cards-row">
      ${metricCard('📋','Total de Manutenções',total,'no período','#0056b3')}
      ${metricCard('📅','Manutenções Hoje',totalHoje,'registros','#10b981')}
      ${metricCard('⏱️','Tempo Médio',minsMedio+' min','por manutenção','#f59e0b')}
      ${metricCard('🔴','Não Planejadas',naoPlaj,'máquinas paradas','#ef4444')}
    </div>
    <div class="cards-row">
      <div class="grafico-card" style="flex:1;min-width:240px">
        <div class="grafico-titulo">🔧 MTTR — Tempo Médio de Reparo (Corretivas)</div>
        <div style="text-align:center;padding:30px 0">
          <div style="font-size:48px;font-weight:800;color:${mttr>0?'#ef4444':'#94a3b8'}">${mttr}<span style="font-size:20px;font-weight:600;color:#64748b"> min</span></div>
          <div style="font-size:13px;color:#64748b;margin-top:8px">Baseado em ${corretivas.length} manutenções corretivas</div>
        </div>
      </div>
      <div class="grafico-card" style="flex:1;min-width:240px">
        <div class="grafico-titulo">🍩 Distribuição por Tipo</div>
        <div style="height:220px"><canvas id="chartProdTipos"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:20px">🏆 Ranking de Técnicos</div>`;

    const coresTecnicos=['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b'];
    topTec.forEach(([nome,info],i)=>{
      const pct=Math.round(info.count/maxTec*100);
      const medalha=['🥇','🥈','🥉','4️⃣','5️⃣'][i]||'';
      const cor=coresTecnicos[i]||'#64748b';
      html+=`<div class="barra-wrap"><div class="barra-header"><div class="barra-nome">${medalha} ${nome}</div>
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:12px;color:#64748b">${info.count} manutenções · ${fmtMin(info.mins)}</span>
          <span class="barra-valor" style="color:${cor}">#${i+1}</span>
        </div></div>
        <div class="barra-track"><div class="barra-fill" style="width:${pct}%;background:${cor}"></div></div>
      </div>`;
    });
    html+=`</div>`;

    if(topInj.length>0) {
      html+=`<div class="grafico-card"><div class="grafico-titulo">🏭 Manutenções por Injetora</div><div style="height:280px"><canvas id="chartProdInj"></canvas></div></div>`;
    }

    div.innerHTML=html;
    setTimeout(()=>{
      const tipoEnt=Object.entries(porTipoDisplay);
      const bgColors=tipoEnt.map(([t])=>coresTipo[t]||'#64748b');
      criarChart('chartProdTipos',{type:'doughnut',data:{labels:tipoEnt.map(e=>e[0]),datasets:[{data:tipoEnt.map(e=>e[1]),backgroundColor:bgColors,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},datalabels:{color:'#fff',font:{weight:'bold',size:13},formatter:(v,ctx)=>{const t=ctx.dataset.data.reduce((a,b)=>a+b,0);return t>0?Math.round(v/t*100)+'%':''}}}}});
      if(topInj.length>0) criarChart('chartProdInj',{type:'bar',data:{labels:topInj.map(e=>e[0]),datasets:[{data:topInj.map(e=>e[1]),backgroundColor:paleta,borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}});
    },100);
  };

  if (_dadosDash.prodLancamentos && _dadosDash.prodLancamentos.length >= 0) {
    _render(_dadosDash.prodLancamentos);
  } else {
    db.buscarProdPeriodo(ini,fim,'Todas',null)
      .then(_render)
      .catch(()=>{ div.innerHTML='<div class="empty-state">Erro ao carregar dados de Produção.</div>'; });
  }
}

// ==========================================
// 🛠️ HELPERS
// ==========================================
// ==========================================
// 🔍 FILTROS DE SELEÇÃO — Ocupação Pessoa/Máquina
// ==========================================
var _dashEstado = null;

function _renderBarrasPessoas(opEntries) {
  if (!opEntries.length) return '<div style="color:#94a3b8;font-size:13px;padding:8px 0">Nenhum técnico com lançamentos no período.</div>';
  const cor = _dashEstado?.cor || '#0056b3';
  return opEntries.map(op => {
    const funcRH = (_dashEstado?.funcionarios||[]).find(f=>f.nome===op.nome);
    const turno  = funcRH?.turno || '5x2';
    const c = op.pct>=100?'#10b981':op.pct>=70?cor:'#ef4444';
    const badge = op.pct>=100
      ? `<span style="background:#d1fae5;color:#059669;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">✅ Meta</span>`
      : op.pct>=70
      ? `<span style="background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">📈 OK</span>`
      : `<span style="background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">⚠️ Baixo</span>`;
    const badgeTurno = `<span style="background:#f1f5f9;color:#475569;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:4px">⏰ ${turno}</span>`;
    return `<div class="barra-wrap">
      <div class="barra-header">
        <div class="barra-nome">${op.nome} ${badge} ${badgeTurno}</div>
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:12px;color:#64748b">${fmtMin(op.mins)} / ${fmtMin(op.meta)}</span>
          <span class="barra-valor" style="color:${c}">${op.pct}%</span>
        </div>
      </div>
      <div class="barra-track"><div class="barra-fill" style="width:${Math.min(op.pct,100)}%;background:${c}"></div></div>
    </div>`;
  }).join('');
}

function _renderBarrasMaquinas(porMaq) {
  const entradas = Object.entries(porMaq).sort((a,b)=>b[1]-a[1]);
  if (!entradas.length) return '<div style="color:#94a3b8;font-size:13px;padding:8px 0">Nenhuma máquina com lançamentos no período.</div>';
  const cor = _dashEstado?.cor || '#0056b3';
  const capTotal = _dashEstado?.capTotal || 0;
  return entradas.map(([maq,mins]) => {
    const pct = capTotal>0?Math.round(mins/capTotal*100):0;
    const c = pct>=80?'#10b981':pct>=50?cor:'#f59e0b';
    return `<div class="barra-wrap"><div class="barra-header"><div class="barra-nome">${maq}</div>
      <div style="display:flex;gap:12px;align-items:center"><span style="font-size:12px;color:#64748b">${fmtMin(mins)}</span><span class="barra-valor" style="color:${c}">${pct}%</span></div>
    </div><div class="barra-track"><div class="barra-fill" style="width:${Math.min(pct,100)}%;background:${c}"></div></div></div>`;
  }).join('');
}

function filtrarOcupacaoPessoa() {
  const val = document.getElementById('selFiltroPessoaOcup')?.value || 'Todos';
  const container = document.getElementById('listaOcupacaoPessoas');
  if (!container || !_dashEstado) return;
  const filtrados = val === 'Todos' ? _dashEstado.opEntries : _dashEstado.opEntries.filter(o=>o.nome===val);
  container.innerHTML = _renderBarrasPessoas(filtrados);
}

function filtrarOcupacaoMaquina() {
  const val = document.getElementById('selFiltroMaquina')?.value || 'Todas';
  const container = document.getElementById('listaOcupacaoMaquinas');
  if (!container || !_dashEstado) return;
  const porMaqFiltrado = val === 'Todas'
    ? _dashEstado.porMaq
    : (_dashEstado.porMaq[val] !== undefined ? { [val]: _dashEstado.porMaq[val] } : {});
  container.innerHTML = _renderBarrasMaquinas(porMaqFiltrado);
}

function metricCard(ico,titulo,valor,sub,cor,extra){
  return `<div class="metric-card" style="border-left-color:${cor}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="metric-icon">${ico}</div>${extra?`<div>${extra}</div>`:''}
    </div>
    <div class="metric-valor" style="color:${cor}">${valor}</div>
    <div class="metric-label">${titulo}</div>
    <div class="metric-sub">${sub}</div>
  </div>`;
}

function criarChart(id,config){
  const ctx=document.getElementById(id); if(!ctx) return;
  if(_chartsDash[id]) _chartsDash[id].destroy();
  _chartsDash[id]=new Chart(ctx,config);
}

function abrirFichaMolde(job){
  const el=document.getElementById('fichaJobInput');
  if(el) el.value=job;
  irPara('ficha',document.getElementById('menuFicha'));
  setTimeout(()=>buscarFicha(),100);
}
