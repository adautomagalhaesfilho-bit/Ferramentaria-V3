// ==========================================
// 🎯 COMPETENCIAS.JS — Matriz de Competência
// ==========================================

var _setorAtivoComp = 'Usinagem';
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

function _infoNivel(v) {
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
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px" id="compSetorTabs">
    ${_SETORES_COMP.map(s => `<button onclick="mudarSetorCompetencia('${s}')"
      style="padding:8px 18px;border-radius:20px;border:2px solid ${s===_setorAtivoComp?_CORES_SETOR_COMP[s]:'#e2e8f0'};
      background:${s===_setorAtivoComp?_CORES_SETOR_COMP[s]:'#fff'};color:${s===_setorAtivoComp?'#fff':_CORES_SETOR_COMP[s]};
      font-weight:700;font-size:13px;cursor:pointer;transition:all 0.2s" id="tabComp_${s}">${s}</button>`).join('')}
  </div>
  <div id="compLoader" class="loader-inline"><div class="spinner-sm"></div><span>Carregando matriz...</span></div>
  <div id="compConteudo" style="display:none"></div>`;

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

// ==========================================
// 📊 CARREGAR DADOS DA MATRIZ
// ==========================================
async function carregarMatrizCompetencias(setor) {
  const loader = document.getElementById('compLoader');
  const conteudo = document.getElementById('compConteudo');
  if (loader) loader.style.display = 'flex';
  if (conteudo) conteudo.style.display = 'none';

  try {
    const [competencias, todosFuncionarios] = await Promise.all([
      db.listarCompetencias(setor),
      db.listarFuncionarios()
    ]);

    const setorMapeado = setor === 'Produção' ? ['Producao','Produção'] : [setor];
    const funcionarios = (todosFuncionarios||[]).filter(f =>
      f.ativo && setorMapeado.includes(f.setor) &&
      f.setor !== 'Supervisão' && f.cargo !== 'Supervisor' && f.cargo !== 'Encarregado'
    ).sort((a,b)=>a.nome.localeCompare(b.nome));

    const idsCompetencias = (competencias||[]).map(c=>c.id);
    const avaliacoes = await db.listarAvaliacoesPorCompetencias(idsCompetencias);

    _dadosComp = { competencias: competencias||[], funcionarios, avaliacoes: avaliacoes||[] };
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
      <div>Nenhuma competência cadastrada para ${_setorAtivoComp}.</div>
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
      if (av) { soma += av.nivel; n++; }
    });
    return { competencia: c, media: n>0?soma/n:0, avaliados: n };
  });

  // Nível médio por funcionário (linha)
  const mediaPorFuncionario = funcionarios.map(f => {
    let soma=0, n=0;
    competencias.forEach(c => {
      const av = _nivelAtual(f.nome, c.id);
      if (av) { soma += av.nivel; n++; }
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

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-weight:700;color:#1e3a5f;font-size:15px">🗺️ Matriz — clique numa célula para avaliar</div>
      <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="abrirGerenciarCompetencias()">⚙️ Gerenciar Competências</button>
    </div>
    <div class="table-wrap">
      <table style="border-collapse:separate;border-spacing:3px">
        <thead>
          <tr>
            <th style="text-align:left;min-width:160px">Funcionário</th>
            ${competencias.map(c=>`<th style="writing-mode:vertical-rl;text-orientation:mixed;font-size:11px;padding:8px 4px;max-height:120px;cursor:default" title="${c.nome}">${c.nome}</th>`).join('')}
            <th style="font-size:11px">Média</th>
          </tr>
        </thead>
        <tbody>
          ${funcionarios.map(f => {
            const mediaF = mediaPorFuncionario.find(m=>m.funcionario.nome===f.nome);
            return `<tr>
              <td style="font-weight:600;font-size:12px;color:#1e3a5f;cursor:pointer" onclick="abrirRadarFuncionario('${f.nome.replace(/'/g,"\\'")}')">👤 ${f.nome}</td>
              ${competencias.map(c => {
                const av = _nivelAtual(f.nome, c.id);
                const info = av ? _infoNivel(av.nivel) : { cor:'#cbd5e1', bg:'#f8fafc', label:'Não avaliado' };
                return `<td style="text-align:center;padding:0">
                  <div style="width:36px;height:36px;background:${info.bg};border:2px solid ${info.cor}40;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:800;color:${info.cor};font-size:13px;margin:0 auto"
                    title="${f.nome} · ${c.nome}: ${info.label}"
                    onclick="abrirModalAvaliar('${f.nome.replace(/'/g,"\\'")}',${c.id},'${c.nome.replace(/'/g,"\\'")}')">
                    ${av ? av.nivel : '—'}
                  </div>
                </td>`;
              }).join('')}
              <td style="text-align:center;font-weight:800;color:${cor}">${mediaF.avaliados>0?mediaF.media.toFixed(1):'—'}</td>
            </tr>`;
          }).join('')}
          <tr style="border-top:2px solid #e2e8f0">
            <td style="font-weight:700;font-size:12px;color:#64748b">Média da Competência</td>
            ${mediaPorCompetencia.map(m=>`<td style="text-align:center;font-weight:700;font-size:12px;color:${cor}">${m.avaliados>0?m.media.toFixed(1):'—'}</td>`).join('')}
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9">
      ${_NIVEIS_COMP.map(n=>`<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b">
        <span style="width:14px;height:14px;background:${n.bg};border:2px solid ${n.cor}40;border-radius:4px;display:inline-block"></span>${n.v} — ${n.label}
      </span>`).join('')}
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
  const dadosRadar = competencias.map(c => {
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
        labels: competencias.map(c=>c.nome),
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
function abrirModalAvaliar(funcionario, competenciaId, competenciaNome) {
  const avAtual = _nivelAtual(funcionario, competenciaId);
  const div = document.createElement('div');
  div.id = 'modalAvaliarWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharModalAvaliar()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:420px">
    <div class="modal-header"><h3>🎯 Avaliar Competência</h3><button onclick="fecharModalAvaliar()">✕</button></div>
    <div class="modal-body">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px">Funcionário</div>
      <div style="font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:14px">${funcionario}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:4px">Competência</div>
      <div style="font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:14px">${competenciaNome}</div>
      <label>Nível *</label>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px" id="nivelBtns">
        ${_NIVEIS_COMP.map(n => `<label style="cursor:pointer;border:2px solid ${avAtual?.nivel===n.v?n.cor:'#e2e8f0'};background:${avAtual?.nivel===n.v?n.bg:'#fff'};border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:${avAtual?.nivel===n.v?n.cor:'#64748b'}"
          onclick="selecionarNivelAvaliacao(${n.v})">
          <input type="radio" name="nivelAval" value="${n.v}" ${avAtual?.nivel===n.v?'checked':''} style="display:none">
          <b>${n.v}</b> — ${n.label}
        </label>`).join('')}
      </div>
      <input type="hidden" id="nivelSelecionado" value="${avAtual?.nivel ?? ''}">
      <div class="form-group" style="margin-top:14px">
        <label>Observação</label>
        <input type="text" id="avalObs" placeholder="Opcional..." value="${(avAtual?.observacao||'').replace(/"/g,'&quot;')}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarAvaliacao('${funcionario.replace(/'/g,"\\'")}',${competenciaId})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharModalAvaliar()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

function selecionarNivelAvaliacao(v) {
  document.getElementById('nivelSelecionado').value = v;
  document.querySelectorAll('#nivelBtns label').forEach(lbl => {
    const val = parseInt(lbl.querySelector('input')?.value);
    const info = _infoNivel(val);
    const ativo = val === v;
    lbl.style.borderColor = ativo ? info.cor : '#e2e8f0';
    lbl.style.background  = ativo ? info.bg  : '#fff';
    lbl.style.color       = ativo ? info.cor : '#64748b';
  });
}

async function salvarAvaliacao(funcionario, competenciaId) {
  const nivelStr = document.getElementById('nivelSelecionado')?.value;
  if (nivelStr === '') return toast('Selecione o nível.','erro');
  const nivel = parseInt(nivelStr);
  const observacao = document.getElementById('avalObs')?.value?.trim() || null;
  try {
    await db.salvarAvaliacaoCompetencia({
      funcionario, competencia_id: competenciaId, nivel, observacao,
      avaliado_por: _sessao?.nome || null
    });
    toast('Avaliação registrada!','sucesso');
    fecharModalAvaliar();
    await carregarMatrizCompetencias(_setorAtivoComp);
  } catch(e) { toast('Erro ao salvar avaliação.','erro'); console.error(e); }
}

function fecharModalAvaliar() { document.getElementById('modalAvaliarWrap')?.remove(); }

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
      <div class="form-group"><label>Nome da Competência *</label><input type="text" id="novaCompNome" placeholder="Ex: Operação CNC, Troca de Copo..."></div>
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
  if (!nome) return toast('Informe o nome da competência.','erro');
  try {
    await db.salvarCompetencia({ setor: _setorAtivoComp, nome, descricao, ativo: true });
    toast('Competência adicionada!','sucesso');
    fecharModalNovaCompetencia();
    await carregarMatrizCompetencias(_setorAtivoComp);
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

function fecharModalNovaCompetencia() { document.getElementById('modalNovaCompWrap')?.remove(); }

function abrirGerenciarCompetencias() {
  const div = document.createElement('div');
  div.id = 'modalGerCompWrap';
  const lista = _dadosComp.competencias;
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharGerenciarCompetencias()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:460px">
    <div class="modal-header"><h3>⚙️ Competências — ${_setorAtivoComp}</h3><button onclick="fecharGerenciarCompetencias()">✕</button></div>
    <div class="modal-body">
      ${lista.length ? lista.map(c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #f1f5f9">
          <div>
            <div style="font-size:13px;font-weight:600;color:#1e3a5f">${c.nome}</div>
            ${c.descricao?`<div style="font-size:11px;color:#94a3b8">${c.descricao}</div>`:''}
          </div>
          <button class="btn-icon danger" onclick="excluirCompetenciaConfirm(${c.id},'${c.nome.replace(/'/g,"\\'")}')">🗑️</button>
        </div>`).join('') : '<div class="empty-msg">Nenhuma competência cadastrada.</div>'}
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
