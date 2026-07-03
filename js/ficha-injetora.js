// ==========================================
// 🏭 FICHA-INJETORA.JS — Ficha da Injetora
// ==========================================

var _dadosFichaInjetora = null;
var _chartsFichaInjetora = {};

async function abrirFichaInjetora(nomeInjetora) {
  const div = document.createElement('div');
  div.id = 'modalFichaInjetoraWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharFichaInjetora()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:780px;max-height:90vh;overflow-y:auto">
    <div class="modal-header">
      <h3>🏭 Ficha da Injetora — ${nomeInjetora}</h3>
      <button onclick="fecharFichaInjetora()">✕</button>
    </div>
    <div class="modal-body" id="fichaInjetoraCorpo">
      <div class="loader-inline"><div class="spinner-sm"></div><span>Carregando ficha...</span></div>
    </div>
  </div>`;
  document.body.appendChild(div);

  try {
    const [lancs, infoInj] = await Promise.all([
      db._get('prod_lancamentos', 'injetora=eq.' + encodeURIComponent(nomeInjetora) + '&order=data.asc', '*'),
      db._get('prod_injetoras', 'nome=eq.' + encodeURIComponent(nomeInjetora), '*')
    ]);

    const info = (infoInj && infoInj[0]) || null;

    // Histórico de alterações administrativas — só Admin, só se a injetora tiver id cadastrado
    let logsAlteracao = [];
    if (typeof isAdmin === 'function' && isAdmin() && info?.id && typeof buscarHistoricoItem === 'function') {
      logsAlteracao = await buscarHistoricoItem('prod_injetoras', info.id);
    }

    _dadosFichaInjetora = { lancamentos: lancs || [], info, logsAlteracao };
    renderizarFichaInjetora(nomeInjetora, _dadosFichaInjetora);
  } catch(e) {
    document.getElementById('fichaInjetoraCorpo').innerHTML = '<div class="empty-state">Erro ao carregar ficha.</div>';
    console.error(e);
  }
}

function renderizarFichaInjetora(nome, dados) {
  const el    = document.getElementById('fichaInjetoraCorpo');
  const lancs = dados.lancamentos || [];
  const info  = dados.info;
  const logsAlteracao = dados.logsAlteracao || [];
  const mostrarAuditoria = typeof isAdmin === 'function' && isAdmin();

  if (!lancs.length) {
    el.innerHTML = `
      ${info ? `<div style="font-size:13px;color:#64748b;margin-bottom:16px">
        ${info.tonelagem?`🏋️ ${info.tonelagem} ton`:''} ${info.fabricante?'· '+info.fabricante:''}
      </div>` : ''}
      <div class="empty-state"><div style="font-size:40px">🏭</div><div>Nenhuma manutenção registrada para esta injetora.</div></div>`;
    return;
  }

  const totalMins   = lancs.reduce((a,l)=>a+(l.minutos||0),0);
  const corretivas  = lancs.filter(l => l.tipo==='Corretiva' || l.tipo==='Manutenção Corretiva');
  const mttr        = corretivas.length>0 ? Math.round(corretivas.reduce((a,l)=>a+(l.minutos||0),0)/corretivas.length) : 0;
  const paradas     = lancs.filter(l => l.maquina_parada).length;
  const minsParadas = lancs.filter(l => l.maquina_parada).reduce((a,l)=>a+(l.minutos||0),0);

  // Moldes que já rodaram
  const moldesUnicos = [...new Set(lancs.filter(l=>l.molde).map(l=>l.molde))];

  // Por tipo
  const porTipo = {};
  lancs.forEach(l => {
    let t = l.tipo || 'Outros';
    if (t === 'Manutenção Preventiva') t = 'Preventiva';
    if (t === 'Manutenção Corretiva')  t = 'Corretiva';
    if (!porTipo[t]) porTipo[t]=0; porTipo[t]++;
  });

  // Por técnico
  const porTec = {};
  lancs.forEach(l => {
    const tecs = (l.tecnicos||'').split(',').map(t=>t.trim()).filter(Boolean);
    tecs.forEach(t => { if(!porTec[t]) porTec[t]=0; porTec[t]++; });
  });
  const topTec = Object.entries(porTec).sort((a,b)=>b[1]-a[1]).slice(0,8);

  const coresTipo = { Setup:'#0056b3', Preventiva:'#10b981', Corretiva:'#ef4444', 'Inspeção':'#f59e0b' };
  const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899'];

  let html = `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
    <div style="font-size:13px;color:#64748b">
      ${info?.tonelagem?`🏋️ <b>${info.tonelagem} ton</b> · `:''}${info?.fabricante||''}
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b">
      <div>📅 Primeiro registro: <b>${lancs[0].data.split('-').reverse().join('/')}</b></div>
      <div>🕐 Último registro: <b>${lancs[lancs.length-1].data.split('-').reverse().join('/')}</b></div>
    </div>
  </div>

  <div class="cards-row">
    <div class="metric-card" style="border-left-color:#0056b3">
      <div class="metric-icon">📋</div>
      <div class="metric-valor" style="color:#0056b3">${lancs.length}</div>
      <div class="metric-label">Manutenções</div>
    </div>
    <div class="metric-card" style="border-left-color:#10b981">
      <div class="metric-icon">⏱️</div>
      <div class="metric-valor" style="color:#10b981">${fmtMin(totalMins)}</div>
      <div class="metric-label">Tempo Total</div>
    </div>
    <div class="metric-card" style="border-left-color:#ef4444">
      <div class="metric-icon">🔧</div>
      <div class="metric-valor" style="color:${mttr>0?'#ef4444':'#94a3b8'}">${mttr} min</div>
      <div class="metric-label">MTTR</div>
      <div class="metric-sub">${corretivas.length} corretiva(s)</div>
    </div>
    <div class="metric-card" style="border-left-color:#f59e0b">
      <div class="metric-icon">🔴</div>
      <div class="metric-valor" style="color:#f59e0b">${paradas}</div>
      <div class="metric-label">Paradas Não Planejadas</div>
      <div class="metric-sub">${fmtMin(minsParadas)} parado</div>
    </div>
  </div>

  <div class="graficos-2col">
    <div class="grafico-card">
      <div class="grafico-titulo">🗂️ Manutenções por Tipo</div>
      <div style="height:240px"><canvas id="chartInjTipos"></canvas></div>
    </div>
    <div class="grafico-card">
      <div class="grafico-titulo">👤 Top Técnicos</div>
      <div style="height:240px"><canvas id="chartInjTecnicos"></canvas></div>
    </div>
  </div>

  <div class="card">
    <div style="font-weight:700;color:#1e3a5f;font-size:14px;margin-bottom:12px">🔩 Moldes que já rodaram nesta injetora (${moldesUnicos.length})</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${moldesUnicos.length
        ? moldesUnicos.map(m => `<span style="background:#f1f5f9;color:#1e3a5f;padding:4px 10px;border-radius:8px;font-size:12px;cursor:pointer"
            onclick="fecharFichaInjetora();abrirFichaMolde('${m.replace(/'/g,"\\'")}')">${m}</span>`).join('')
        : '<span style="color:#94a3b8;font-size:13px">Nenhum molde registrado</span>'}
    </div>
  </div>

  ${mostrarAuditoria ? `
  <div class="card" style="border-left:4px solid #7c3aed">
    <div style="font-weight:700;color:#1e3a5f;font-size:14px;margin-bottom:12px">📜 Histórico de Alterações Administrativas (Admin)</div>
    ${typeof renderizarHistoricoItemHTML === 'function' ? renderizarHistoricoItemHTML(logsAlteracao) : '<div style="color:#94a3b8;font-size:12px">Indisponível.</div>'}
  </div>` : ''}

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-weight:700;color:#1e3a5f;font-size:14px">📋 Histórico de Manutenções</div>
      <button class="btn-success" style="padding:5px 12px;font-size:11px" onclick="exportarFichaInjetoraCSV('${nome.replace(/'/g,"\\'")}')">📥 CSV</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Atividade</th><th>Molde</th><th>Técnico(s)</th><th>Horas</th><th>Flags</th></tr></thead>
        <tbody>
          ${lancs.slice().reverse().map(l => {
            const corT = coresTipo[l.tipo==='Manutenção Preventiva'?'Preventiva':l.tipo==='Manutenção Corretiva'?'Corretiva':l.tipo] || '#64748b';
            const flags = [
              l.maquina_parada?'🔴 Parada':'',
              l.tem_os?'📋 OS':''
            ].filter(Boolean).join(' ');
            return `<tr>
              <td><b>${l.data?l.data.split('-').reverse().join('/'):'—'}</b></td>
              <td><span style="background:${corT}20;color:${corT};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${l.tipo}</span></td>
              <td style="font-size:12px">${l.atividade||'—'}</td>
              <td style="font-size:12px">${l.molde||'—'}</td>
              <td style="font-size:12px">${(l.tecnicos||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(t):t).join(', ') || '—'}</td>
              <td style="color:#10b981;font-weight:700">${fmtMin(l.minutos||0)}</td>
              <td style="font-size:11px">${flags||'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  el.innerHTML = html;

  setTimeout(() => {
    const tipoEnt = Object.entries(porTipo);
    if (_chartsFichaInjetora['tipos']) _chartsFichaInjetora['tipos'].destroy();
    const ctx1 = document.getElementById('chartInjTipos');
    if (ctx1) _chartsFichaInjetora['tipos'] = new Chart(ctx1, {
      type:'doughnut',
      data:{ labels:tipoEnt.map(e=>e[0]), datasets:[{ data:tipoEnt.map(e=>e[1]), backgroundColor:tipoEnt.map(([t])=>coresTipo[t]||'#64748b'), borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom'}, datalabels:{color:'#fff',font:{weight:'bold',size:12},
          formatter:(v,ctx2)=>{ const t=ctx2.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }} }
      }
    });

    if (_chartsFichaInjetora['tecnicos']) _chartsFichaInjetora['tecnicos'].destroy();
    const ctx2 = document.getElementById('chartInjTecnicos');
    if (ctx2 && topTec.length) _chartsFichaInjetora['tecnicos'] = new Chart(ctx2, {
      type:'bar',
      data:{ labels:topTec.map(e=>e[0]), datasets:[{ data:topTec.map(e=>e[1]), backgroundColor:paleta, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'}} },
        scales:{ x:{beginAtZero:true,ticks:{stepSize:1}} }
      }
    });
  }, 100);
}

function fecharFichaInjetora() {
  document.getElementById('modalFichaInjetoraWrap')?.remove();
  Object.values(_chartsFichaInjetora).forEach(c => c?.destroy());
  _chartsFichaInjetora = {};
}

function exportarFichaInjetoraCSV(nome) {
  if (!_dadosFichaInjetora || !_dadosFichaInjetora.lancamentos.length) return toast('Nenhum dado para exportar.','erro');
  const linhas = [['Data','Tipo','Atividade','Molde','Técnicos','Minutos','Máquina Parada','Tem OS','Descrição'].join(';')];
  _dadosFichaInjetora.lancamentos.forEach(l => linhas.push([
    l.data, l.tipo, l.atividade||'', l.molde||'', l.tecnicos||'',
    l.minutos||0, l.maquina_parada?'SIM':'NAO', l.tem_os?'SIM':'NAO',
    (l.descricao||'').replace(/;/g,',')
  ].join(';')));
  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `Ficha_Injetora_${nome.replace(/\s/g,'_')}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!','sucesso');
}
