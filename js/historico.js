// ==========================================
// 🔎 HISTORICO.JS
// ==========================================
var _dadosHistorico = [];

function inicializarHistorico() {
  const hoje = new Date();
  const ini  = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay() + 1);
  const fDate = d => d.toISOString().split('T')[0];
  document.getElementById('histIni').value = fDate(ini);
  document.getElementById('histFim').value = fDate(hoje);
  if (_listas) atualizarFiltrosHistorico();
  else setTimeout(atualizarFiltrosHistorico, 500);
}

function atualizarFiltrosHistorico() {
  const setor = document.getElementById('histSetor').value;
  const selFunc = document.getElementById('histFunc');
  const selTipo = document.getElementById('histTipo');
  if (!_listas) return;
  const funcs = setor==='Usinagem'?_listas.funcionarios:setor==='Bancada'?_listas.funcBancada:_listas.funcProjeto||[];
  selFunc.innerHTML = '<option value="Todos">Todos os Funcionários</option>' + (funcs||[]).map(f=>`<option value="${f}">${f}</option>`).join('');
  const tipos = setor==='Usinagem'?_listas.tipos:setor==='Bancada'?_listas.tiposBancada:_listas.categoriasProj||[];
  selTipo.innerHTML = '<option value="Todos">Todos os Tipos</option>' + (tipos||[]).map(t=>`<option value="${t}">${t}</option>`).join('');
  document.getElementById('histTbody').innerHTML = '<tr><td colspan="8" class="empty-msg">Use os filtros acima para buscar.</td></tr>';
  document.getElementById('histResumo').style.display = 'none';
}

async function buscarHistorico() {
  const setor = document.getElementById('histSetor').value;
  const ini   = document.getElementById('histIni').value;
  const fim   = document.getElementById('histFim').value;
  const func  = document.getElementById('histFunc').value;
  const tipo  = document.getElementById('histTipo').value;
  const job   = document.getElementById('histJob').value;
  if (!ini||!fim) return toast('Informe o período.','erro');
  if (ini>fim)   return toast('Data inicial maior que a final.','erro');
  const loader = document.getElementById('histLoader');
  if (loader) loader.style.display='flex';
  document.getElementById('histTbody').innerHTML='';
  document.getElementById('histResumo').style.display='none';
  try {
    _dadosHistorico = await db.buscarLancamentosPeriodo(setor, ini, fim, func, job, tipo);
    renderizarHistorico(_dadosHistorico, setor);
  } catch(e) {
    document.getElementById('histTbody').innerHTML='<tr><td colspan="8" class="empty-msg">Erro ao buscar.</td></tr>';
    toast('Erro ao buscar histórico.','erro');
  }
  if (loader) loader.style.display='none';
}

