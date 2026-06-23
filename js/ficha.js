// ==========================================
// 📄 FICHA.JS — Ficha do Molde
// ==========================================

var _dadosFicha = null;
var _lancsFicha = [];
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
  elVazio.style.display = 'none';
  elConteudo.innerHTML = '<div class="loader-inline"><div class="spinner-sm"></div><span>Carregando ficha...</span></div>';
  elConteudo.style.display = 'block';
  try {
    const res = await db.buscarFicha(job);
    _dadosFicha = res; _lancsFicha = res.lancamentos || [];
    if (!_lancsFicha.length) {
      elConteudo.style.display = 'none';
      elVazio.style.display = 'block';
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
  const lancs  = res.lancamentos || [];
  const hist   = res.statusHistory || [];
  const el     = document.getElementById('fichaConteudo');
  const status = hist.length ? hist[hist.length-1].status : (lancs[lancs.length-1]?.status || 'Em andamento');
  const corS   = corStatus(status);
  const bgS    = status==='Finalizado'?'#d1fae5':status==='Pausado'?'#fef3c7':'#fff7ed';
  const totalMins = lancs.reduce((a,l)=>a+(l.minutos||0),0);
  const porSetor  = {};
  lancs.forEach(l => { const s=l.setor||'Outros'; if (!porSetor[s]) porSetor[s]=0; porSetor[s]+=l.minutos||0; });
  const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
  const icos = { Usinagem:'⚙️', Bancada:'🛠️', Projeto:'📐' };

  let html = `
  <div class="card" style="border-left:4px solid ${corS}">
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px">
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:6px">FICHA DO MOLDE</div>
        <div style="font-size:24px;font-weight:700;color:#1e3a5f;margin-bottom:8px">${job}</div>
        <span style="display:inline-flex;align-items:center;gap:6px;background:${bgS};color:${corS};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;border:1px solid ${corS}">${icoStatus(status)} ${status}</span>
      </div>
      <div style="text-align:right;font-size:12px;color:#64748b">
        <div>📅 Primeiro: <b>${lancs[0].data.split('-').reverse().join('/')}</b></div>
        <div>🕐 Último: <b>${lancs[lancs.length-1].data.split('-').reverse().join('/')}</b></div>
        <div>🔄 Intervenções: <b>${hist.length||1}</b></div>
      </div>
    </div>
  </div>
  <div class="cards-row">
    <div class="metric-card" style="border-left-color:#10b981"><div class="metric-icon">⏱️</div><div class="metric-valor" style="color:#10b981">${fmtMin(totalMins)}</div><div class="metric-label">Total de Horas</div></div>
    ${Object.entries(porSetor).map(([s,m])=>`<div class="metric-card" style="border-left-color:${cors[s]||'#64748b'}"><div class="metric-icon">${icos[s]||'🏭'}</div><div class="metric-valor" style="color:${cors[s]||'#64748b'}">${fmtMin(m)}</div><div class="metric-label">${s}</div></div>`).join('')}
    <div class="metric-card" style="border-left-color:#f59e0b"><div class="metric-icon">📋</div><div class="metric-valor" style="color:#f59e0b">${lancs.length}</div><div class="metric-label">Lançamentos</div></div>
  </div>
  <div class="graficos-2col">
    <div class="grafico-card"><div class="grafico-titulo">🗂️ Horas por Setor</div><div class="grafico-wrap" style="height:250px"><canvas id="chartFichaSetores"></canvas></div></div>
    <div class="grafico-card"><div class="grafico-titulo">👤 Horas por Técnico</div><div class="grafico-wrap" style="height:250px"><canvas id="chartFichaTecnicos"></canvas></div></div>
  </div>
  <div class="card">
    <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:16px">📅 Linha do Tempo</div>
    <div id="fichaTimeline"></div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">☷ Histórico Completo</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="fichaFiltroSetor" onchange="filtrarFicha()" style="border-color:#10b981">
          <option value="Todos">Todos os Setores</option>
          <option value="Usinagem">⚙️ Usinagem</option>
          <option value="Bancada">🛠️ Bancada</option>
          <option value="Projeto">📐 Projeto</option>
        </select>
        <div id="fichaFiltroMaqDiv" style="display:none"><select id="fichaFiltroMaq" onchange="aplicarFiltrosFicha()"><option value="Todas">Todas as Máquinas</option></select></div>
        <div id="fichaFiltroTipoDiv" style="display:none"><select id="fichaFiltroTipo" onchange="aplicarFiltrosFicha()"><option value="Todos">Todos os Serviços</option></select></div>
        <div id="fichaFiltroAreaDiv" style="display:none"><select id="fichaFiltroArea" onchange="aplicarFiltrosFicha()"><option value="Todas">Todas as Áreas</option></select></div>
        <button class="btn-success" onclick="exportarFichaCSV()" style="padding:6px 14px;font-size:12px">📥 CSV</button>
      </div>
    </div>
    <div id="fichaResumo" style="display:none;margin-bottom:12px" class="resumo-bar"></div>
    <div class="table-wrap">
      <table><thead><tr><th>Data</th><th>Setor</th><th>Técnico</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Horas</th><th>Descrição</th></tr></thead>
      <tbody id="tbodyFicha"></tbody></table>
    </div>
  </div>`;

  el.innerHTML = html;

  // Gráficos
  const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b','#ef4444'];
  setTimeout(() => {
    const setorEnt = Object.entries(porSetor);
    if (_chartsFicha['setores']) _chartsFicha['setores'].destroy();
    const ctx1 = document.getElementById('chartFichaSetores');
    if (ctx1) _chartsFicha['setores'] = new Chart(ctx1, { type:'doughnut', data:{ labels:setorEnt.map(e=>e[0]), datasets:[{ data:setorEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderWidth:2, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom'}, datalabels:{color:'#fff',font:{weight:'bold',size:13},formatter:(v,ctx2)=>{ const t=ctx2.dataset.data.reduce((a,b)=>a+b,0); return t>0?Math.round(v/t*100)+'%':''; }} } } });
    const porFunc = {};
    lancs.forEach(l => { const f=l.funcionario||'-'; if (!porFunc[f]) porFunc[f]=0; porFunc[f]+=l.minutos||0; });
    const funcEnt = Object.entries(porFunc).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if (_chartsFicha['tecnicos']) _chartsFicha['tecnicos'].destroy();
    const ctx2 = document.getElementById('chartFichaTecnicos');
    if (ctx2) _chartsFicha['tecnicos'] = new Chart(ctx2, { type:'bar', data:{ labels:funcEnt.map(e=>e[0]), datasets:[{ data:funcEnt.map(e=>Math.round(e[1]/60*10)/10), backgroundColor:paleta, borderRadius:6 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'},formatter:v=>v+'h'} }, scales:{ y:{beginAtZero:true} } } });
  }, 100);

  // Timeline
  renderizarTimeline(hist, lancs);
  renderizarTabelaFicha(lancs);
}

function renderizarTimeline(hist, lancs) {
  const el = document.getElementById('fichaTimeline');
  if (!el) return;
  if (!hist.length) {
    const porData = {};
    lancs.forEach(l => { if (!porData[l.data]) porData[l.data]={setores:{},count:0}; if (!porData[l.data].setores[l.setor]) porData[l.data].setores[l.setor]=0; porData[l.data].setores[l.setor]++; porData[l.data].count++; });
    const cors = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6' };
    el.innerHTML = '<div style="position:relative;padding-left:32px">' +
      Object.keys(porData).sort().map((dt,i,arr) => `<div style="position:relative;margin-bottom:16px">
        ${i<arr.length-1?'<div style="position:absolute;left:-22px;top:20px;width:2px;height:calc(100% + 8px);background:#e2e8f0"></div>':''}
        <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 0 0 2px #10b981"></div>
        <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;border-left:3px solid #10b981;padding:12px 16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <b style="color:#1e3a5f">📅 ${dt.split('-').reverse().join('/')}</b>
            <span style="font-size:11px;color:#94a3b8">${porData[dt].count} lançamento(s)</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.entries(porData[dt].setores).map(([s,n])=>`<span style="background:#f1f5f9;color:${cors[s]||'#64748b'};font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600">${s}: ${n}</span>`).join('')}
          </div>
        </div>
      </div>`).join('') + '</div>';
    return;
  }
  el.innerHTML = '<div style="position:relative;padding-left:32px">' +
    hist.map((h,i) => {
      const cor = corStatus(h.status); const bg = h.status==='Finalizado'?'#d1fae5':h.status==='Pausado'?'#fef3c7':'#fff7ed';
      const periodo = h.data_inicio ? h.data_inicio.split('-').reverse().join('/') + (h.data_fim?' → '+h.data_fim.split('-').reverse().join('/'):'') : '';
      return `<div style="position:relative;margin-bottom:20px">
        ${i<hist.length-1?'<div style="position:absolute;left:-22px;top:20px;width:2px;height:calc(100% + 8px);background:#e2e8f0"></div>':''}
        <div style="position:absolute;left:-30px;top:4px;width:16px;height:16px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 0 0 2px ${cor}"></div>
        <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;border-left:3px solid ${cor};padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div><b style="color:#1e3a5f">Intervenção ${h.intervencao}</b>&nbsp;&nbsp;<span style="background:${bg};color:${cor};font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600">${icoStatus(h.status)} ${h.status}</span></div>
            <span style="font-size:11px;color:#94a3b8">${periodo}</span>
          </div>
          ${h.descricao?`<div style="font-size:12px;color:#64748b;line-height:1.5">📝 ${h.descricao}</div>`:''}
        </div>
      </div>`;
    }).join('') + '</div>';
}

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
    <td>${l.horaInicio||'—'}</td>
    <td>${l.horaFim||'—'}</td>
    <td style="color:#10b981;font-weight:bold">${l.hrProd||'—'}</td>
    <td style="font-size:12px;color:#64748b">${l.descricao||'—'}</td>
  </tr>`).join('');
}

function filtrarFicha() {
  const setor = document.getElementById('fichaFiltroSetor').value;
  const maqDiv  = document.getElementById('fichaFiltroMaqDiv');
  const tipoDiv = document.getElementById('fichaFiltroTipoDiv');
  const areaDiv = document.getElementById('fichaFiltroAreaDiv');
  if (maqDiv)  maqDiv.style.display  = setor==='Usinagem'?'':'none';
  if (tipoDiv) tipoDiv.style.display = setor==='Bancada' ?'':'none';
  if (areaDiv) areaDiv.style.display = setor==='Projeto' ?'':'none';
  if (setor === 'Usinagem') {
    const sel = document.getElementById('fichaFiltroMaq');
    if (sel) { const mqs = [...new Set(_lancsFicha.filter(l=>l.setor==='Usinagem'&&l.maquina).map(l=>l.maquina))]; sel.innerHTML = '<option value="Todas">Todas as Máquinas</option>' + mqs.map(m=>`<option value="${m}">${m}</option>`).join(''); }
  } else if (setor === 'Bancada') {
    const sel = document.getElementById('fichaFiltroTipo');
    if (sel) { const ts = [...new Set(_lancsFicha.filter(l=>l.setor==='Bancada'&&l.tipo).map(l=>l.tipo))]; sel.innerHTML = '<option value="Todos">Todos os Serviços</option>' + ts.map(t=>`<option value="${t}">${t}</option>`).join(''); }
  } else if (setor === 'Projeto') {
    const sel = document.getElementById('fichaFiltroArea');
    if (sel) { const as = [...new Set(_lancsFicha.filter(l=>l.setor==='Projeto'&&l.area).map(l=>l.area))]; sel.innerHTML = '<option value="Todas">Todas as Áreas</option>' + as.map(a=>`<option value="${a}">${a}</option>`).join(''); }
  }
  ['fichaFiltroMaq','fichaFiltroTipo','fichaFiltroArea'].forEach(id => { const s=document.getElementById(id); if(s) s.selectedIndex=0; });
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
    let partes = [`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">📋 <b>${filtrado.length} lançamentos</b></span>`];
    if (totalMins>0) partes.push(`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bae6fd;font-size:13px;color:#0369a1">⏱️ <b>${fmtMin(totalMins)}</b></span>`);
    elRes.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><span style="font-size:13px;font-weight:600;color:#1e3a5f">Resultado:</span>' + partes.join('') + '</div>';
    elRes.style.display = 'block';
  }
  renderizarTabelaFicha(filtrado);
}

function exportarFichaCSV() {
  if (!_lancsFicha.length) return toast('Nenhum dado para exportar.', 'erro');
  const job = document.getElementById('fichaJobInput').value;
  const linhas = [['Data','Setor','Técnico','Tipo','Início','Fim','Horas','Descrição'].join(';')];
  _lancsFicha.forEach(l => linhas.push([l.data,l.setor,l.funcionario,l.tipo||'',l.horaInicio||'',l.horaFim||'',l.hrProd||'',(l.descricao||'').replace(/;/g,',')].join(';')));
  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`Ficha_${job.replace(/\s/g,'_')}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!', 'sucesso');
}
