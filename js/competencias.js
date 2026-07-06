// ==========================================
// 🎯 COMPETENCIAS.JS — Matriz de Competência
// ==========================================

var _setorAtivoComp = 'Usinagem';
var _categoriaAtivaComp = 'Técnica'; // 'Técnica' ou 'Comportamental'
var _dadosComp = { competencias: [], funcionarios: [], avaliacoes: [] };
var _chartsComp = {};
var _funcSelecionadoRadar = null;

const _SETORES_COMP = ['Usinagem','Bancada','Projeto','Produção'];
const _CORES_SETOR_COMP = { Usinagem:'#0056b3', Bancada:'#0891b2', Projeto:'#8b5cf6', 'Produção':'#10b981' };

const _NIVEIS_COMP = [
  { v:0, label:'Não sabe',       cor:'#94a3b8', bg:'#f1f5f9' },
  { v:1, label:'Iniciante',      cor:'#ef4444', bg:'#fee2e2' },
  { v:2, label:'Intermediário',  cor:'#f59e0b', bg:'#fef3c7' },
  { v:3, label:'Avançado',       cor:'#3b82f6', bg:'#dbeafe' },
  { v:4, label:'Especialista',   cor:'#10b981', bg:'#d1fae5' },
];

const _NAO_APLICA = { v:-1, label:'Não se aplica', cor:'#94a3b8', bg:'#f8fafc' };

function _infoNivel(v) {
  if (v === -1) return _NAO_APLICA;
  return _NIVEIS_COMP.find(n => n.v === v) || _NIVEIS_COMP[0];
}

