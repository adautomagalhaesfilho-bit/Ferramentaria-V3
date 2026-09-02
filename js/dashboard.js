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
  return funcRH.setor === 'Supervisão' || funcRH.cargo === 'Supervisor' || funcRH.cargo === 'Encarregado' || funcRH.cargo === 'Líder de Ferramentaria';
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
  else if (aba==='pcm')       desenharPCM(ini, fim);
}

// Gera o texto "▲ 8% vs período anterior" (ou ▼), colorindo verde/vermelho.
// invertido=true quando "maior" é ruim (ex: Horas Paradas) — inverte as cores.
function _deltaHtml(atual, anterior, invertido) {
  if (!anterior) return '<span style="font-size:11px;color:#94a3b8">sem período anterior p/ comparar</span>';
  const diff = atual - anterior;
  if (diff === 0) return '<span style="font-size:11px;color:#94a3b8">— igual ao período anterior</span>';
  const pct = Math.round(Math.abs(diff) / anterior * 100);
  const subiu = diff > 0;
  const bom = invertido ? !subiu : subiu;
  const cor = bom ? '#059669' : '#b91c1c';
  const seta = subiu ? '▲' : '▼';
  return `<span style="font-size:11px;color:${cor};font-weight:600">${seta} ${pct}% vs período anterior</span>`;
}

// Moldes parados na Ferramentaria há 5+ dias (usado na Geral e na aba PCM)
function _calcularMoldesParados() {
  return (_dadosDash.moldeLocalizacao||[])
    .filter(m => m.localizacao === 'Na Ferramentaria' && m.atualizado_em)
    .map(m => ({ job: m.job, dias: Math.floor((new Date() - new Date(m.atualizado_em)) / 86400000) }))
    .filter(m => m.dias >= 5)
    .sort((a,b) => b.dias - a.dias);
}

