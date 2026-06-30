// ==========================================
// 👤 FICHA-FUNCIONARIO.JS — Histórico e Gráficos
// ==========================================

var _dadosFichaFunc = null;
var _chartsFichaFunc = {};

// Busca todos os lançamentos do funcionário em todos os setores
async function buscarHistoricoFuncionario(nome) {
  const [lancsFerramentaria, lancsProd] = await Promise.all([
    db._get('lancamentos', 'funcionario=eq.' + encodeURIComponent(nome) + '&order=data.asc', '*'),
    db._get('prod_lancamentos', 'order=data.asc', '*') // busca todos, filtra técnico depois (campo texto)
  ]);

  const prodFiltrado = (lancsProd || []).filter(l => {
    const tecs = (l.tecnicos || '').split(',').map(t => t.trim());
    return tecs.includes(nome);
  });

  return {
    ferramentaria: lancsFerramentaria || [],
    producao: prodFiltrado
  };
}

// Renderiza a seção de histórico dentro da ficha (chamado pelo rh.js)
async function renderizarHistoricoNaFicha(nome, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando histórico...</span></div>';

  try {
    const dados = await buscarHistoricoFuncionario(nome);
    _dadosFichaFunc = dados;
    const { ferramentaria, producao } = dados;
    const totalLancs = ferramentaria.length + producao.length;

    if (!totalLancs) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">Nenhum lançamento registrado.</div>';
      return;
    }

    const minsFerr = ferramentaria.reduce((a,l)=>a+(l.minutos||0),0);
    const minsProd = producao.reduce((a,l)=>a+(l.minutos||0),0);

    const porSetor = {};
    ferramentaria.forEach(l => { const s=l.setor||'Outros'; if(!porSetor[s]) porSetor[s]=0; porSetor[s]+=l.minutos||0; });
    if (minsProd > 0) porSetor['Produção'] = minsProd;

    const jobsUnicos = new Set([
      ...ferramentaria.filter(l=>l.job).map(l=>l.job),
      ...producao.filter(l=>l.molde).map(l=>l.molde)
    ]);

    // Por mês
    const porMes = {};
    [...ferramentaria, ...producao].forEach(l => {
      if (!l.data) return;
      const mes = l.data.substring(0,7); // YYYY-MM
      if (!porMes[mes]) porMes[mes]=0;
      porMes[mes] += l.minutos||0;
    });
    const mesesOrdenados = Object.keys(porMes).sort().slice(-6); // últimos 6 meses com dados

    const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', 'Produção':'#10b981' };
    const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐', 'Produção':'🏭' };

    let html = `
    <div class="cards-row">
      <div class="metric-card" style="border-left-color:#10b981">
        <div class="metric-icon">⏱️</div>
        <div class="metric-valor" style="color:#10b981">${fmtMin(minsFerr+minsProd)}</div>
        <div class="metric-label">Total de Horas</div>
      </div>
      <div class="metric-card" style="border-left-color:#0056b3">
        <div class="metric-icon">📋</div>
        <div class="metric-valor" style="color:#0056b3">${totalLancs}</div>
        <div class="metric-label">Lançamentos</div>
      </div>
      <div class="metric-card" style="border-left-color:#8b5cf6">
        <div class="metric-icon">🔩</div>
        <div class="metric-valor" style="color:#8b5cf6">${jobsUnicos.size}</div>
        <div class="metric-label">Moldes/Jobs Distintos</div>
      </div>
    </div>

    <div class="graficos-2col">
      <div class="grafico-card">
        <div class="grafico-titulo">🗂️ Horas por Setor</div>
        <div style="height:220px"><canvas id="chartFuncSetores"></canvas></div>
      </div>
      <div class="grafico-card">
        <div class="grafico-titulo">📅 Evolução Mensal</div>
        <div style="height:220px"><canvas id="chartFuncMeses"></canvas></div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:13px">📋 Últimos Lançamentos</div>
      <button class="btn-success" style="padding:5px 12px;font-size:11px" onclick="exportarHistoricoFuncionario('${nome.replace(/'/g,"\\'")}')">📥 CSV</button>
    </div>
    <div class="table-wrap" style="max-height:300px;overflow-y:auto">
      <table>
        <thead><tr><th>Data</th><th>Setor</th><th>Job/Molde</th><th>Tipo</th><th>Horas</th></tr></thead>
        <tbody>`;

    const todosOrdenados = [
      ...ferramentaria.map(l => ({ data:l.data, setor:l.setor, job:l.job, tipo:l.tipo, minutos:l.minutos })),
      ...producao.map(l => ({ data:l.data, setor:'Produção', job:l.molde, tipo:l.tipo, minutos:l.minutos }))
    ].sort((a,b) => (b.data||'').localeCompare(a.data||'')).slice(0,50);

    todosOrdenados.forEach(l => {
      html += `<tr>
        <td><b>${l.data?l.data.split('-').reverse().join('/'):'—'}</b></td>
        <td><span style="color:${cors[l.setor]||'#64748b'};font-weight:600;font-size:12px">${icos[l.setor]||'🏭'} ${l.setor}</span></td>
        <td style="font-size:12px">${l.job||'—'}</td>
        <td style="font-size:12px">${l.tipo||'—'}</td>
        <td style="color:#10b981;font-weight:700">${fmtMin(l.minutos||0)}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;
    el.innerHTML = html;

    setTimeout(() => {
      const setorEnt = Object.entries(porSetor);
      const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b'];
      if (_chartsFichaFunc['setores']) _chartsFichaFunc['setores'].destroy();
      const ctx1 = document.getElementById('chartFuncSetores');
      if (ctx1) _chartsFichaFunc['setores'] = new Chart(ctx1, {
        type:'doughnut',
        data:{ labels:setorEnt.map(e=>e[0]), datasets:[{ data:setorEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:setorEnt.map(([s])=>cors[s]||'#64748b'), borderWidth:2, borderColor:'#fff' }] },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{position:'bottom',labels:{font:{size:11}}}, datalabels:{color:'#fff',font:{weight:'bold',size:12},
            formatter:(v,ctx2)=>{ const t=ctx2.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }} }
        }
      });

      if (_chartsFichaFunc['meses']) _chartsFichaFunc['meses'].destroy();
      const ctx2 = document.getElementById('chartFuncMeses');
      const mesesFmt = mesesOrdenados.map(m => {
        const [ano,mes] = m.split('-');
        const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        return nomes[parseInt(mes)-1] + '/' + ano.slice(2);
      });
      if (ctx2 && mesesOrdenados.length) _chartsFichaFunc['meses'] = new Chart(ctx2, {
        type:'bar',
        data:{ labels:mesesFmt, datasets:[{ data:mesesOrdenados.map(m=>Math.round(porMes[m]/60*10)/10), backgroundColor:'#0056b3', borderRadius:6 }] },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'} },
          scales:{ y:{beginAtZero:true} }
        }
      });
    }, 100);

  } catch(e) {
    el.innerHTML = '<div class="empty-state">Erro ao carregar histórico.</div>';
    console.error(e);
  }
}

function exportarHistoricoFuncionario(nome) {
  if (!_dadosFichaFunc) return toast('Nenhum dado para exportar.','erro');
  const { ferramentaria, producao } = _dadosFichaFunc;
  const linhas = [['Data','Setor','Job/Molde','Tipo','Minutos','Descrição'].join(';')];

  ferramentaria.forEach(l => linhas.push([
    l.data, l.setor, l.job||'', l.tipo||'', l.minutos||0, (l.descricao||'').replace(/;/g,',')
  ].join(';')));

  producao.forEach(l => linhas.push([
    l.data, 'Produção', l.molde||'', l.tipo||'', l.minutos||0,
    [l.atividade,l.descricao].filter(Boolean).join(' — ').replace(/;/g,',')
  ].join(';')));

  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `Historico_${nome.replace(/\s/g,'_')}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!','sucesso');
}
