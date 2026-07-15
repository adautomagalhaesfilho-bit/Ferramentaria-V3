// ==========================================
// 🔎 HISTORICO.JS — V3 com Produção
// ==========================================

var _dadosHistorico = [];
var _setorHistorico = 'Usinagem';

function inicializarHistorico() {
  const hoje = new Date();
  const ini  = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay() + 1);
  const fDate = d => d.toISOString().split('T')[0];
  document.getElementById('histIni').value = fDate(ini);
  document.getElementById('histFim').value = fDate(hoje);
  if (_listas) atualizarFiltrosHistorico();
  else setTimeout(atualizarFiltrosHistorico, 500);
}

async function atualizarFiltrosHistorico() {
  const setor   = document.getElementById('histSetor').value;
  _setorHistorico = setor;
  const selFunc = document.getElementById('histFunc');
  const selTipo = document.getElementById('histTipo');
  if (!_listas) return;

  // Funcionários por setor
  let funcs = [];
  if      (setor === 'Usinagem')  funcs = _listas.funcionarios  || [];
  else if (setor === 'Bancada')   funcs = _listas.funcBancada   || [];
  else if (setor === 'Projeto')   funcs = _listas.funcProjeto   || [];
  else if (setor === 'Producao')  funcs = _listas.funcProducao  || [];

  selFunc.innerHTML = '<option value="Todos">Todos os Funcionários</option>' +
    funcs.map(f=>`<option value="${f}">${f}</option>`).join('');

  // Tipos por setor
  selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>';
  try {
    if (setor === 'Usinagem') {
      const tipos = _listas.tipos || [];
      selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>' +
        tipos.map(t=>`<option value="${t}">${t}</option>`).join('');

    } else if (setor === 'Bancada') {
      const tiposBancada = _listas.tiposBancada || [];
      selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>' +
        tiposBancada.map(t=>`<option value="${t}">${t}</option>`).join('');

    } else if (setor === 'Projeto') {
      const areasProj = _listas.areasProj     || [];
      const catsProj  = _listas.categoriasProj || [];
      const opcoes = [...areasProj, ...catsProj].filter((v,i,a)=>a.indexOf(v)===i).sort();
      selTipo.innerHTML = '<option value="Todos">Todos</option>' +
        opcoes.map(t=>`<option value="${t}">${t}</option>`).join('');

    } else if (setor === 'Producao') {
      // Tipos de produção vêm de prod_categorias setor=Producao
      const tiposProd = _listas.tiposProd || [];
      selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>' +
        tiposProd.map(t=>`<option value="${t}">${t}</option>`).join('');
    }
  } catch(e) {
    console.error('Erro ao carregar tipos:', e);
  }

  document.getElementById('histTbody').innerHTML =
    '<tr><td colspan="8" class="empty-msg">Use os filtros acima para buscar.</td></tr>';
  document.getElementById('histResumo').style.display = 'none';

  // Campo de Injetora só faz sentido pra Produção
  const grupoInjetora = document.getElementById('grupoHistInjetora');
  if (grupoInjetora) grupoInjetora.style.display = (setor === 'Producao') ? '' : 'none';
  if (setor === 'Producao' && _listas) {
    setupAC('histInjetora', 'histInjetoraList', (_injetoras||[]).map(i=>i.nome));
  }
}