// ==========================================
// 🚀 INICIALIZAÇÃO
// ==========================================
async function inicializarCompetencias() {
  const el = document.getElementById('telaMatrizCompetencia');
  if (!el) return;
  el.innerHTML = `
  <div class="page-header">
    <h1>🎯 Matriz de Competência</h1>
    <button class="btn-primary" onclick="abrirModalNovaCompetencia()">+ Nova Competência</button>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px" id="compSetorTabs">
    ${_SETORES_COMP.map(s => `<button onclick="mudarSetorCompetencia('${s}')"
      style="padding:8px 18px;border-radius:20px;border:2px solid ${s===_setorAtivoComp?_CORES_SETOR_COMP[s]:'#e2e8f0'};
      background:${s===_setorAtivoComp?_CORES_SETOR_COMP[s]:'#fff'};color:${s===_setorAtivoComp?'#fff':_CORES_SETOR_COMP[s]};
      font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s" id="tabComp_${s}">${s}</button>`).join('')}
  </div>
  <div style="display:flex;gap:8px;margin-bottom:20px" id="compCategoriaTabs">
    <button onclick="mudarCategoriaCompetencia('Técnica')" id="catComp_Técnica"
      style="padding:7px 16px;border-radius:8px;border:none;font-weight:700;font-size:12px;cursor:pointer;
      background:${_categoriaAtivaComp==='Técnica'?'#1e3a5f':'#f1f5f9'};color:${_categoriaAtivaComp==='Técnica'?'#fff':'#64748b'}">🔧 Técnicas</button>
    <button onclick="mudarCategoriaCompetencia('Comportamental')" id="catComp_Comportamental"
      style="padding:7px 16px;border-radius:8px;border:none;font-weight:700;font-size:12px;cursor:pointer;
      background:${_categoriaAtivaComp==='Comportamental'?'#1e3a5f':'#f1f5f9'};color:${_categoriaAtivaComp==='Comportamental'?'#fff':'#64748b'}">🤝 Comportamentais</button>
  </div>
  <div id="compLoader" class="loader-inline"><div class="spinner-sm"></div><span>Carregando matriz...</span></div>
  <div id="compConteudo" style="display:none;overflow-x:hidden;max-width:100%"></div>`;

  await carregarMatrizCompetencias(_setorAtivoComp);
}

function mudarSetorCompetencia(setor) {
  _setorAtivoComp = setor;
  _SETORES_COMP.forEach(s => {
    const btn = document.getElementById('tabComp_'+s);
    if (!btn) return;
    const ativo = s === setor;
    btn.style.borderColor = ativo ? _CORES_SETOR_COMP[s] : '#e2e8f0';
    btn.style.background  = ativo ? _CORES_SETOR_COMP[s] : '#fff';
    btn.style.color       = ativo ? '#fff' : _CORES_SETOR_COMP[s];
  });
  carregarMatrizCompetencias(setor);
}

function mudarCategoriaCompetencia(categoria) {
  _categoriaAtivaComp = categoria;
  ['Técnica','Comportamental'].forEach(c => {
    const btn = document.getElementById('catComp_'+c);
    if (!btn) return;
    const ativo = c === categoria;
    btn.style.background = ativo ? '#1e3a5f' : '#f1f5f9';
    btn.style.color      = ativo ? '#fff' : '#64748b';
  });
  carregarMatrizCompetencias(_setorAtivoComp);
}

// ==========================================
// 📊 CARREGAR DADOS DA MATRIZ
// ==========================================
async function carregarMatrizCompetencias(setor) {
  const loader = document.getElementById('compLoader');
  const conteudo = document.getElementById('compConteudo');
  if (loader) loader.style.display = 'flex';
  if (conteudo) conteudo.style.display = 'none';

  try {
    const [todasCompetencias, todosFuncionarios] = await Promise.all([
      db.listarCompetencias(setor),
      db.listarFuncionarios()
    ]);

    const competencias = (todasCompetencias||[]).filter(c => (c.categoria || 'Técnica') === _categoriaAtivaComp);

    const setorMapeado = setor === 'Produção' ? ['Producao','Produção'] : [setor];
    const funcionarios = (todosFuncionarios||[]).filter(f =>
      f.ativo && setorMapeado.includes(f.setor)
    ).sort((a,b)=>a.nome.localeCompare(b.nome));

    const idsCompetencias = competencias.map(c=>c.id);
    const avaliacoes = await db.listarAvaliacoesPorCompetencias(idsCompetencias);

    _dadosComp = { competencias: competencias||[], todasCompetencias: todasCompetencias||[], funcionarios, avaliacoes: avaliacoes||[] };
    renderizarMatrizCompetencias();
  } catch(e) {
    console.error(e);
    toast('Erro ao carregar matriz de competência.','erro');
  }
  if (loader) loader.style.display = 'none';
  if (conteudo) conteudo.style.display = 'block';
}

// Retorna o nível mais recente para funcionario+competencia (ou null se nunca avaliado)
function _nivelAtual(funcionario, competenciaId) {
  const avals = _dadosComp.avaliacoes.filter(a => a.funcionario===funcionario && a.competencia_id===competenciaId);
  if (!avals.length) return null;
  return avals[0]; // já vem ordenado desc por avaliado_em
}

// ==========================================
// 🖼️ RENDERIZAR MATRIZ + GRÁFICOS
// ==========================================
function renderizarMatrizCompetencias() {
  const el = document.getElementById('compConteudo');
  if (!el) return;
  const { competencias, funcionarios, avaliacoes } = _dadosComp;
  const cor = _CORES_SETOR_COMP[_setorAtivoComp];

  if (!competencias.length) {
    el.innerHTML = `<div class="empty-state">
      <div style="font-size:48px">🎯</div>
      <div>Nenhuma competência ${_categoriaAtivaComp==='Técnica'?'técnica':'comportamental'} cadastrada para ${_setorAtivoComp}.</div>
      <div style="margin-top:12px"><button class="btn-primary" onclick="abrirModalNovaCompetencia()">+ Cadastrar primeira competência</button></div>
    </div>`;
    return;
  }
  if (!funcionarios.length) {
    el.innerHTML = `<div class="empty-state"><div style="font-size:48px">👥</div><div>Nenhum funcionário ativo em ${_setorAtivoComp}.</div></div>`;
    return;
  }

  // ===== Cálculos de resumo =====
  // Nível médio por competência (coluna)
  const mediaPorCompetencia = competencias.map(c => {
    let soma=0, n=0;
    funcionarios.forEach(f => {
      const av = _nivelAtual(f.nome, c.id);
      if (av && av.nivel !== -1) { soma += av.nivel; n++; }
    });
    return { competencia: c, media: n>0?soma/n:0, avaliados: n };
  });

  // Nível médio por funcionário (linha)
  const mediaPorFuncionario = funcionarios.map(f => {
    let soma=0, n=0;
    competencias.forEach(c => {
      const av = _nivelAtual(f.nome, c.id);
      if (av && av.nivel !== -1) { soma += av.nivel; n++; }
    });
    return { funcionario: f, media: n>0?soma/n:0, avaliados: n };
  });

  const totalCelulas = competencias.length * funcionarios.length;
  const totalAvaliadas = mediaPorCompetencia.reduce((a,c)=>a+c.avaliados,0);
  const nivelMedioGeral = totalAvaliadas>0
    ? mediaPorCompetencia.reduce((a,c)=>a+(c.media*c.avaliados),0) / totalAvaliadas
    : 0;

  const compsAvaliadas = mediaPorCompetencia.filter(c=>c.avaliados>0);
  const maisForte = compsAvaliadas.length ? compsAvaliadas.reduce((a,b)=>a.media>=b.media?a:b) : null;
  const maisFraca = compsAvaliadas.length ? compsAvaliadas.reduce((a,b)=>a.media<=b.media?a:b) : null;

  const funcsAvaliados = mediaPorFuncionario.filter(f=>f.avaliados>0);
  const maisVersatil = funcsAvaliados.length ? funcsAvaliados.reduce((a,b)=>a.media>=b.media?a:b) : null;

  // ===== HTML =====
  let html = `<div class="cards-row">
    ${metricCard('📊','Nível Médio da Equipe', nivelMedioGeral.toFixed(1)+'/4', totalAvaliadas+' de '+totalCelulas+' avaliações feitas', cor)}
    ${metricCard('🏆','Competência Mais Forte', maisForte?maisForte.competencia.nome:'—', maisForte?'Média '+maisForte.media.toFixed(1)+'/4':'Sem dados','#10b981')}
    ${metricCard('⚠️','Competência Mais Fraca', maisFraca?maisFraca.competencia.nome:'—', maisFraca?'Média '+maisFraca.media.toFixed(1)+'/4':'Sem dados','#ef4444')}
    ${metricCard('⭐','Mais Versátil', maisVersatil?maisVersatil.funcionario.nome:'—', maisVersatil?'Média '+maisVersatil.media.toFixed(1)+'/4':'Sem dados','#8b5cf6')}
  </div>

  <div class="graficos-2col">
    <div class="grafico-card">
      <div class="grafico-titulo">📊 Nível Médio por Competência</div>
      <div style="height:260px"><canvas id="chartCompBarras"></canvas></div>
    </div>
    <div class="grafico-card">
      <div class="grafico-titulo">📈 Evolução do Nível Médio do Setor</div>
      <div style="height:260px"><canvas id="chartCompTendencia"></canvas></div>
    </div>
  </div>

  <div class="card" style="overflow-x:hidden;max-width:100%">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">🗺️ Matriz — clique numa célula para avaliar</div>
      <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="abrirGerenciarCompetencias()">⚙️ Gerenciar Competências</button>
    </div>
    <div class="table-wrap" id="matrizScrollWrap" style="overflow-x:auto;max-width:100%;scrollbar-width:auto">
      <table style="border-collapse:separate;border-spacing:3px;table-layout:fixed">
        <thead>
          <tr>
            <th style="text-align:left;min-width:170px;width:170px;position:sticky;left:0;background:#fff;z-index:3">Funcionário</th>
            ${competencias.map(c=>`<th style="writing-mode:vertical-rl;text-orientation:mixed;font-size:11px;padding:10px 4px;height:150px;width:44px;min-width:44px;max-width:44px;white-space:normal;word-break:break-word;line-height:1.2;cursor:default" title="${c.nome}">${c.nome}</th>`).join('')}
            <th style="font-size:11px;width:60px;min-width:60px;position:sticky;right:0;background:#fff;z-index:3">Média</th>
          </tr>
        </thead>
        <tbody>
          ${funcionarios.map(f => {
            const mediaF = mediaPorFuncionario.find(m=>m.funcionario.nome===f.nome);
            return `<tr>
              <td style="font-weight:600;font-size:12px;color:#1e3a5f;cursor:pointer;position:sticky;left:0;background:#fff;z-index:1;white-space:nowrap" onclick="abrirRadarFuncionario('${f.nome.replace(/'/g,"\\'")}')">👤 ${f.nome}</td>
              ${competencias.map(c => {
                const av = _nivelAtual(f.nome, c.id);
                const info = av ? _infoNivel(av.nivel) : { cor:'#cbd5e1', bg:'#f8fafc', label:'Não avaliado' };
                const textoCelula = av ? (av.nivel === -1 ? 'N/A' : av.nivel) : '—';
                return `<td style="text-align:center;padding:0;width:44px;min-width:44px">
                  <div style="width:36px;height:36px;background:${info.bg};border:2px solid ${info.cor}40;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:800;color:${info.cor};font-size:${av && av.nivel===-1?'10px':'13px'};margin:0 auto"
                    title="${f.nome} · ${c.nome}: ${info.label}"
                    onclick="abrirPopoverAvaliar(event,'${f.nome.replace(/'/g,"\\'")}',${c.id},'${c.nome.replace(/'/g,"\\'")}')">
                    ${textoCelula}
                  </div>
                </td>`;
              }).join('')}
              <td style="text-align:center;font-weight:800;color:${cor};position:sticky;right:0;background:#fff;z-index:1">${mediaF.avaliados>0?mediaF.media.toFixed(1):'—'}</td>
            </tr>`;
          }).join('')}
          <tr style="border-top:2px solid #e2e8f0">
            <td style="font-weight:700;font-size:12px;color:#64748b;position:sticky;left:0;background:#fff;z-index:1;white-space:nowrap">Média da Competência</td>
            ${mediaPorCompetencia.map(m=>`<td style="text-align:center;font-weight:700;font-size:12px;color:${cor};width:44px;min-width:44px">${m.avaliados>0?m.media.toFixed(1):'—'}</td>`).join('')}
            <td style="position:sticky;right:0;background:#fff"></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9">
      ${_NIVEIS_COMP.map(n=>`<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b">
        <span style="width:14px;height:14px;background:${n.bg};border:2px solid ${n.cor}40;border-radius:4px;display:inline-block"></span>${n.v} — ${n.label}
      </span>`).join('')}
      <span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b">
        <span style="width:14px;height:14px;background:${_NAO_APLICA.bg};border:2px dashed ${_NAO_APLICA.cor}80;border-radius:4px;display:inline-block"></span>N/A — Não se aplica
      </span>
    </div>
  </div>

  <div class="card" id="cardRadarFuncionario" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px" id="tituloRadarFuncionario">👤 Perfil de Competências</div>
      <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="fecharRadarFuncionario()">✕ Fechar</button>
    </div>
    <div style="height:340px"><canvas id="chartCompRadar"></canvas></div>
  </div>`;

  el.innerHTML = html;

  setTimeout(() => {
    const paleta = ['#0056b3','#0891b2','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6','#84cc16'];

    // Gráfico de barras — nível médio por competência
    if (_chartsComp['barras']) _chartsComp['barras'].destroy();
    const ctx1 = document.getElementById('chartCompBarras');
    if (ctx1) _chartsComp['barras'] = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: mediaPorCompetencia.map(m=>m.competencia.nome),
        datasets: [{ data: mediaPorCompetencia.map(m=>Math.round(m.media*10)/10), backgroundColor: mediaPorCompetencia.map(m=>m.media>=3?'#10b981':m.media>=2?'#f59e0b':m.media>0?'#ef4444':'#cbd5e1'), borderRadius:6 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{ legend:{display:false}, datalabels:{anchor:'end',align:'end',color:'#1e3a5f',font:{weight:'bold'}} },
        scales:{ x:{min:0,max:4,ticks:{stepSize:1}} }
      }
    });

    // Gráfico de tendência — evolução mensal da média do setor
    const porMes = {};
    avaliacoes.forEach(a => {
      if (!a.avaliado_em) return;
      const mes = a.avaliado_em.substring(0,7);
      if (!porMes[mes]) porMes[mes] = { soma:0, n:0 };
      porMes[mes].soma += a.nivel; porMes[mes].n++;
    });
    const mesesOrd = Object.keys(porMes).sort();
    if (_chartsComp['tendencia']) _chartsComp['tendencia'].destroy();
    const ctx2 = document.getElementById('chartCompTendencia');
    if (ctx2) {
      if (mesesOrd.length < 2) {
        ctx2.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:13px;text-align:center;padding:20px">📈 Ainda não há histórico suficiente.<br>Reavalie a equipe periodicamente para ver a evolução aqui.</div>';
      } else {
        const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        _chartsComp['tendencia'] = new Chart(ctx2, {
          type: 'line',
          data: {
            labels: mesesOrd.map(m=>{ const [a,mm]=m.split('-'); return nomesMes[parseInt(mm)-1]+'/'+a.slice(2); }),
            datasets: [{ label:'Nível médio', data: mesesOrd.map(m=>Math.round(porMes[m].soma/porMes[m].n*10)/10), borderColor:cor, backgroundColor:cor+'20', fill:true, tension:0.3, pointRadius:4 }]
          },
          options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},datalabels:{display:false}}, scales:{ y:{min:0,max:4,ticks:{stepSize:1}} } }
        });
      }
    }
  }, 100);
}

// ==========================================
// 🕸️ RADAR DE FUNCIONÁRIO
// ==========================================
function abrirRadarFuncionario(nome) {
  _funcSelecionadoRadar = nome;
  const card = document.getElementById('cardRadarFuncionario');
  const titulo = document.getElementById('tituloRadarFuncionario');
  if (titulo) titulo.innerText = '👤 Perfil de Competências — ' + nome;
  if (card) { card.style.display = 'block'; card.scrollIntoView({behavior:'smooth', block:'center'}); }

  const { competencias } = _dadosComp;
  // Exclui competências marcadas como "Não se aplica" — não fazem sentido no radar
  const competenciasRadar = competencias.filter(c => {
    const av = _nivelAtual(nome, c.id);
    return !(av && av.nivel === -1);
  });
  const dadosRadar = competenciasRadar.map(c => {
    const av = _nivelAtual(nome, c.id);
    return av ? av.nivel : 0;
  });

  setTimeout(() => {
    if (_chartsComp['radar']) _chartsComp['radar'].destroy();
    const ctx = document.getElementById('chartCompRadar');
    if (!ctx) return;
    const cor = _CORES_SETOR_COMP[_setorAtivoComp];
    _chartsComp['radar'] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: competenciasRadar.map(c=>c.nome),
        datasets: [{ label: nome, data: dadosRadar, backgroundColor: cor+'30', borderColor: cor, borderWidth:2, pointBackgroundColor: cor, pointRadius:4 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, datalabels:{display:false} },
        scales:{ r:{ min:0, max:4, ticks:{stepSize:1, backdropColor:'transparent'}, pointLabels:{font:{size:11}} } }
      }
    });
  }, 50);
}

function fecharRadarFuncionario() {
  const card = document.getElementById('cardRadarFuncionario');
  if (card) card.style.display = 'none';
  if (_chartsComp['radar']) { _chartsComp['radar'].destroy(); _chartsComp['radar'] = null; }
}

// ==========================================
// ✏️ AVALIAR (célula da matriz)
// ==========================================
// ==========================================
// ⚡ AVALIAÇÃO RÁPIDA — Popover de 1 clique (sem modal)
// ==========================================
function abrirPopoverAvaliar(evt, funcionario, competenciaId, competenciaNome) {
  evt.stopPropagation();
  fecharPopoverAvaliar();

  const avAtual = _nivelAtual(funcionario, competenciaId);
  const rect = evt.currentTarget.getBoundingClientRect();
  const div = document.createElement('div');
  div.id = 'popoverAvaliarWrap';
  div.style.cssText = `position:fixed;z-index:2000;top:${rect.bottom+6}px;left:${Math.min(rect.left, window.innerWidth-260)}px;
    background:#fff;border:1px solid var(--borda);border-radius:10px;box-shadow:0 12px 32px rgba(15,30,60,0.18);
    padding:10px;width:240px`;

  const botoesNivel = _NIVEIS_COMP.map(n => `
    <button onclick="salvarAvaliacaoRapida('${funcionario.replace(/'/g,"\\'")}',${competenciaId},${n.v})"
      style="flex:1;min-width:38px;padding:8px 0;border-radius:6px;border:2px solid ${avAtual?.nivel===n.v?n.cor:'#e2e8f0'};
      background:${avAtual?.nivel===n.v?n.bg:'#fff'};color:${avAtual?.nivel===n.v?n.cor:'#64748b'};font-weight:800;font-size:13px;cursor:pointer"
      title="${n.label}">${n.v}</button>`).join('');

  div.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;margin-bottom:2px">${funcionario}</div>
    <div style="font-size:12.5px;font-weight:700;color:#1e3a5f;margin-bottom:8px">${competenciaNome}</div>
    <div style="display:flex;gap:4px;margin-bottom:6px">${botoesNivel}</div>
    <button onclick="salvarAvaliacaoRapida('${funcionario.replace(/'/g,"\\'")}',${competenciaId},-1)"
      style="width:100%;padding:6px 0;border-radius:6px;border:2px dashed ${avAtual?.nivel===-1?_NAO_APLICA.cor:'#e2e8f0'};
      background:${avAtual?.nivel===-1?_NAO_APLICA.bg:'#fff'};color:#64748b;font-weight:600;font-size:11px;cursor:pointer;margin-bottom:6px">
      🚫 Não se aplica
    </button>
    <div id="popoverObsWrap" style="display:${avAtual?.observacao?'block':'none'}">
      <input type="text" id="popoverObsInput" placeholder="Observação..." value="${(avAtual?.observacao||'').replace(/"/g,'&quot;')}"
        style="width:100%;font-size:11px;padding:6px 8px;border:1px solid var(--borda);border-radius:6px;margin-bottom:4px">
      <button onclick="salvarObsRapida('${funcionario.replace(/'/g,"\\'")}',${competenciaId})"
        style="width:100%;padding:5px 0;border-radius:6px;border:none;background:var(--azul,#0056b3);color:#fff;font-size:11px;font-weight:600;cursor:pointer">Salvar observação</button>
    </div>
    <div id="popoverObsLink" style="text-align:center;display:${avAtual?.observacao?'none':'block'}">
      <a href="javascript:void(0)" onclick="document.getElementById('popoverObsWrap').style.display='block';document.getElementById('popoverObsLink').style.display='none';document.getElementById('popoverObsInput')?.focus()"
        style="font-size:11px;color:#94a3b8;text-decoration:underline">+ observação</a>
    </div>
  `;
  document.body.appendChild(div);

  setTimeout(() => {
    document.addEventListener('click', _fecharPopoverAoClicarFora);
  }, 10);
}