function renderizarHistorico(res, setor) {
  const thead = document.getElementById('histThead');
  const tbody = document.getElementById('histTbody');
  const resumo = document.getElementById('histResumo');
  if (!res.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-msg">Nenhum lançamento encontrado.</td></tr>'; resumo.style.display='none'; return; }
  const cabs = {
    Usinagem: '<tr><th>Data</th><th>Técnico</th><th>Máquina</th><th>Tipo</th><th>Job</th><th>Início</th><th>Fim</th><th>Prod.</th></tr>',
    Bancada:  '<tr><th>Data</th><th>Técnico</th><th>Atividade</th><th>Job</th><th>Início</th><th>Fim</th><th>Prod.</th><th>Descrição</th></tr>',
    Projeto:  '<tr><th>Data</th><th>Técnico</th><th>Área</th><th>Categoria</th><th>Job</th><th>Descrição</th><th>Status</th><th></th></tr>'
  };
  thead.innerHTML = cabs[setor];
  const totalMins = res.reduce((a,l)=>a+(l.minutos||0),0);
  tbody.innerHTML = res.map(l => {
    const dt = l.data?l.data.split('-').reverse().join('/'):'—';
    if (setor==='Usinagem') return `<tr><td><b>${dt}</b></td><td>${l.funcionario||'—'}</td><td>${l.maquina||'—'}</td><td>${l.tipo||'—'}</td><td><b>${l.job||'—'}</b></td><td>${l.horaInicio||'—'}</td><td>${l.horaFim||'—'}</td><td style="color:#10b981;font-weight:bold">${l.hrProd||'—'}</td></tr>`;
    if (setor==='Bancada') return `<tr><td><b>${dt}</b></td><td>${l.funcionario||'—'}</td><td>${l.tipo||'—'}</td><td><b>${l.job||'—'}</b></td><td>${l.horaInicio||'—'}</td><td>${l.horaFim||'—'}</td><td style="color:#10b981;font-weight:bold">${l.hrProd||'—'}</td><td style="font-size:12px;color:#64748b">${l.descricao||'—'}</td></tr>`;
    const cor=corStatus(l.status);
    return `<tr><td><b>${dt}</b></td><td>${l.funcionario||'—'}</td><td>${l.area||'—'}</td><td>${l.tipo||'—'}</td><td><b>${l.job||'—'}</b></td><td style="font-size:12px;color:#64748b">${l.descricao||'—'}</td><td><span style="color:${cor};font-weight:600">${icoStatus(l.status)} ${l.status||'—'}</span></td><td></td></tr>`;
  }).join('');

  // Totais
  const porFunc = {}, porJob = {};
  res.forEach(l => {
    const f=l.funcionario||'—'; if (!porFunc[f]) porFunc[f]=0; porFunc[f]+=l.minutos||0;
    const j=l.job||'—'; if (!porJob[j]) porJob[j]=0; porJob[j]+=l.minutos||0;
  });
  if (setor !== 'Projeto') {
    tbody.innerHTML += `<tr><td colspan="8" style="background:#e0f2fe;padding:8px 12px;font-size:12px;font-weight:700;color:#0369a1;border-top:2px solid #bae6fd">👤 TOTAIS POR FUNCIONÁRIO</td></tr>`;
    Object.entries(porFunc).sort((a,b)=>b[1]-a[1]).forEach(([f,m]) => {
      tbody.innerHTML += `<tr style="background:#f0f9ff"><td colspan="6" style="font-size:12px;color:#0369a1;padding:5px 12px"><b>${f}</b></td><td style="font-size:12px;font-weight:bold;color:#0369a1">${fmtMin(m)}</td><td></td></tr>`;
    });
    tbody.innerHTML += `<tr><td colspan="8" style="background:#f0fdf4;padding:8px 12px;font-size:12px;font-weight:700;color:#059669;border-top:2px solid #bbf7d0">📦 TOTAIS POR JOB</td></tr>`;
    Object.entries(porJob).sort((a,b)=>b[1]-a[1]).forEach(([j,m]) => {
      tbody.innerHTML += `<tr style="background:#f0fdf4"><td colspan="6" style="font-size:12px;color:#059669;padding:5px 12px"><b>${j}</b></td><td style="font-size:12px;font-weight:bold;color:#059669">${fmtMin(m)}</td><td></td></tr>`;
    });
  }

  resumo.innerHTML = `<span style="font-size:13px;font-weight:600;color:#1e3a5f">📊 Resumo:</span>
    <span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #c7d2fe;font-size:13px;color:#4338ca">📋 <b>${res.length} lançamentos</b></span>
    ${totalMins>0?`<span style="background:#fff;padding:6px 12px;border-radius:8px;border:1px solid #bbf7d0;font-size:13px;color:#059669">⏱️ <b>${fmtMin(totalMins)}</b></span>`:''}`;
  resumo.style.display = 'flex';
}

function exportarCSV() {
  if (!_dadosHistorico.length) return toast('Nenhum dado para exportar.','erro');
  const setor = document.getElementById('histSetor').value;
  const ini   = document.getElementById('histIni').value;
  const fim   = document.getElementById('histFim').value;
  const cabs  = { Usinagem:['Data','Técnico','Máquina','Tipo','Job','Início','Fim','Prod.'], Bancada:['Data','Técnico','Atividade','Job','Início','Fim','Prod.','Descrição'], Projeto:['Data','Técnico','Área','Categoria','Job','Descrição','Status'] };
  const linhas = [cabs[setor].join(';')];
  _dadosHistorico.forEach(l => {
    const desc = (l.descricao||'').replace(/;/g,',');
    if (setor==='Usinagem') linhas.push([l.data,l.funcionario,l.maquina||'',l.tipo||'',l.job||'',l.horaInicio||'',l.horaFim||'',l.hrProd||''].join(';'));
    else if (setor==='Bancada') linhas.push([l.data,l.funcionario,l.tipo||'',l.job||'',l.horaInicio||'',l.horaFim||'',l.hrProd||'',desc].join(';'));
    else linhas.push([l.data,l.funcionario,l.area||'',l.tipo||'',l.job||'',desc,l.status||''].join(';'));
  });
  const blob = new Blob(['\uFEFF'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`Historico_${setor}_${ini}_${fim}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast('CSV exportado!', 'sucesso');
}