async function buscarHistorico() {
  const setor = document.getElementById('histSetor').value;
  const ini   = document.getElementById('histIni').value;
  const fim   = document.getElementById('histFim').value;
  const func  = document.getElementById('histFunc').value;
  const tipo  = document.getElementById('histTipo').value;
  const job   = document.getElementById('histJob').value;
  const injetora = document.getElementById('histInjetora')?.value?.trim() || '';

  if (!ini||!fim) return toast('Informe o período.','erro');
  if (ini>fim)    return toast('Data inicial maior que a final.','erro');

  const loader = document.getElementById('histLoader');
  if (loader) loader.style.display = 'flex';
  document.getElementById('histTbody').innerHTML = '';
  document.getElementById('histResumo').style.display = 'none';

  try {
    if (setor === 'Producao') {
      // Busca de prod_lancamentos
      const res = await db.buscarProdPeriodo(ini, fim,
        'Todas',
        tipo !== 'Todos' ? tipo : null
      );
      // Filtra por técnico se necessário (campo tecnicos é array/texto)
      let dados = res || [];
      if (func && func !== 'Todos') {
        dados = dados.filter(l => {
          const tecs = Array.isArray(l.tecnicos) ? l.tecnicos : [l.tecnicos];
          return tecs.some(t => t === func);
        });
      }
      if (job) {
        dados = dados.filter(l => l.molde && l.molde.toUpperCase().includes(job.toUpperCase()));
      }
      if (injetora) {
        dados = dados.filter(l => l.injetora && l.injetora.toUpperCase().includes(injetora.toUpperCase()));
      }
      _dadosHistorico = dados;
      renderizarHistoricoProducao(dados, ini, fim);
    } else {
      // Busca de lancamentos (Usinagem, Bancada, Projeto)
      _dadosHistorico = await db.buscarLancamentosPeriodo(setor, ini, fim, func, job, tipo);
      renderizarHistorico(_dadosHistorico, setor);
    }
  } catch(e) {
    document.getElementById('histTbody').innerHTML =
      '<tr><td colspan="8" class="empty-msg">Erro ao buscar.</td></tr>';
    toast('Erro ao buscar histórico.','erro');
    console.error(e);
  }
  if (loader) loader.style.display = 'none';
}