function _fecharPopoverAoClicarFora(e) {
  const pop = document.getElementById('popoverAvaliarWrap');
  if (pop && !pop.contains(e.target)) fecharPopoverAvaliar();
}

function fecharPopoverAvaliar() {
  document.getElementById('popoverAvaliarWrap')?.remove();
  document.removeEventListener('click', _fecharPopoverAoClicarFora);
}

async function salvarAvaliacaoRapida(funcionario, competenciaId, nivel) {
  const obsInput = document.getElementById('popoverObsInput');
  const observacao = obsInput?.value?.trim() || null;
  try {
    await db.salvarAvaliacaoCompetencia({
      funcionario, competencia_id: competenciaId, nivel, observacao,
      avaliado_por: _sessao?.nome || null
    });
    // Atualiza localmente sem recarregar tudo do zero — mais rápido para preenchimento em série
    _dadosComp.avaliacoes.unshift({
      funcionario, competencia_id: competenciaId, nivel, observacao,
      avaliado_por: _sessao?.nome || null, avaliado_em: new Date().toISOString()
    });
    fecharPopoverAvaliar();
    renderizarMatrizCompetencias();
  } catch(e) { toast('Erro ao salvar avaliação.','erro'); console.error(e); }
}

async function salvarObsRapida(funcionario, competenciaId) {
  const av = _nivelAtual(funcionario, competenciaId);
  const nivel = av ? av.nivel : 0;
  await salvarAvaliacaoRapida(funcionario, competenciaId, nivel);
}

