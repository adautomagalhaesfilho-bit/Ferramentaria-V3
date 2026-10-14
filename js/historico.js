// ==========================================
// 🔎 HISTORICO.JS — V3 com Produção
// ==========================================

var _dadosHistorico = [];
var _setorHistorico = 'Usinagem';

function inicializarHistorico() {
  const hoje = new Date();
  const ini  = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay() + 1);
  const fDate = d => dataLocal(d);
  document.getElementById('histIni').value = fDate(ini);
  document.getElementById('histFim').value = fDate(hoje);
  if (_listas) atualizarFiltrosHistorico();
  else setTimeout(atualizarFiltrosHistorico, 500);
}

const _GRUPOS_TIPO_HIST = '<option value="Todos">Todos os Tipos</option>' +
  '<optgroup label="Agrupados (pega todos os nomes parecidos)">' +
  '<option value="~Prevent">⭐ Todas as Preventivas</option>' +
  '<option value="~Corret">⭐ Todas as Corretivas</option>' +
  '<option value="~Inspe">⭐ Todas as Inspeções</option>' +
  '</optgroup><optgroup label="Tipo específico">';

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
    funcs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');

  // Tipos por setor
  selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>';
  try {
    if (setor === 'Usinagem') {
      const tipos = _listas.tipos || [];
      selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>' +
        tipos.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

    } else if (setor === 'Bancada') {
      const tiposBancada = _listas.tiposBancada || [];
      selTipo.innerHTML = _GRUPOS_TIPO_HIST +
        tiposBancada.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('') + '</optgroup>';

    } else if (setor === 'Projeto') {
      const areasProj = _listas.areasProj     || [];
      const catsProj  = _listas.categoriasProj || [];
      const opcoes = [...areasProj, ...catsProj].filter((v,i,a)=>a.indexOf(v)===i).sort();
      selTipo.innerHTML = '<option value="Todos">Todos</option>' +
        opcoes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

    } else if (setor === 'Producao') {
      // Tipos de produção vêm de prod_categorias setor=Producao
      const tiposProd = _listas.tiposProd || [];
      // Mostra os tipos que existem no cadastro e também os que já foram gravados com
      // outro nome (ex.: "Preventiva" antigo x "Manutenção Preventiva")
      selTipo.innerHTML = _GRUPOS_TIPO_HIST +
        tiposProd.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('') + '</optgroup>';
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
    <th>${esc(setor==='Usinagem'?'Máquina / Tipo':setor==='Bancada'?'Atividade':'Área / Categoria')}</th>
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
      ? `<span style="color:#10b981;font-weight:700">${esc(l.hrProd)}</span>`
      : '—';
    let col3 = '', desc = esc(l.descricao || '—'), status = '';

    if (setor === 'Usinagem') {
      col3 = `<span style="font-size:12px"><b>${esc(l.maquina||'—')}</b>${l.tipo?`<br><span style="color:#64748b;font-size:11px">${esc(l.tipo)}</span>`:''}</span>`;
    } else if (setor === 'Bancada') {
      col3 = esc(l.tipo || '—') + (l.temOS ? `<br><span style="font-size:11px;color:#1d4ed8;font-weight:700">📋 OS: ${esc(l.numeroOS||'?')}</span>` : '');
    } else {
      col3 = `<span style="font-size:12px">${l.area?`<b>${esc(l.area)}</b><br>`:''}<span style="color:#64748b;font-size:11px">${esc(l.tipo||'—')}</span></span>`;
      const cor = corStatus(l.status);
      status = `<span style="color:${esc(cor)};font-weight:600;font-size:12px">${esc(icoStatus(l.status))} ${esc(l.status||'—')}</span>`;
    }

    return `<tr>
      <td><b>${dt}</b></td>
      <td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(l.funcionario):esc(l.funcionario||'—')}</td>
      <td>${col3}</td>
      <td><b>${esc(l.job||'—')}</b></td>
      <td style="font-size:12px">${esc(hr1)}</td>
      <td style="font-size:12px">${esc(hr2)}</td>
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
      tbody.innerHTML += `<tr style="background:#f0f9ff"><td colspan="6" style="font-size:12px;color:#0369a1;padding:5px 12px"><b>${esc(f)}</b></td><td style="font-size:12px;font-weight:700;color:#0369a1">${esc(fmtMin(m))}</td><td></td></tr>`;
    });
    tbody.innerHTML += `<tr><td colspan="8" style="background:#f0fdf4;padding:8px 12px;font-size:12px;font-weight:700;color:#059669;border-top:2px solid #bbf7d0">📦 TOTAIS POR JOB</td></tr>`;
    Object.entries(porJob).sort((a,b)=>b[1]-a[1]).forEach(([j,m]) => {
      tbody.innerHTML += `<tr style="background:#f0fdf4"><td colspan="6" style="font-size:12px;color:#059669;padding:5px 12px"><b>${esc(j)}</b></td><td style="font-size:12px;font-weight:700;color:#059669">${esc(fmtMin(m))}</td><td></td></tr>`;
    });
  }

  resumo.innerHTML = `
    <span style="font-size:13px;font-weight:600;color:#1e3a5f">📊 Resumo:</span>
    <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #c7d2fe;font-size:13px;color:#4338ca">📋 <b>${res.length} lançamentos</b></span>
    ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">⏱️ <b>${esc(fmtMin(totalMins))}</b></span>`:''}`;
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
    const tecs = tecsArr.length ? tecsArr.map(t=>typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(t):esc(t)).join(', ') : '—';
    const mins = l.minutos || 0;
    const hrProd = mins > 0 ? fmtMin(mins) : '—';
    const flags = [
      l.maquina_parada ? '🔴 Maq. Parada' : '',
      l.tem_os ? `📋 OS: ${esc(l.numero_os||'')}` : ''
    ].filter(Boolean).join(' ');

    return `<tr>
      <td><b>${dt}</b></td>
      <td style="font-size:12px">${tecs}</td>
      <td><b>${esc(l.injetora||'—')}</b></td>
      <td><span style="background:#d1fae5;color:#059669;font-size:11px;padding:2px 8px;border-radius:8px;font-weight:600">${esc(l.tipo||'—')}</span></td>
      <td style="font-size:12px">${esc(l.atividade||'—')}</td>
      <td><b>${esc(l.molde||'—')}</b></td>
      <td><span style="color:#10b981;font-weight:700">${esc(hrProd)}</span></td>
      <td style="font-size:12px;color:#64748b">${esc(l.descricao||'')} ${flags}</td>
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
    tbody.innerHTML += `<tr style="background:#f0f9ff"><td colspan="6" style="font-size:12px;color:#0369a1;padding:5px 12px"><b>${esc(inj)}</b></td><td style="font-size:12px;font-weight:700;color:#0369a1">${esc(fmtMin(m))}</td><td></td></tr>`;
  });

  tbody.innerHTML += `<tr><td colspan="8" style="background:#f0fdf4;padding:8px 12px;font-size:12px;font-weight:700;color:#059669;border-top:2px solid #bbf7d0">🔧 TOTAIS POR TIPO</td></tr>`;
  Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).forEach(([t,m]) => {
    tbody.innerHTML += `<tr style="background:#f0fdf4"><td colspan="6" style="font-size:12px;color:#059669;padding:5px 12px"><b>${esc(t)}</b></td><td style="font-size:12px;font-weight:700;color:#059669">${esc(fmtMin(m))}</td><td></td></tr>`;
  });

  resumo.innerHTML = `
    <span style="font-size:13px;font-weight:600;color:#1e3a5f">📊 Resumo Produção:</span>
    <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #c7d2fe;font-size:13px;color:#4338ca">📋 <b>${res.length} lançamentos</b></span>
    ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">⏱️ <b>${esc(fmtMin(totalMins))}</b></span>`:''}`;
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
    cab = ['Data','Técnico(s)','Injetora','Tipo','Atividade','Molde','Prod.','Nº OS','Descrição'];
    linhas = [cab.join(';')];
    _dadosHistorico.forEach(l => {
      const tecs = Array.isArray(l.tecnicos) ? l.tecnicos.join(' / ') : (l.tecnicos||'');
      linhas.push([l.data, tecs, l.injetora||'', l.tipo||'', l.atividade||'', l.molde||'',
        l.minutos ? fmtMin(l.minutos) : '', l.tem_os ? (l.numero_os||'') : '', (l.descricao||'').replace(/;/g,',')].join(';'));
    });
  } else {
    cab = ['Data','Técnico','Atividade/Tipo','Job','Início','Fim','Prod.','Nº OS','Descrição'];
    linhas = [cab.join(';')];
    _dadosHistorico.forEach(l => {
      const desc = (l.descricao||'').replace(/;/g,',');
      let ativ = '';
      if (setor==='Usinagem')    ativ = (l.maquina||'') + (l.tipo?' / '+l.tipo:'');
      else if (setor==='Bancada') ativ = l.tipo||'';
      else ativ = (l.area||'') + (l.tipo?' / '+l.tipo:'');
      linhas.push([l.data, l.funcionario, ativ, l.job||'',
        l.horaInicio||'', l.horaFim||'', l.hrProd||'', l.temOS ? (l.numeroOS||'') : '', desc].join(';'));
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


// ==========================================
// EXPORTAR EXCEL (.xlsx) — respeita período, setor e tipo escolhidos
// Gera 2 abas: "Lançamentos" (linha a linha) e "Resumo por tipo" (quantidade e horas)
// ==========================================
function exportarExcel() {
  if (!_dadosHistorico.length) return toast('Nenhum dado para exportar. Faça a busca primeiro.','erro');
  if (typeof XLSX === 'undefined') return toast('Biblioteca do Excel não carregou. Atualize a página (Ctrl+Shift+R).','erro');
  const setor = document.getElementById('histSetor').value;
  const ini   = document.getElementById('histIni').value;
  const fim   = document.getElementById('histFim').value;
  const selTipo = document.getElementById('histTipo');
  const tipoTxt = selTipo.options[selTipo.selectedIndex]?.text || 'Todos os Tipos';
  const br = d => d ? String(d).split('-').reverse().join('/') : '';
  const hhmm = m => { m = Math.round(m||0); return Math.floor(m/60) + ':' + String(m%60).padStart(2,'0'); };

  let cab, linhas, tipoDe, minDe;
  if (setor === 'Producao') {
    cab = ['Data','Técnico(s)','Injetora','Tipo','Atividade','Molde','Início','Fim','Duração (h:min)','Minutos','Máq. parada','Nº OS','Status','Descrição'];
    linhas = _dadosHistorico.map(l => [
      br(l.data), Array.isArray(l.tecnicos) ? l.tecnicos.join(' / ') : (l.tecnicos||''), l.injetora||'', l.tipo||'', l.atividade||'', l.molde||'',
      (l.hora_inicio||'').substring(0,5), (l.hora_fim||'').substring(0,5), hhmm(l.minutos), l.minutos||0,
      l.maquina_parada ? 'Sim' : 'Não', l.tem_os ? (l.numero_os||'') : '', l.status||'', l.descricao||'']);
  } else {
    cab = ['Data','Técnico','Setor','Tipo / Atividade','Máquina','Área','Job','Início','Fim','Duração (h:min)','Minutos','Nº OS','Status','Descrição'];
    linhas = _dadosHistorico.map(l => [
      br(l.data), l.funcionario||'', setor, l.tipo||'', l.maquina||'', l.area||'', l.job||'',
      l.horaInicio||'', l.horaFim||'', hhmm(l.minutos), l.minutos||0,
      l.temOS ? (l.numeroOS||'') : '', l.status||'', l.descricao||'']);
  }
  const iTipo = cab.indexOf(setor === 'Producao' ? 'Tipo' : 'Tipo / Atividade');
  const iMin  = cab.indexOf('Minutos');

  // Resumo por tipo
  const resumo = {};
  linhas.forEach(r => { const t = r[iTipo] || '—'; (resumo[t] = resumo[t] || { q:0, m:0 }); resumo[t].q++; resumo[t].m += r[iMin]||0; });
  const totQ = linhas.length, totM = linhas.reduce((a,r)=>a+(r[iMin]||0),0);
  const abaResumo = [
    ['Relatório — ' + setor], ['Período', br(ini) + ' a ' + br(fim)], ['Filtro de tipo', tipoTxt], [],
    ['Tipo','Quantidade','Horas (h:min)','Minutos'],
    ...Object.entries(resumo).sort((a,b)=>b[1].m-a[1].m).map(([t,v]) => [t, v.q, hhmm(v.m), v.m]),
    ['TOTAL', totQ, hhmm(totM), totM]
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([cab, ...linhas]);
  ws1['!cols'] = cab.map((c,i) => ({ wch: c === 'Descrição' ? 60 : Math.max(10, Math.min(28, c.length + 6)) }));
  ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:linhas.length,c:cab.length-1} }) };
  const ws2 = XLSX.utils.aoa_to_sheet(abaResumo);
  ws2['!cols'] = [{wch:34},{wch:12},{wch:14},{wch:10}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Lançamentos');
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por tipo');
  XLSX.writeFile(wb, `Historico_${setor}_${ini}_${fim}.xlsx`);
  toast('Excel exportado!','sucesso');
}