// ==========================================
// RENDERIZAR — Usinagem / Bancada / Projeto
// ==========================================
function renderizarHistorico(res, setor) {
  const thead = document.getElementById('histThead');
  const tbody = document.getElementById('histTbody');
  const resumo = document.getElementById('histResumo');

  if (!res.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum lançamento encontrado.</td></tr>';
    resumo.style.display = 'none';
    return;
  }

  const cabPadrao = `<tr>
    <th>Data</th>
    <th>Técnico</th>
    <th>${setor==='Usinagem'?'Máquina / Tipo':setor==='Bancada'?'Atividade':'Área / Categoria'}</th>
    <th>Job</th>
    <th>Início</th>
    <th>Fim</th>
    <th>Prod.</th>
    <th>Descrição / Status</th>
  </tr>`;
  thead.innerHTML = cabPadrao;

  const totalMins = res.reduce((a,l)=>a+(l.minutos||0),0);

  tbody.innerHTML = res.map(l => {
    const dt   = l.data ? l.data.split('-').reverse().join('/') : '—';
    const hr1  = l.horaInicio || '—';
    const hr2  = l.horaFim    || '—';
    const prod = l.hrProd
      ? `<span style="color:#10b981;font-weight:700">${l.hrProd}</span>`
      : '—';
    let col3 = '', desc = l.descricao || '—', status = '';

    if (setor === 'Usinagem') {
      col3 = `<span style="font-size:12px"><b>${l.maquina||'—'}</b>${l.tipo?`<br><span style="color:#64748b;font-size:11px">${l.tipo}</span>`:''}</span>`;
    } else if (setor === 'Bancada') {
      col3 = l.tipo || '—';
    } else {
      col3 = `<span style="font-size:12px">${l.area?`<b>${l.area}</b><br>`:''}<span style="color:#64748b;font-size:11px">${l.tipo||'—'}</span></span>`;
      const cor = corStatus(l.status);
      status = `<span style="color:${cor};font-weight:600;font-size:12px">${icoStatus(l.status)} ${l.status||'—'}</span>`;
    }

    return `<tr>
      <td><b>${dt}</b></td>
      <td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(l.funcionario):(l.funcionario||'—')}</td>
      <td>${col3}</td>
      <td><b>${l.job||'—'}</b></td>
      <td style="font-size:12px">${hr1}</td>
      <td style="font-size:12px">${hr2}</td>
      <td>${prod}</td>
      <td style="font-size:12px;color:#64748b">${status||desc}</td>
    </tr>`;
  }).join('');

  // Totais por funcionário e job
  if (setor !== 'Projeto') {
    const porFunc = {}, porJob = {};
    res.forEach(l => {
      const f = l.funcionario||'—';
      if (!porFunc[f]) porFunc[f]=0; porFunc[f]+=l.minutos||0;
      const j = l.job||'—';
      if (!porJob[j])  porJob[j]=0;  porJob[j]+=l.minutos||0;
    });
    tbody.innerHTML += `<tr><td colspan="8" style="background:#e0f2fe;padding:8px 12px;font-size:12px;font-weight:700;color:#0369a1;border-top:2px solid #bae6fd">👤 TOTAIS POR FUNCIONÁRIO</td></tr>`;
    Object.entries(porFunc).sort((a,b)=>b[1]-a[1]).forEach(([f,m]) => {
      tbody.innerHTML += `<tr style="background:#f0f9ff"><td colspan="6" style="font-size:12px;color:#0369a1;padding:5px 12px"><b>${f}</b></td><td style="font-size:12px;font-weight:700;color:#0369a1">${fmtMin(m)}</td><td></td></tr>`;
    });
    tbody.innerHTML += `<tr><td colspan="8" style="background:#f0fdf4;padding:8px 12px;font-size:12px;font-weight:700;color:#059669;border-top:2px solid #bbf7d0">📦 TOTAIS POR JOB</td></tr>`;
    Object.entries(porJob).sort((a,b)=>b[1]-a[1]).forEach(([j,m]) => {
      tbody.innerHTML += `<tr style="background:#f0fdf4"><td colspan="6" style="font-size:12px;color:#059669;padding:5px 12px"><b>${j}</b></td><td style="font-size:12px;font-weight:700;color:#059669">${fmtMin(m)}</td><td></td></tr>`;
    });
  }

  resumo.innerHTML = `
    <span style="font-size:13px;font-weight:600;color:#1e3a5f">📊 Resumo:</span>
    <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #c7d2fe;font-size:13px;color:#4338ca">📋 <b>${res.length} lançamentos</b></span>
    ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">⏱️ <b>${fmtMin(totalMins)}</b></span>`:''}`;
  resumo.style.display = 'flex';
}

// ==========================================
// RENDERIZAR — Produção (prod_lancamentos)
// ==========================================
function renderizarHistoricoProducao(res, ini, fim) {
  const thead = document.getElementById('histThead');
  const tbody = document.getElementById('histTbody');
  const resumo = document.getElementById('histResumo');

  if (!res.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum lançamento encontrado.</td></tr>';
    resumo.style.display = 'none';
    return;
  }

  thead.innerHTML = `<tr>
    <th>Data</th>
    <th>Técnico(s)</th>
    <th>Injetora</th>
    <th>Tipo</th>
    <th>Atividade</th>
    <th>Molde</th>
    <th>Prod.</th>
    <th>Descrição</th>
  </tr>`;

  const totalMins = res.reduce((a,l)=>a+(l.minutos||0),0);

  tbody.innerHTML = res.map(l => {
    const dt   = l.data ? l.data.split('-').reverse().join('/') : '—';
    const tecsArr = Array.isArray(l.tecnicos) ? l.tecnicos : (l.tecnicos ? l.tecnicos.split(',').map(t=>t.trim()) : []);
    const tecs = tecsArr.length ? tecsArr.map(t=>typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(t):t).join(', ') : '—';
    const mins = l.minutos || 0;
    const hrProd = mins > 0 ? fmtMin(mins) : '—';
    const flags = [
      l.maquina_parada ? '🔴 Maq. Parada' : '',
      l.tem_os ? `📋 OS: ${l.numero_os||''}` : ''
    ].filter(Boolean).join(' ');

    return `<tr>
      <td><b>${dt}</b></td>
      <td style="font-size:12px">${tecs}</td>
      <td><b>${l.injetora||'—'}</b></td>
      <td><span style="background:#d1fae5;color:#059669;font-size:11px;padding:2px 8px;border-radius:8px;font-weight:600">${l.tipo||'—'}</span></td>
      <td style="font-size:12px">${l.atividade||'—'}</td>
      <td><b>${l.molde||'—'}</b></td>
      <td><span style="color:#10b981;font-weight:700">${hrProd}</span></td>
      <td style="font-size:12px;color:#64748b">${l.descricao||''} ${flags}</td>
    </tr>`;
  }).join('');

  // Totais por injetora e tipo
  const porInjetora = {}, porTipo = {};
  res.forEach(l => {
    const inj = l.injetora||'—';
    if (!porInjetora[inj]) porInjetora[inj]=0; porInjetora[inj]+=l.minutos||0;
    const t = l.tipo||'—';
    if (!porTipo[t]) porTipo[t]=0; porTipo[t]+=l.minutos||0;
  });

  tbody.innerHTML += `<tr><td colspan="8" style="background:#e0f2fe;padding:8px 12px;font-size:12px;font-weight:700;color:#0369a1;border-top:2px solid #bae6fd">🏭 TOTAIS POR INJETORA</td></tr>`;
  Object.entries(porInjetora).sort((a,b)=>b[1]-a[1]).forEach(([inj,m]) => {
    tbody.innerHTML += `<tr style="background:#f0f9ff"><td colspan="6" style="font-size:12px;color:#0369a1;padding:5px 12px"><b>${inj}</b></td><td style="font-size:12px;font-weight:700;color:#0369a1">${fmtMin(m)}</td><td></td></tr>`;
  });

  tbody.innerHTML += `<tr><td colspan="8" style="background:#f0fdf4;padding:8px 12px;font-size:12px;font-weight:700;color:#059669;border-top:2px solid #bbf7d0">🔧 TOTAIS POR TIPO</td></tr>`;
  Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).forEach(([t,m]) => {
    tbody.innerHTML += `<tr style="background:#f0fdf4"><td colspan="6" style="font-size:12px;color:#059669;padding:5px 12px"><b>${t}</b></td><td style="font-size:12px;font-weight:700;color:#059669">${fmtMin(m)}</td><td></td></tr>`;
  });

  resumo.innerHTML = `
    <span style="font-size:13px;font-weight:600;color:#1e3a5f">📊 Resumo Produção:</span>
    <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #c7d2fe;font-size:13px;color:#4338ca">📋 <b>${res.length} lançamentos</b></span>
    ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">⏱️ <b>${fmtMin(totalMins)}</b></span>`:''}`;
  resumo.style.display = 'flex';
}