// ==========================================
// ➕ GERENCIAR COMPETÊNCIAS (criar/excluir)
// ==========================================
function abrirModalNovaCompetencia() {
  const div = document.createElement('div');
  div.id = 'modalNovaCompWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalNovaCompetencia()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:440px">
    <div class="modal-header"><h3>+ Nova Competência — ${_setorAtivoComp}</h3><button onclick="fecharModalNovaCompetencia()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Categoria *</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          <label style="flex:1;cursor:pointer;border:2px solid ${_categoriaAtivaComp==='Técnica'?'#1e3a5f':'#e2e8f0'};background:${_categoriaAtivaComp==='Técnica'?'#f1f5f9':'#fff'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600">
            <input type="radio" name="novaCompCategoria" value="Técnica" ${_categoriaAtivaComp==='Técnica'?'checked':''}> 🔧 Técnica
          </label>
          <label style="flex:1;cursor:pointer;border:2px solid ${_categoriaAtivaComp==='Comportamental'?'#1e3a5f':'#e2e8f0'};background:${_categoriaAtivaComp==='Comportamental'?'#f1f5f9':'#fff'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600">
            <input type="radio" name="novaCompCategoria" value="Comportamental" ${_categoriaAtivaComp==='Comportamental'?'checked':''}> 🤝 Comportamental
          </label>
        </div>
      </div>
      <div class="form-group"><label>Nome da Competência *</label><input type="text" id="novaCompNome" placeholder="Ex: Operação CNC, Trabalho em Equipe..."></div>
      <div class="form-group"><label>Descrição</label><input type="text" id="novaCompDesc" placeholder="Opcional..."></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarNovaCompetencia()">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalNovaCompetencia()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarNovaCompetencia() {
  const nome = document.getElementById('novaCompNome')?.value?.trim();
  const descricao = document.getElementById('novaCompDesc')?.value?.trim() || null;
  const categoria = document.querySelector('input[name="novaCompCategoria"]:checked')?.value || 'Técnica';
  if (!nome) return toast('Informe o nome da competência.','erro');
  try {
    await db.salvarCompetencia({ setor: _setorAtivoComp, nome, descricao, categoria, ativo: true });
    toast('Competência adicionada!','sucesso');
    fecharModalNovaCompetencia();
    await carregarMatrizCompetencias(_setorAtivoComp);
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

function fecharModalNovaCompetencia() { document.getElementById('modalNovaCompWrap')?.remove(); }

function abrirGerenciarCompetencias() {
  const div = document.createElement('div');
  div.id = 'modalGerCompWrap';
  const todas = _dadosComp.todasCompetencias || [];
  const tecnicas = todas.filter(c => (c.categoria||'Técnica') === 'Técnica');
  const comportamentais = todas.filter(c => c.categoria === 'Comportamental');

  const renderGrupo = (titulo, lista) => `
    <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin:14px 0 8px;text-transform:uppercase">${titulo} (${lista.length})</div>
    ${lista.length ? lista.map(c => `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px dashed #f1f5f9">
        <div style="min-width:0;flex:1">
          <div style="font-size:13px;font-weight:600;color:#1e3a5f;word-break:break-word">${c.nome}</div>
          ${c.descricao?`<div style="font-size:11px;color:#94a3b8;word-break:break-word;overflow-wrap:break-word;margin-top:2px">${c.descricao}</div>`:''}
        </div>
        <button class="btn-icon danger" style="flex-shrink:0" onclick="excluirCompetenciaConfirm(${c.id},'${c.nome.replace(/'/g,"\\'")}')">🗑️</button>
      </div>`).join('') : '<div style="font-size:12px;color:#cbd5e1;padding:6px 0">Nenhuma cadastrada.</div>'}
  `;

  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharGerenciarCompetencias()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px;max-height:85vh;display:flex;flex-direction:column">
    <div class="modal-header"><h3>⚙️ Competências — ${_setorAtivoComp}</h3><button onclick="fecharGerenciarCompetencias()">✕</button></div>
    <div class="modal-body" style="overflow-y:auto;flex:1">
      ${renderGrupo('🔧 Técnicas', tecnicas)}
      ${renderGrupo('🤝 Comportamentais', comportamentais)}
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="fecharGerenciarCompetencias();abrirModalNovaCompetencia()">+ Nova</button>
      <button class="btn-secondary" onclick="fecharGerenciarCompetencias()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function fecharGerenciarCompetencias() { document.getElementById('modalGerCompWrap')?.remove(); }

function excluirCompetenciaConfirm(id, nome) {
  confirmarExclusao('Remover a competência "'+nome+'"? As avaliações associadas deixarão de aparecer na matriz.', async () => {
    try {
      await db.excluirCompetencia(id);
      toast('Competência removida!','sucesso');
      fecharGerenciarCompetencias();
      await carregarMatrizCompetencias(_setorAtivoComp);
    } catch(e) { toast('Erro ao remover.','erro'); }
  });
}