// ==========================================
// 📦 PCM — Movimentação de Moldes / Setups
// ==========================================
function desenharPCM(ini, fim) {
  const div = document.getElementById('dashPcm');
  if (!div || !_dadosDash) return;
  const prod    = (_dadosDash.prodLancamentos||[]).filter(p=>p.tipo==='Setup');
  const prodAnt = (_dadosDash.prodLancamentosAnteriores||[]).filter(p=>p.tipo==='Setup');
  const historico = _dadosDash.moldeHistorico || [];

  const tempoMedio = prod.length ? Math.round(prod.reduce((a,p)=>a+(p.minutos||0),0)/prod.length) : 0;
  const moldesParados = _calcularMoldesParados();

  // Molde que mais andou no período (mais movimentações no histórico de localização)
  const porJobMov = {};
  historico.forEach(h => { if(!h.job) return; porJobMov[h.job]=(porJobMov[h.job]||0)+1; });
  const moldeMaisAndou = Object.entries(porJobMov).sort((a,b)=>b[1]-a[1])[0];

  // Setups por atividade (Troca de Molde, Instalação, Remoção, Transferência)
  const porAtividade = {};
  prod.forEach(p => { const a=p.atividade||'Outros'; porAtividade[a]=(porAtividade[a]||0)+1; });
  const atividades = Object.entries(porAtividade).sort((a,b)=>b[1]-a[1]);

  // Injetoras com mais trocas
  const porInjetora = {};
  prod.forEach(p => { if(!p.injetora) return; porInjetora[p.injetora]=(porInjetora[p.injetora]||0)+1; });
  const injetoras = Object.entries(porInjetora).sort((a,b)=>b[1]-a[1]).slice(0,8);

  let html = `<div class="cards-row">
    ${metricCard('🔁','Setups no Período',prod.length,_deltaHtml(prod.length, prodAnt.length),'#0056b3')}
    ${metricCard('⏱️','Tempo Médio por Setup',tempoMedio+'min','todos os tipos','#8b5cf6')}
    ${metricCard('⚠️','Parados na Ferramentaria',moldesParados.length,'há 5+ dias','#ef4444')}
    ${metricCard('🔀','Molde que Mais Andou',moldeMaisAndou?`<span style="cursor:pointer;text-decoration:underline" onclick="abrirFichaMolde('${moldeMaisAndou[0].replace(/'/g,"\\'")}')">${moldeMaisAndou[0]}</span>`:'—',moldeMaisAndou?moldeMaisAndou[1]+' movimentações':'sem movimentação no período','#10b981')}
  </div>`;

  if (moldesParados.length) {
    html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:16px">
      <div style="font-weight:700;color:#b91c1c;font-size:14px;margin-bottom:10px">⚠️ Moldes Parados na Ferramentaria</div>
      ${moldesParados.map(m=>`<div style="display:flex;justify-content:space-between;font-size:13px;color:#b91c1c;padding:4px 0;border-bottom:1px dashed #fecaca">
        <span style="cursor:pointer;text-decoration:underline" onclick="abrirFichaMolde('${m.job.replace(/'/g,"\\'")}')">${m.job}</span><span style="font-weight:600">${m.dias} dias</span>
      </div>`).join('')}
    </div>`;
  }

  if (atividades.length || injetoras.length) {
    html += `<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;margin-bottom:16px" class="grafico-card">
      <div>
        <div class="grafico-titulo">📦 Setups por Tipo</div>
        <div style="height:220px">${atividades.length?'<canvas id="chartPcmTipo"></canvas>':'<div class="empty-msg">Sem setups no período.</div>'}</div>
      </div>
      <div>
        <div class="grafico-titulo">⚙️ Injetoras com Mais Trocas</div>
        <div style="height:220px">${injetoras.length?'<canvas id="chartPcmInjetoras"></canvas>':'<div class="empty-msg">Sem trocas no período.</div>'}</div>
      </div>
    </div>`;
  }
  div.innerHTML = html;

  const paleta = ['#0056b3','#10b981','#f59e0b','#8b5cf6','#ef4444','#0891b2','#6366f1','#ec4899'];
  setTimeout(() => {
    if (atividades.length) {
      criarChart('chartPcmTipo', { type:'doughnut',
        data:{ labels:atividades.map(a=>a[0]), datasets:[{ data:atividades.map(a=>a[1]), backgroundColor:paleta }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom', labels:{boxWidth:10,font:{size:11}}} } }
      });
    }
    if (injetoras.length) {
      criarChart('chartPcmInjetoras', { type:'bar',
        data:{ labels:injetoras.map(i=>i[0]), datasets:[{ data:injetoras.map(i=>i[1]), backgroundColor:'#0056b3', borderRadius:6 }] },
        options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
          plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'}} },
          scales:{ x:{beginAtZero:true,ticks:{stepSize:1}} }
        }
      });
    }
  }, 100);
}
function desenharGeral(ini, fim) {
  const div = document.getElementById('dashGeral');
  if (!div || !_dadosDash) return;
  const lancs    = _dadosDash.lancamentos || [];
  const lancsAnt = _dadosDash.lancamentosAnteriores || [];
  const prod     = _dadosDash.prodLancamentos || [];
  const prodAnt  = _dadosDash.prodLancamentosAnteriores || [];

  // "Parada de Máquina" não é trabalho produtivo — some vira o card próprio
  const lancsProdutivos    = lancs.filter(l => l.tipo !== 'Parada de Máquina');
  const lancsProdutivosAnt = lancsAnt.filter(l => l.tipo !== 'Parada de Máquina');
  const totalMinsParada    = lancs.filter(l => l.tipo === 'Parada de Máquina').reduce((a,l)=>a+(l.minutos||0),0);
  const totalMinsParadaAnt = lancsAnt.filter(l => l.tipo === 'Parada de Máquina').reduce((a,l)=>a+(l.minutos||0),0);
  const motivoParadaPredominante = (() => {
    const porMotivo = {};
    lancs.filter(l=>l.tipo==='Parada de Máquina').forEach(l=>{ const m=l.motivo||'Sem motivo'; porMotivo[m]=(porMotivo[m]||0)+(l.minutos||0); });
    const top = Object.entries(porMotivo).sort((a,b)=>b[1]-a[1])[0];
    if (!top || totalMinsParada===0) return '';
    return Math.round(top[1]/totalMinsParada*100) + '% ' + top[0];
  })();

  const porSetor = {};
  lancs.forEach(l => {
    const s = l.setor||'Outros';
    if (!porSetor[s]) porSetor[s] = { count:0, mins:0, jobs:new Set() };
    porSetor[s].count++; porSetor[s].mins += l.minutos||0;
    if (l.job) porSetor[s].jobs.add(l.job);
  });

  const totalMins    = lancsProdutivos.reduce((a,l)=>a+(l.minutos||0),0);
  const totalMinsAnt = lancsProdutivosAnt.reduce((a,l)=>a+(l.minutos||0),0);
  const totalJobs    = new Set(lancs.filter(l=>l.job).map(l=>l.job)).size;

  // Manutenção (Preventiva/Corretiva na Produção) separada de Setup — não confundir os dois
  const manutProd    = prod.filter(p=>(p.tipo||'').includes('Preventiva')||(p.tipo||'').includes('Corretiva')).length;
  const manutProdAnt = prodAnt.filter(p=>(p.tipo||'').includes('Preventiva')||(p.tipo||'').includes('Corretiva')).length;
  const setupsProd    = prod.filter(p=>p.tipo==='Setup').length;
  const setupsProdAnt = prodAnt.filter(p=>p.tipo==='Setup').length;

  // Banco de horas: saldo líquido do período selecionado (créditos - débitos)
  const bancoHoras = _dadosDash.bancoHoras || [];
  const bancoPeriodo = bancoHoras.filter(b => b.data >= ini && b.data <= fim);
  const saldoPeriodoMin = bancoPeriodo.reduce((a,b) => a + (b.tipo==='Credito' ? (b.minutos||0) : -(b.minutos||0)), 0);

  // Saldo acumulado (todo o histórico) por funcionário — pra achar quem está no negativo
  const saldoPorFunc = {};
  bancoHoras.forEach(b => {
    const f = b.funcionario; if (!f) return;
    saldoPorFunc[f] = (saldoPorFunc[f]||0) + (b.tipo==='Credito' ? (b.minutos||0) : -(b.minutos||0));
  });
  const funcsNegativos = Object.entries(saldoPorFunc).filter(([,m]) => m <= -600); // -10h ou mais negativo

  // Ausentes hoje (data real de hoje, não o período do filtro)
  const hoje = new Date().toISOString().split('T')[0];
  const ausentesHoje = (_dadosDash.ferias||[]).filter(f => hoje >= f.inicio && hoje <= f.fim);

  // Moldes parados na Ferramentaria há 5+ dias
  const moldesParados = _calcularMoldesParados();

  // Máquinas Principais da Usinagem sem nenhum apontamento produtivo no período
  const maquinasTipo = (typeof _listas !== 'undefined' && _listas?.maquinasTipo) || {};
  const nomesMaquinasPrincipais = Object.keys(_dadosDash.capacidadesMaquinas||{}).filter(m => maquinasTipo[m] !== 'Secundaria');
  const maquinasComApontamento = new Set(lancsProdutivos.filter(l=>l.setor==='Usinagem'&&l.maquina).map(l=>l.maquina));
  const maquinasSemApontamento = nomesMaquinasPrincipais.filter(m => !maquinasComApontamento.has(m));

  // RAM atrasada — prazo já vencido e ainda tem pelo menos 1 setor pendente
  const hojeStr = new Date().toISOString().split('T')[0];
  const ramTodas = _dadosDash.ramTodas || [];
  const ramSetoresTodas = _dadosDash.ramSetoresTodas || [];
  const ramsAtrasadas = ramTodas.filter(r => {
    if (!r.prazo_final || r.prazo_final >= hojeStr) return false;
    return ramSetoresTodas.some(s => s.ram_id === r.id && !s.concluido);
  });

  // Copos abaixo do estoque mínimo (mínimo = cavidades do molde dono)
  const mapaCavidadesCopos = {};
  (_dadosDash.jobsCavidades||[]).forEach(j => { mapaCavidadesCopos[j.nome] = j.num_cavidades || 1; });
  const coposAbaixoMinimo = (_dadosDash.coposTodos||[]).filter(c => {
    const total = (c.estoque_novo||0) + (c.estoque_embuchado||0);
    return total < (mapaCavidadesCopos[c.job] || 1);
  });

  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };

  // Moldes mais trabalhados — remove categorias genéricas de serviço (ex: "SV - Bancada")
  const porMolde = {};
  lancs.filter(l=>l.job && !/^SV\s*-/i.test(l.job)).forEach(l => { if(!porMolde[l.job]) porMolde[l.job]=0; porMolde[l.job]+=(l.minutos||0); });
  const topMoldes = Object.entries(porMolde).sort((a,b)=>b[1]-a[1]).slice(0,10);

  let html = `<div class="cards-row">
    ${metricCard('📋','Total de Lançamentos',lancs.length,_deltaHtml(lancs.length, lancsAnt.length),'#0056b3')}
    ${metricCard('⏱️','Horas Produtivas',fmtMin(totalMins),_deltaHtml(totalMins, totalMinsAnt),'#10b981')}
    ${metricCard('🔩','Jobs Trabalhados',totalJobs,'moldes únicos','#8b5cf6')}
    ${metricCard('🔧','Manutenções (Produção)',manutProd,_deltaHtml(manutProd, manutProdAnt),'#f59e0b')}
  </div><div class="cards-row">
    ${metricCard('🔴','Horas Paradas',fmtMin(totalMinsParada),totalMinsParada>0?(_deltaHtml(totalMinsParada, totalMinsParadaAnt, true)+(motivoParadaPredominante?` · ${motivoParadaPredominante}`:'')):'nenhuma no período','#ef4444')}
    ${metricCard('🏦','Banco de Horas',(saldoPeriodoMin>=0?'+':'')+fmtMin(Math.abs(saldoPeriodoMin)),'saldo líquido do período',saldoPeriodoMin>=0?'#10b981':'#ef4444')}
    ${metricCard('📅','Ausentes Hoje',ausentesHoje.length,ausentesHoje.length?ausentesHoje.map(a=>a.motivo).join(', '):'ninguém de férias/licença','#0891b2')}
    ${metricCard('📦','Setups (Produção)',setupsProd,_deltaHtml(setupsProd, setupsProdAnt),'#6366f1')}
    ${metricCard('🔩','Copos Abaixo do Mínimo',coposAbaixoMinimo.length,coposAbaixoMinimo.length?'precisam atenção':'estoque OK',coposAbaixoMinimo.length?'#ef4444':'#10b981')}
  </div>`;

  // Painel "Precisa de Atenção" — só aparece se houver algo relevante
  const temAtencao = maquinasSemApontamento.length || funcsNegativos.length || moldesParados.length || ramsAtrasadas.length || coposAbaixoMinimo.length;
  if (temAtencao) {
    html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:16px">
      <div style="font-weight:700;color:#92400e;font-size:14px;margin-bottom:10px">⚠️ Precisa de Atenção</div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:#92400e">
        ${maquinasSemApontamento.length ? `<div>• ${maquinasSemApontamento.length} máquina${maquinasSemApontamento.length>1?'s':''} Principal${maquinasSemApontamento.length>1?'is':''} sem apontamento no período: <b>${maquinasSemApontamento.join(', ')}</b></div>` : ''}
        ${funcsNegativos.length ? `<div>• ${funcsNegativos.length} funcionário${funcsNegativos.length>1?'s':''} com banco de horas negativo (10h+): <b>${funcsNegativos.map(([n,m])=>n+' ('+fmtMin(Math.abs(m))+')').join(', ')}</b></div>` : ''}
        ${moldesParados.length ? `<div>• ${moldesParados.length} molde${moldesParados.length>1?'s':''} parado${moldesParados.length>1?'s':''} na Ferramentaria há 5+ dias: <b>${moldesParados.map(m=>`<span style="cursor:pointer;text-decoration:underline" onclick="abrirFichaMolde('${m.job.replace(/'/g,"\\'")}')">${m.job}</span> (${m.dias}d)`).join(', ')}</b></div>` : ''}
        ${ramsAtrasadas.length ? `<div>• ${ramsAtrasadas.length} RAM${ramsAtrasadas.length>1?'s':''} com prazo vencido: <b>${ramsAtrasadas.map(r=>`<span style="cursor:pointer;text-decoration:underline" onclick="abrirFichaMolde('${r.job.replace(/'/g,"\\'")}')">RAM ${r.numero}</span>`).join(', ')}</b></div>` : ''}
        ${coposAbaixoMinimo.length ? `<div>• ${coposAbaixoMinimo.length} copo${coposAbaixoMinimo.length>1?'s':''} abaixo do estoque mínimo: <b>${coposAbaixoMinimo.map(c=>`<span style="cursor:pointer;text-decoration:underline" onclick="irPara('copos', document.getElementById('menuCopos'))">${c.codigo}</span>`).join(', ')}</b></div>` : ''}
      </div>
    </div>`;
  }

  html += `<div class="cards-row">`;
  ['Usinagem','Bancada','Projeto'].forEach(s => {
    const d = porSetor[s] || { count:0, mins:0, jobs:new Set() };
    const funcsSetor = (_dadosDash.funcionarios||[]).filter(f => f.setor === s).length;
    const horasPorPessoa = funcsSetor > 0 ? Math.round(d.mins/60/funcsSetor*10)/10 : null;
    html += `<div class="metric-card" style="border-left-color:${cors[s]}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:36px;height:36px;background:${cors[s]}20;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px">${icos[s]}</div>
        <b style="color:#1e3a5f">${s}</b>
      </div>
      <div style="font-size:20px;font-weight:700;color:${cors[s]}">${d.mins>0?fmtMin(d.mins):'—'}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">${d.count} lançamentos · ${d.jobs.size} jobs</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">${horasPorPessoa!==null?horasPorPessoa+'h por pessoa':'sem meta de horas'}</div>
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

  // "Parada de Máquina" não é trabalho produtivo — fica de fora das métricas de
  // ocupação (pessoas/máquinas) e das horas produtivas, mas continua contando
  // como lançamento e aparece no painel próprio de paradas mais abaixo.
  const lancsProdutivos = lancs.filter(l => l.tipo !== 'Parada de Máquina');

  // Exclui supervisores das horas produtivas do setor (têm função administrativa)
  const lancsSemSupervisor = lancsProdutivos.filter(l => !isSupervisor(l.funcionario, _dadosDash));
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
  if(setor==='Usinagem') lancsProdutivos.forEach(l=>{ if(!l.maquina||l.maquina==='Sem Máquina') return; if(!porMaq[l.maquina]) porMaq[l.maquina]=0; porMaq[l.maquina]+=l.minutos||0; });

  // Separa máquinas Principais (seguem meta de ocupação diária) das Secundárias
  // (só medimos quanto tempo foram usadas no período, sem meta/percentual)
  const maquinasTipo = (typeof _listas !== 'undefined' && _listas?.maquinasTipo) || {};
  const porMaqPrincipal = {};
  const porMaqSecundaria = {};
  Object.entries(porMaq).forEach(([maq, mins]) => {
    if (maquinasTipo[maq] === 'Secundaria') porMaqSecundaria[maq] = mins;
    else porMaqPrincipal[maq] = mins;
  });

  // Paradas de Máquina — agrupa por máquina e motivo pra expor no dashboard
  // ex: "Torno 3 — 60h paradas: 40h Falta de Demanda, 20h Manutenção Corretiva"
  const porMaqMotivo = {};
  let totalMinsParada = 0;
  if (setor === 'Usinagem') {
    lancs.filter(l => l.tipo === 'Parada de Máquina').forEach(l => {
      const maq = l.maquina || 'Sem Máquina';
      const motivo = l.motivo || 'Sem motivo';
      if (!porMaqMotivo[maq]) porMaqMotivo[maq] = {};
      if (!porMaqMotivo[maq][motivo]) porMaqMotivo[maq][motivo] = 0;
      porMaqMotivo[maq][motivo] += l.minutos || 0;
      totalMinsParada += l.minutos || 0;
    });
  }

  // Máquinas compartilhadas entre setores (ex: Solda Tig/Mig, Torno, Fresadora
  // usadas pela Bancada) devem contar na ocupação de máquinas da Usinagem,
  // independente de quem lançou. O mapa cobre nomes antigos e novos da mesma
  // máquina (ex: "Torno" foi renomeado pra "Torno Convencional"), consolidando
  // tudo na mesma barra em vez de duplicar.
  if (setor === 'Usinagem') {
    const MAPA_MAQUINAS_COMPARTILHADAS = {
      'Solda Tig': 'Solda Tig', 'Solda Mig': 'Solda Mig', 'Solda Laser': 'Solda Laser',
      'Torno': 'Torno Convencional', 'Torno Convencional': 'Torno Convencional',
      'Fresadora': 'Fresadora Convencional', 'Fresadora Convencional': 'Fresadora Convencional'
    };
    (_dadosDash.lancamentos || []).forEach(l => {
      if (l.setor === 'Usinagem') return; // já contabilizado acima via campo Máquina
      const nomeReal = MAPA_MAQUINAS_COMPARTILHADAS[l.tipo];
      if (!nomeReal) return;
      if (!porMaq[nomeReal]) porMaq[nomeReal] = 0;
      porMaq[nomeReal] += l.minutos || 0;
    });
  }

  let diasUteis = 0;
  for(let d=new Date(ini+'T12:00:00');d<=new Date(fim+'T12:00:00');d.setDate(d.getDate()+1)) {
    const ds=d.toISOString().split('T')[0];
    if(d.getDay()!==0&&d.getDay()!==6&&!feriados.includes(ds)) diasUteis++;
  }
  const capTotal  = 528 * diasUteis;
  const numMaq    = Object.keys(porMaqPrincipal).length;
  const capBancada = setor==='Bancada' ? calcularCapBancada(ini, fim, _dadosDash) : 0;
  const pctBancada = capBancada>0?Math.round(totalMinsSemSup/capBancada*100):0;
  const capHistorico = _dadosDash.capacidadeHistoricoMaquinas || [];

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

  // Guarda estado completo para os filtros estilo Excel
  _dashEstado = {
    opEntries, porMaq: porMaqPrincipal, cor, capTotal, capBancada, setor,
    funcionarios: _dadosDash.funcionarios||[],
    feriados: feriados,
    lancsSemSupervisor,
    filtroPessoas:  new Set(opEntries.map(o=>o.nome)),
    filtroMaquinas: new Set(Object.keys(porMaqPrincipal)),
    // Necessários pra calcular a capacidade real (por vigência) de cada máquina
    capHistorico: capHistorico, periodoIni: ini, periodoFim: fim
  };

  const capTotalMaquinasPrincipais = Object.keys(porMaqPrincipal)
    .reduce((soma, maq) => soma + _capTotalPorMaquina(capHistorico, maq, ini, fim, feriados), 0);
  const pctMaqInicial = capTotalMaquinasPrincipais>0
    ? Math.round(Object.values(porMaqPrincipal).reduce((a,b)=>a+b,0)/capTotalMaquinasPrincipais*100) : 0;

  let html=`<div class="cards-row">
    <div class="metric-card" style="border-left-color:${cor}">
      <div class="metric-icon">⏱️</div>
      <div class="metric-valor" id="valHorasProdutivas" style="color:${cor}">${fmtMin(totalMinsSemSup)}</div>
      <div class="metric-label">Horas Produtivas</div>
      <div class="metric-sub">total da equipe (sem supervisão)</div>
    </div>
    ${metricCard('🔩','Jobs Trabalhados',totalJobs,'moldes únicos','#10b981')}
    <div class="metric-card" style="border-left-color:${pctEquipe>=90?'#10b981':pctEquipe>=70?'#f59e0b':'#ef4444'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="metric-icon">👥</div><div id="badgeOcupacaoEquipe">${badgePct(pctEquipe)}</div>
      </div>
      <div class="metric-valor" id="valOcupacaoEquipe" style="color:${pctEquipe>=90?'#10b981':pctEquipe>=70?'#f59e0b':'#ef4444'}">${pctEquipe}%</div>
      <div class="metric-label">Ocupação da Equipe</div>
      <div class="metric-sub">vs meta do período</div>
    </div>
    ${setor==='Usinagem' ? `
    <div class="metric-card" style="border-left-color:#0056b3">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="metric-icon">⚙️</div><div id="badgeOcupacaoMaquinas"><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#dbeafe;color:#1d4ed8">${numMaq} máquinas</span></div>
      </div>
      <div class="metric-valor" id="valOcupacaoMaquinas" style="color:#0056b3">${numMaq>0?pctMaqInicial+'%':'—'}</div>
      <div class="metric-label">Ocupação Máquinas</div>
      <div class="metric-sub">média das máquinas</div>
    </div>` : `
    <div class="metric-card" style="border-left-color:${pctBancada>=90?'#10b981':pctBancada>=70?'#f59e0b':'#ef4444'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="metric-icon">🛠️</div><div id="badgeOcupacaoBancada">${badgePct(pctBancada)}</div>
      </div>
      <div class="metric-valor" id="valOcupacaoBancada" style="color:${pctBancada>=90?'#10b981':pctBancada>=70?'#f59e0b':'#ef4444'}">${pctBancada}%</div>
      <div class="metric-label">Ocupação Bancada</div>
      <div class="metric-sub">vs capacidade real</div>
    </div>`}
    <div class="metric-card" style="border-left-color:#8b5cf6">
      <div class="metric-icon">📋</div>
      <div class="metric-valor" id="valLancamentos" style="color:#8b5cf6">${lancs.length}</div>
      <div class="metric-label">Lançamentos</div>
      <div class="metric-sub">no período</div>
    </div>
    <div class="metric-card" id="cardHorasExtras" style="border-left-color:#f59e0b;display:${horasExtras>0?'':'none'}">
      <div class="metric-icon">⏰</div>
      <div class="metric-valor" id="valHorasExtras" style="color:#f59e0b">${fmtMin(horasExtras)}</div>
      <div class="metric-label">Horas Extras</div>
      <div class="metric-sub">fora do expediente</div>
    </div>
    ${setor==='Usinagem' ? `
    <div class="metric-card" id="cardHorasParadas" style="border-left-color:#ef4444;display:${totalMinsParada>0?'':'none'}">
      <div class="metric-icon">🔴</div>
      <div class="metric-valor" id="valHorasParadas" style="color:#ef4444">${fmtMin(totalMinsParada)}</div>
      <div class="metric-label">Horas Paradas</div>
      <div class="metric-sub">máquinas sem produção</div>
    </div>` : ''}
  </div>`;

  const opOrdenados = [...opEntries].sort((a,b)=>a.nome.localeCompare(b.nome));
  html+=`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">👤 Desempenho Individual</div>
      <div style="position:relative;display:inline-block">
        <button id="btnFiltroPessoas" class="btn-secondary" style="font-size:12px;padding:6px 12px" onclick="toggleFiltroDash(event,'painelFiltroPessoas')">🔽 Técnicos (${opEntries.length}/${opEntries.length})</button>
        <div id="painelFiltroPessoas" class="painel-filtro-dash" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border:1px solid var(--borda);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:500;width:240px;padding:10px;max-height:280px;overflow-y:auto" onclick="event.stopPropagation()">
          <div style="display:flex;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9">
            <button class="btn-secondary" style="font-size:11px;padding:3px 8px;flex:1" onclick="marcarTodosFiltroDash('pessoas',true)">Marcar todos</button>
            <button class="btn-secondary" style="font-size:11px;padding:3px 8px;flex:1" onclick="marcarTodosFiltroDash('pessoas',false)">Limpar</button>
          </div>
          ${opOrdenados.map(o=>`<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:12px;cursor:pointer">
            <input type="checkbox" class="chkFiltroPessoa" value="${o.nome.replace(/"/g,'&quot;')}" checked onchange="aplicarFiltroDashPessoas()"> ${o.nome}
          </label>`).join('')}
        </div>
      </div>
    </div>
    <div id="listaOcupacaoPessoas">${_renderBarrasPessoas(opEntries)}</div>
  </div>`;

  if(setor==='Usinagem'&&numMaq>0){
    const maqOrdenadas = Object.keys(porMaqPrincipal).sort();
    html+=`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <div style="font-weight:700;color:#1e3a5f;font-size:15px">🤖 Ocupação das Máquinas</div>
        <div style="position:relative;display:inline-block">
          <button id="btnFiltroMaquinas" class="btn-secondary" style="font-size:12px;padding:6px 12px" onclick="toggleFiltroDash(event,'painelFiltroMaquinas')">🔽 Máquinas (${numMaq}/${numMaq})</button>
          <div id="painelFiltroMaquinas" class="painel-filtro-dash" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border:1px solid var(--borda);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:500;width:220px;padding:10px;max-height:280px;overflow-y:auto" onclick="event.stopPropagation()">
            <div style="display:flex;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9">
              <button class="btn-secondary" style="font-size:11px;padding:3px 8px;flex:1" onclick="marcarTodosFiltroDash('maquinas',true)">Marcar todos</button>
              <button class="btn-secondary" style="font-size:11px;padding:3px 8px;flex:1" onclick="marcarTodosFiltroDash('maquinas',false)">Limpar</button>
            </div>
            ${maqOrdenadas.map(m=>`<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:12px;cursor:pointer">
              <input type="checkbox" class="chkFiltroMaquina" value="${m.replace(/"/g,'&quot;')}" checked onchange="aplicarFiltroDashMaquinas()"> ${m}
            </label>`).join('')}
          </div>
        </div>
      </div>
      <div id="listaOcupacaoMaquinas">${_renderBarrasMaquinas(porMaqPrincipal)}</div>
    </div>`;
  }

  // Máquinas Secundárias — sem meta de ocupação, só medimos quanto tempo foram usadas no período
  if (setor === 'Usinagem' && Object.keys(porMaqSecundaria).length > 0) {
    const secOrdenadas = Object.entries(porMaqSecundaria).sort((a,b)=>b[1]-a[1]);
    html+=`<div class="card">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:6px">🔧 Máquinas Secundárias — Uso no Período</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:16px">Não seguem meta diária de ocupação — aqui só medimos quanto tempo cada uma foi usada</div>
      ${secOrdenadas.map(([maq,mins]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9">
        <div style="font-weight:600;color:#1e3a5f;font-size:13px">⚙️ ${maq}</div>
        <div style="font-size:13px;font-weight:700;color:#64748b">${fmtMin(mins)} usado${mins>0?'s':''}</div>
      </div>`).join('')}
    </div>`;
  }

  if (setor==='Usinagem' && totalMinsParada > 0) {
    const maqsParada = Object.keys(porMaqMotivo).sort((a,b) => {
      const totalA = Object.values(porMaqMotivo[a]).reduce((x,y)=>x+y,0);
      const totalB = Object.values(porMaqMotivo[b]).reduce((x,y)=>x+y,0);
      return totalB - totalA;
    });
    const paletaMotivo = ['#ef4444','#f59e0b','#8b5cf6','#0ea5e9','#10b981','#ec4899','#64748b','#14b8a6','#f97316','#6366f1','#84cc16','#eab308'];
    html+=`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
        <div style="font-weight:700;color:#1e3a5f;font-size:15px">🔴 Paradas de Máquina</div>
        <div style="font-size:12px;color:#94a3b8">Total no período: <strong style="color:#b91c1c">${fmtMin(totalMinsParada)}</strong></div>
      </div>
      ${maqsParada.map(maq => {
        const motivos = Object.entries(porMaqMotivo[maq]).sort((a,b)=>b[1]-a[1]);
        const totalMaq = motivos.reduce((a,[,m])=>a+m,0);
        return `<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #f1f5f9">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:600;color:#1e3a5f;font-size:13px">⚙️ ${maq}</div>
            <div style="font-size:13px;font-weight:700;color:#b91c1c">${fmtMin(totalMaq)} parada${totalMaq>0?'s':''}</div>
          </div>
          <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;background:#f1f5f9;margin-bottom:8px">
            ${motivos.map(([,m],i)=>`<div style="width:${totalMaq>0?(m/totalMaq*100):0}%;background:${paletaMotivo[i%paletaMotivo.length]}"></div>`).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${motivos.map(([motivo,m],i)=>`<span style="font-size:11px;padding:3px 8px;border-radius:10px;background:${paletaMotivo[i%paletaMotivo.length]}20;color:${paletaMotivo[i%paletaMotivo.length]};font-weight:600">${motivo}: ${fmtMin(m)}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}
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
    const corretivas=prod.filter(p=>(p.tipo||'').includes('Corretiva')&&p.minutos>0);
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
      html+=`<div class="barra-wrap"><div class="barra-header"><div class="barra-nome">${medalha} ${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(nome):nome}</div>
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
        <div class="barra-nome">${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(op.nome):op.nome} ${badge} ${badgeTurno}</div>
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
  const capHistorico = _dashEstado?.capHistorico || [];
  const ini = _dashEstado?.periodoIni, fim = _dashEstado?.periodoFim;
  const feriados = _dashEstado?.feriados || [];
  return entradas.map(([maq,mins]) => {
    const capMaq = _capTotalPorMaquina(capHistorico, maq, ini, fim, feriados);
    const pct = capMaq>0?Math.round(mins/capMaq*100):0;
    const c = pct>=80?'#10b981':pct>=50?cor:'#f59e0b';
    return `<div class="barra-wrap"><div class="barra-header"><div class="barra-nome">${maq}</div>
      <div style="display:flex;gap:12px;align-items:center"><span style="font-size:12px;color:#64748b">${fmtMin(mins)}</span><span class="barra-valor" style="color:${c}">${pct}%</span></div>
    </div><div class="barra-track"><div class="barra-fill" style="width:${Math.min(pct,100)}%;background:${c}"></div></div></div>`;
  }).join('');
}

// ==========================================
// 🎛️ FILTRO ESTILO EXCEL — Checkbox + Recalcula Totais
// ==========================================
var _dashFiltroListenerAdicionado = false;

function toggleFiltroDash(evt, painelId) {
  evt.stopPropagation();
  document.querySelectorAll('.painel-filtro-dash').forEach(p => { if (p.id !== painelId) p.style.display = 'none'; });
  const painel = document.getElementById(painelId);
  if (!painel) return;
  painel.style.display = painel.style.display === 'block' ? 'none' : 'block';

  if (!_dashFiltroListenerAdicionado) {
    document.addEventListener('click', () => {
      document.querySelectorAll('.painel-filtro-dash').forEach(p => p.style.display = 'none');
    });
    _dashFiltroListenerAdicionado = true;
  }
}

function marcarTodosFiltroDash(tipo, marcar) {
  const classe = tipo === 'pessoas' ? '.chkFiltroPessoa' : '.chkFiltroMaquina';
  document.querySelectorAll(classe).forEach(c => c.checked = marcar);
  if (tipo === 'pessoas') aplicarFiltroDashPessoas();
  else aplicarFiltroDashMaquinas();
}

function _badgeOcupacaoHTML(pct) {
  const c  = pct>=90?'#059669':pct>=70?'#92400e':'#b91c1c';
  const bg = pct>=90?'#d1fae5':pct>=70?'#fef3c7':'#fee2e2';
  const t  = pct>=90?'✅ Meta':pct>=70?'⚠️ OK':'🔴 Baixo';
  return `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${bg};color:${c}">${t}</span>`;
}

function _corPct(pct) { return pct>=90?'#10b981':pct>=70?'#f59e0b':'#ef4444'; }

function _setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function aplicarFiltroDashPessoas() {
  if (!_dashEstado) return;
  const marcados = Array.from(document.querySelectorAll('.chkFiltroPessoa:checked')).map(c => c.value);
  _dashEstado.filtroPessoas = new Set(marcados);

  const filtrados = _dashEstado.opEntries.filter(o => _dashEstado.filtroPessoas.has(o.nome));
  const container = document.getElementById('listaOcupacaoPessoas');
  if (container) container.innerHTML = _renderBarrasPessoas(filtrados);

  const btn = document.getElementById('btnFiltroPessoas');
  if (btn) btn.innerText = `🔽 Técnicos (${filtrados.length}/${_dashEstado.opEntries.length})`;

  // Recalcula totais gerais
  const totalMinsF = filtrados.reduce((a,o)=>a+o.mins,0);
  const totalMetaF = filtrados.reduce((a,o)=>a+o.meta,0);
  const pctEquipeF = totalMetaF>0 ? Math.round(totalMinsF/totalMetaF*100) : 0;

  _setTexto('valHorasProdutivas', fmtMin(totalMinsF));
  _setTexto('valOcupacaoEquipe', pctEquipeF+'%');
  const valEquipeEl = document.getElementById('valOcupacaoEquipe');
  if (valEquipeEl) valEquipeEl.style.color = _corPct(pctEquipeF);
  const badgeEquipeEl = document.getElementById('badgeOcupacaoEquipe');
  if (badgeEquipeEl) badgeEquipeEl.innerHTML = _badgeOcupacaoHTML(pctEquipeF);

  // Bancada: Ocupação Bancada também reflete a seleção de pessoas
  if (_dashEstado.setor === 'Bancada' && _dashEstado.capBancada) {
    const pctBancadaF = _dashEstado.capBancada>0 ? Math.round(totalMinsF/_dashEstado.capBancada*100) : 0;
    _setTexto('valOcupacaoBancada', pctBancadaF+'%');
    const valBancadaEl = document.getElementById('valOcupacaoBancada');
    if (valBancadaEl) valBancadaEl.style.color = _corPct(pctBancadaF);
    const badgeBancadaEl = document.getElementById('badgeOcupacaoBancada');
    if (badgeBancadaEl) badgeBancadaEl.innerHTML = _badgeOcupacaoHTML(pctBancadaF);
  }

  // Lançamentos e Horas Extras — recalcula com base nos técnicos selecionados
  if (_dashEstado.lancsSemSupervisor) {
    const lancsF = _dashEstado.lancsSemSupervisor.filter(l => _dashEstado.filtroPessoas.has(l.funcionario));
    _setTexto('valLancamentos', lancsF.length);
    const extrasF = lancsF.filter(l => {
      const fr = (_dashEstado.funcionarios||[]).find(f=>f.nome===l.funcionario);
      const turno = fr?.turno || '5x2';
      return !funcTrabalhaEmDia(turno, l.data, _dashEstado.feriados||[]);
    }).reduce((a,l)=>a+(l.minutos||0),0);
    const cardExtras = document.getElementById('cardHorasExtras');
    if (cardExtras) cardExtras.style.display = extrasF>0 ? '' : 'none';
    _setTexto('valHorasExtras', fmtMin(extrasF));
  }
}

function aplicarFiltroDashMaquinas() {
  if (!_dashEstado) return;
  const marcados = Array.from(document.querySelectorAll('.chkFiltroMaquina:checked')).map(c => c.value);
  _dashEstado.filtroMaquinas = new Set(marcados);

  const porMaqFiltrado = {};
  marcados.forEach(m => { if (_dashEstado.porMaq[m] !== undefined) porMaqFiltrado[m] = _dashEstado.porMaq[m]; });

  const container = document.getElementById('listaOcupacaoMaquinas');
  if (container) container.innerHTML = _renderBarrasMaquinas(porMaqFiltrado);

  const totalMaq = Object.keys(_dashEstado.porMaq).length;
  const btn = document.getElementById('btnFiltroMaquinas');
  if (btn) btn.innerText = `🔽 Máquinas (${marcados.length}/${totalMaq})`;

  // Recalcula Ocupação Máquinas com base na seleção, usando a capacidade real de cada uma
  const totalMinsF = Object.values(porMaqFiltrado).reduce((a,b)=>a+b,0);
  const numSel = marcados.length;
  const capTotalF = marcados.reduce((soma, maq) =>
    soma + _capTotalPorMaquina(_dashEstado.capHistorico||[], maq, _dashEstado.periodoIni, _dashEstado.periodoFim, _dashEstado.feriados||[]), 0);
  const pctMaqF = numSel>0 && capTotalF>0 ? Math.round(totalMinsF/capTotalF*100) : 0;

  _setTexto('valOcupacaoMaquinas', numSel>0 ? pctMaqF+'%' : '—');
  const badgeMaqEl = document.getElementById('badgeOcupacaoMaquinas');
  if (badgeMaqEl) badgeMaqEl.innerHTML = `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#dbeafe;color:#1d4ed8">${numSel} máquina(s)</span>`;
}

// Capacidade vigente de uma máquina numa data específica (histórico com vigência,
// nunca recalcula dias passados quando o horário de disponibilidade muda)
function _capacidadeMaquinaNaData(historico, maquina, dataStr) {
  const registros = (historico||[]).filter(h => h.maquina === maquina && h.vigente_desde <= dataStr);
  if (!registros.length) return 598; // padrão (07:30–17:28) se não houver registro pra essa máquina
  registros.sort((a,b) => b.vigente_desde.localeCompare(a.vigente_desde));
  return registros[0].capacidade_min;
}

// Soma a capacidade dia a dia de UMA máquina no período (mesma regra de "dia útil"
// já usada no resto do dashboard: sem domingo, sem feriado)
function _capTotalPorMaquina(historico, maquina, ini, fim, feriados) {
  let total = 0;
  for (let d = new Date(ini+'T12:00:00'); d <= new Date(fim+'T12:00:00'); d.setDate(d.getDate()+1)) {
    const ds = d.toISOString().split('T')[0];
    if (d.getDay()===0 || d.getDay()===6 || (feriados||[]).includes(ds)) continue;
    total += _capacidadeMaquinaNaData(historico, maquina, ds);
  }
  return total;
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