// ==========================================
// EXPORTAR CSV
// ==========================================
function exportarCSV() {
  if (!_dadosHistorico.length) return toast('Nenhum dado para exportar.','erro');
  const setor = document.getElementById('histSetor').value;
  const ini   = document.getElementById('histIni').value;
  const fim   = document.getElementById('histFim').value;

  let cab, linhas;

  if (setor === 'Producao') {
    cab = ['Data','Técnico(s)','Injetora','Tipo','Atividade','Molde','Prod.','Descrição'];
    linhas = [cab.join(';')];
    _dadosHistorico.forEach(l => {
      const tecs = Array.isArray(l.tecnicos) ? l.tecnicos.join(' / ') : (l.tecnicos||'');
      linhas.push([l.data, tecs, l.injetora||'', l.tipo||'', l.atividade||'', l.molde||'',
        l.minutos ? fmtMin(l.minutos) : '', (l.descricao||'').replace(/;/g,',')].join(';'));
    });
  } else {
    cab = ['Data','Técnico','Atividade/Tipo','Job','Início','Fim','Prod.','Descrição'];
    linhas = [cab.join(';')];
    _dadosHistorico.forEach(l => {
      const desc = (l.descricao||'').replace(/;/g,',');
      let ativ = '';
      if (setor==='Usinagem')    ativ = (l.maquina||'') + (l.tipo?' / '+l.tipo:'');
      else if (setor==='Bancada') ativ = l.tipo||'';
      else ativ = (l.area||'') + (l.tipo?' / '+l.tipo:'');
      linhas.push([l.data, l.funcionario, ativ, l.job||'',
        l.horaInicio||'', l.horaFim||'', l.hrProd||'', desc].join(';'));
    });
  }

  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `Historico_${setor}_${ini}_${fim}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!','sucesso');
}
