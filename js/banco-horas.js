// ==========================================
// 🏦 BANCO-HORAS.JS — Controle de Banco de Horas
// ==========================================

var _todosBancoHoras = [];
var _filtroFuncBancoHoras = 'Todos';

function fmtMinSaldo(mins) {
  const sinal = mins < 0 ? '-' : '';
  const abs = Math.abs(mins);
  const h = Math.floor(abs/60), m = Math.round(abs%60);
  return sinal + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + 'h';
}

async function calcularSaldoBancoHoras(nome) {
  try {
    const res = await db.listarBancoHoras(nome);
    let saldo = 0;
    (res||[]).forEach(r => { saldo += (r.tipo==='Credito' ? 1 : -1) * (r.minutos||0); });
    return saldo;
  } catch(e) { return 0; }
}

// ==========================================
// 🔄 CRÉDITO AUTOMÁTICO — Sincroniza Horas Extras
// ==========================================
// Converte "HH:MM" ou "HH:MM:SS" em minutos desde 00:00
function _paraMinutosDoDia(hstr) {
  if (!hstr) return null;
  const partes = String(hstr).split(':');
  const h = parseInt(partes[0], 10), m = parseInt(partes[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h*60 + m;
}

// Mescla intervalos sobrepostos/adjacentes e retorna o total de minutos ÚNICOS trabalhados
// (evita contar 2x quando o operador tem lançamentos simultâneos em máquinas diferentes)
function _mesclarIntervalos(intervalos) {
  if (!intervalos.length) return 0;
  const ordenados = intervalos.slice().sort((a,b)=>a[0]-b[0]);
  let total = 0;
  let [curIni, curFim] = ordenados[0];
  for (let i=1; i<ordenados.length; i++) {
    const [ini, fim] = ordenados[i];
    if (ini <= curFim) {
      if (fim > curFim) curFim = fim; // estende o intervalo atual
    } else {
      total += (curFim - curIni);
      curIni = ini; curFim = fim;
    }
  }
  total += (curFim - curIni);
  return total;
}

async function sincronizarHorasExtras() {
  const ini = document.getElementById('bhSincIni')?.value;
  const fim = document.getElementById('bhSincFim')?.value;
  if (!ini || !fim) return toast('Selecione o período para sincronizar.','erro');
  const btn = document.getElementById('btnSincHE');
  if (btn) { btn.disabled = true; btn.innerText = 'Sincronizando...'; }
  try {
    const [lancamentos, funcionarios, feriados] = await Promise.all([
      db._get('lancamentos', 'data=gte.'+ini+'&data=lte.'+fim, 'funcionario,data,minutos,hora_inicio,hora_fim'),
      db._get('funcionarios', 'ativo=eq.true', '*'),
      db._get('feriados', '', 'data')
    ]);
    const feriadosArr = (feriados||[]).map(f=>f.data);

    // Agrupa por funcionário+dia, guardando os INTERVALOS de horário (não só a soma bruta)
    // para não contar duas vezes quando o operador trabalha em mais de uma máquina ao mesmo tempo.
    const porDia = {};
    (lancamentos||[]).forEach(l => {
      const f = (funcionarios||[]).find(fn=>fn.nome===l.funcionario);
      if (!f) return;
      if (f.setor === 'Supervisão' || f.cargo === 'Supervisor' || f.cargo === 'Encarregado' || f.cargo === 'Líder de Ferramentaria') return;
      const turno = f.turno || '5x2';
      if (typeof funcTrabalhaEmDia !== 'function') return;
      if (funcTrabalhaEmDia(turno, l.data, feriadosArr)) return; // dia normal, não é hora extra

      const key = l.funcionario + '|' + l.data;
      if (!porDia[key]) porDia[key] = { funcionario:l.funcionario, data:l.data, intervalos:[] };

      const iniMin = _paraMinutosDoDia(l.hora_inicio);
      let fimMin   = _paraMinutosDoDia(l.hora_fim);
      if (iniMin !== null && fimMin !== null) {
        if (fimMin < iniMin) fimMin += 1440; // atravessou meia-noite
        porDia[key].intervalos.push([iniMin, fimMin]);
      }
    });

    let criados = 0, ignorados = 0;
    for (const key of Object.keys(porDia)) {
      const item = porDia[key];
      const minutosReais = _mesclarIntervalos(item.intervalos);
      if (minutosReais <= 0) continue;
      const refId = 'HE-' + item.funcionario + '-' + item.data;
      const jaExiste = await db.buscarBancoHorasPorReferencia(refId);
      if (jaExiste) { ignorados++; continue; }
      await db.salvarBancoHoras({
        funcionario: item.funcionario, data: item.data, tipo: 'Credito',
        origem: 'Hora Extra Automática', minutos: minutosReais,
        descricao: 'Trabalho em dia fora da escala normal (horários sobrepostos mesclados)',
        referencia_id: refId, criado_por: _sessao?.nome || null
      });
      criados++;
    }
    toast(`Sincronizado! ${criados} crédito(s) novo(s), ${ignorados} já existiam.`, 'sucesso');
    await renderizarBancoHoras();
  } catch(e) { toast('Erro ao sincronizar.','erro'); console.error(e); }
  if (btn) { btn.disabled = false; btn.innerText = '🔄 Sincronizar Horas Extras'; }
}

// ==========================================
// ➖ DÉBITO AUTOMÁTICO — Folga Compensatória
// ==========================================
async function registrarDebitoFolgaCompensatoria(funcionario, inicio, fim, feriasId) {
  try {
    const refId = 'FC-' + (feriasId || (funcionario+inicio+fim));
    const jaExiste = await db.buscarBancoHorasPorReferencia(refId);
    if (jaExiste) return;

    const [funcRow, feriadosRows] = await Promise.all([
      db._get('funcionarios', 'nome=eq.'+encodeURIComponent(funcionario), 'turno'),
      db._get('feriados', '', 'data')
    ]);
    const turno = (funcRow && funcRow[0] && funcRow[0].turno) || '5x2';
    const feriadosArr = (feriadosRows||[]).map(f=>f.data);

    if (typeof funcTrabalhaEmDia !== 'function' || typeof capMinutosPorTurno !== 'function') return;

    let totalMin = 0;
    for (let d=new Date(inicio+'T12:00:00'); d<=new Date(fim+'T12:00:00'); d.setDate(d.getDate()+1)) {
      const ds = d.toISOString().split('T')[0];
      if (funcTrabalhaEmDia(turno, ds, feriadosArr)) totalMin += capMinutosPorTurno(turno);
    }
    if (totalMin <= 0) return;

    await db.salvarBancoHoras({
      funcionario, data: inicio, tipo: 'Debito', origem: 'Folga Compensatória Automática',
      minutos: totalMin,
      descricao: 'Débito referente à folga de ' + inicio.split('-').reverse().join('/') + ' a ' + fim.split('-').reverse().join('/'),
      referencia_id: refId, criado_por: _sessao?.nome || null
    });
    toast('Débito de banco de horas registrado automaticamente ('+fmtMinSaldo(totalMin)+').', 'sucesso');
  } catch(e) { console.error('Erro ao registrar débito de folga compensatória:', e); }
}

// ==========================================
// 🖥️ TELA — BANCO DE HORAS (dentro de Gestão e RH)
// ==========================================
async function inicializarBancoHoras() {
  const el = document.getElementById('painelBancoHoras');
  if (!el) return;

  const funcs = (_listas?.funcionarios||[])
    .concat(_listas?.funcBancada||[])
    .concat(_listas?.funcProjeto||[])
    .concat(_listas?.funcProducao||[])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const hojeStr = hoje.toISOString().split('T')[0];

  el.innerHTML = `
  <div class="card" style="background:#eff6ff;border-color:#bfdbfe">
    <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:12px">🔄 Sincronizar Horas Extras (Crédito Automático)</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:12px">Varre os lançamentos no período e credita automaticamente quem trabalhou fora da escala normal (feriados, fins de semana, folgas). Não duplica créditos já sincronizados.</div>
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="margin-bottom:0"><label>Início</label><input type="date" id="bhSincIni" value="${primeiroDia}"></div>
      <div class="form-group" style="margin-bottom:0"><label>Fim</label><input type="date" id="bhSincFim" value="${hojeStr}"></div>
      <button class="btn-primary" id="btnSincHE" onclick="sincronizarHorasExtras()">🔄 Sincronizar Horas Extras</button>
    </div>
  </div>

  <div class="card">
    <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:12px">✏️ Lançamento Manual</div>
    <div class="form-row">
      <div class="form-group"><label>Técnico *</label><select id="bhManFunc"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${f}">${f}</option>`).join('')}</select></div>
      <div class="form-group"><label>Tipo *</label>
        <select id="bhManTipo">
          <option value="Credito">➕ Crédito</option>
          <option value="Debito">➖ Débito</option>
        </select>
      </div>
      <div class="form-group"><label>Horas *</label><input type="number" id="bhManHoras" step="0.25" min="0" placeholder="Ex: 2.5"></div>
      <div class="form-group"><label>Data *</label><input type="date" id="bhManData" value="${hojeStr}"></div>
    </div>
    <div class="form-group"><label>Descrição</label><input type="text" id="bhManDesc" placeholder="Motivo do ajuste..."></div>
    <button class="btn-success" onclick="salvarBancoHorasManual()">+ Lançar</button>
  </div>

  <div class="card">
    <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:16px">📊 Saldo por Técnico</div>
    <div id="resumoSaldosBH"><div class="loader-inline"><div class="spinner-sm"></div><span>Carregando...</span></div></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-size:13px;font-weight:700;color:#1e3a5f">📋 Extrato Completo</div>
      <select id="bhFiltroExtrato" onchange="filtrarExtratoBH()" style="width:auto">
        <option value="Todos">Todos os Técnicos</option>
        ${funcs.map(f=>`<option value="${f}">${f}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Técnico</th><th>Tipo</th><th>Origem</th><th>Horas</th><th>Descrição</th><th>Ação</th></tr></thead>
        <tbody id="tbodyExtratoBH"><tr><td colspan="7" class="empty-msg">Carregando...</td></tr></tbody>
      </table>
    </div>
  </div>`;

  await renderizarBancoHoras();
}

async function renderizarBancoHoras() {
  try {
    _todosBancoHoras = await db.listarBancoHoras() || [];
    _renderizarResumoSaldosBH();
    filtrarExtratoBH();
  } catch(e) {
    toast('Erro ao carregar banco de horas.','erro');
    console.error(e);
  }
}

function _renderizarResumoSaldosBH() {
  const el = document.getElementById('resumoSaldosBH');
  if (!el) return;
  const porFunc = {};
  _todosBancoHoras.forEach(r => {
    if (!porFunc[r.funcionario]) porFunc[r.funcionario] = 0;
    porFunc[r.funcionario] += (r.tipo==='Credito' ? 1 : -1) * (r.minutos||0);
  });
  const entradas = Object.entries(porFunc).sort((a,b)=>a[0].localeCompare(b[0]));

  if (!entradas.length) {
    el.innerHTML = '<div style="color:#94a3b8;font-size:13px">Nenhum lançamento de banco de horas ainda.</div>';
    return;
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
    ${entradas.map(([nome,saldo]) => {
      const cor = saldo>0?'#059669':saldo<0?'#dc2626':'#64748b';
      const bg  = saldo>0?'#d1fae5':saldo<0?'#fee2e2':'#f1f5f9';
      return `<div style="background:${bg};border-radius:10px;padding:12px;cursor:pointer" onclick="filtrarExtratoPorTecnicoBH('${nome.replace(/'/g,"\\'")}')">
        <div style="font-size:12px;font-weight:600;color:#1e3a5f">${nome}</div>
        <div style="font-size:20px;font-weight:800;color:${cor};margin-top:4px">${fmtMinSaldo(saldo)}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function filtrarExtratoPorTecnicoBH(nome) {
  const sel = document.getElementById('bhFiltroExtrato');
  if (sel) sel.value = nome;
  filtrarExtratoBH();
}

function filtrarExtratoBH() {
  const val = document.getElementById('bhFiltroExtrato')?.value || 'Todos';
  _filtroFuncBancoHoras = val;
  const filtrado = val === 'Todos' ? _todosBancoHoras : _todosBancoHoras.filter(r => r.funcionario === val);
  _renderizarTabelaExtratoBH(filtrado);
}

function _renderizarTabelaExtratoBH(lista) {
  const tbody = document.getElementById('tbodyExtratoBH');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">Nenhum registro encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(r => {
    const corTipo = r.tipo==='Credito' ? '#059669' : '#dc2626';
    const icoTipo = r.tipo==='Credito' ? '➕' : '➖';
    const ehManual = r.origem === 'Ajuste Manual';
    return `<tr>
      <td><b>${r.data?r.data.split('-').reverse().join('/'):'—'}</b></td>
      <td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(r.funcionario):r.funcionario}</td>
      <td><span style="color:${corTipo};font-weight:700">${icoTipo} ${r.tipo==='Credito'?'Crédito':'Débito'}</span></td>
      <td style="font-size:11px;color:#64748b">${r.origem}</td>
      <td style="font-weight:700;color:${corTipo}">${fmtMinSaldo(r.tipo==='Credito'?r.minutos:-r.minutos)}</td>
      <td style="font-size:12px;color:#64748b">${r.descricao||'—'}</td>
      <td>
        ${ehManual ? `<button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick='abrirEdicaoBancoHoras(${JSON.stringify(r).replace(/'/g,"&apos;")})'>✏️</button>` : ''}
        <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="excluirBancoHorasConfirm(${r.id})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ==========================================
// ➕ LANÇAMENTO MANUAL
// ==========================================
async function salvarBancoHorasManual() {
  const funcionario = document.getElementById('bhManFunc')?.value;
  const tipo         = document.getElementById('bhManTipo')?.value;
  const horas        = parseFloat(document.getElementById('bhManHoras')?.value);
  const data         = document.getElementById('bhManData')?.value;
  const descricao    = document.getElementById('bhManDesc')?.value?.trim() || null;

  if (!funcionario) return toast('Selecione o técnico.','erro');
  if (!horas || horas <= 0) return toast('Informe a quantidade de horas.','erro');
  if (!data) return toast('Informe a data.','erro');

  try {
    await db.salvarBancoHoras({
      funcionario, data, tipo, origem: 'Ajuste Manual',
      minutos: Math.round(horas*60), descricao,
      criado_por: _sessao?.nome || null
    });
    toast('Lançamento registrado!','sucesso');
    ['bhManFunc','bhManHoras','bhManDesc'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
    await renderizarBancoHoras();
  } catch(e) { toast('Erro ao lançar.','erro'); console.error(e); }
}

// ==========================================
// ✏️ EDITAR (só Ajuste Manual)
// ==========================================
function abrirEdicaoBancoHoras(r) {
  const funcs = (_listas?.funcionarios||[])
    .concat(_listas?.funcBancada||[]).concat(_listas?.funcProjeto||[]).concat(_listas?.funcProducao||[])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();
  const div = document.createElement('div');
  div.id = 'modalEditBHWrap';
  const horasAtual = (r.minutos/60).toFixed(2);
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharEdicaoBancoHoras()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:440px">
    <div class="modal-header"><h3>✏️ Editar Lançamento</h3><button onclick="fecharEdicaoBancoHoras()">✕</button></div>
    <div class="modal-body">
      <div class="form-group"><label>Técnico *</label>
        <select id="efBHFunc">${funcs.map(f=>`<option value="${f}" ${r.funcionario===f?'selected':''}>${f}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tipo *</label>
          <select id="efBHTipo">
            <option value="Credito" ${r.tipo==='Credito'?'selected':''}>➕ Crédito</option>
            <option value="Debito" ${r.tipo==='Debito'?'selected':''}>➖ Débito</option>
          </select>
        </div>
        <div class="form-group"><label>Horas *</label><input type="number" id="efBHHoras" step="0.25" min="0" value="${horasAtual}"></div>
      </div>
      <div class="form-group"><label>Data *</label><input type="date" id="efBHData" value="${r.data||''}"></div>
      <div class="form-group"><label>Descrição</label><input type="text" id="efBHDesc" value="${(r.descricao||'').replace(/"/g,'&quot;')}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="salvarEdicaoBancoHoras(${r.id})">💾 Salvar</button>
      <button class="btn-secondary" onclick="fecharEdicaoBancoHoras()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}

async function salvarEdicaoBancoHoras(id) {
  const funcionario = document.getElementById('efBHFunc')?.value;
  const tipo         = document.getElementById('efBHTipo')?.value;
  const horas        = parseFloat(document.getElementById('efBHHoras')?.value);
  const data         = document.getElementById('efBHData')?.value;
  const descricao    = document.getElementById('efBHDesc')?.value?.trim() || null;
  if (!funcionario || !horas || horas<=0 || !data) return toast('Preencha todos os campos.','erro');
  try {
    await db.salvarBancoHoras({ id, funcionario, tipo, data, minutos: Math.round(horas*60), descricao });
    toast('Atualizado!','sucesso');
    fecharEdicaoBancoHoras();
    await renderizarBancoHoras();
  } catch(e) { toast('Erro ao salvar.','erro'); }
}

function fecharEdicaoBancoHoras() { document.getElementById('modalEditBHWrap')?.remove(); }

function excluirBancoHorasConfirm(id) {
  confirmarExclusao('Excluir este lançamento do banco de horas?', async () => {
    try {
      await db.excluirBancoHoras(id);
      toast('Removido!','sucesso');
      await renderizarBancoHoras();
    } catch(e) { toast('Erro ao excluir.','erro'); }
  });
}

// ==========================================
// 🎫 SALDO NA FICHA DO FUNCIONÁRIO
// ==========================================
async function renderizarSaldoBancoHorasNaFicha(nome, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:#94a3b8">Calculando saldo...</div>';
  try {
    const saldo = await calcularSaldoBancoHoras(nome);
    const cor = saldo>0?'#059669':saldo<0?'#dc2626':'#64748b';
    el.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px">🏦 BANCO DE HORAS</div>
    <div style="font-size:24px;font-weight:800;color:${cor};margin-bottom:4px">${fmtMinSaldo(saldo)}</div>
    <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="_irParaBancoHorasFuncionario('${nome.replace(/'/g,"\\'")}')">📋 Ver extrato</button>`;
  } catch(e) {
    el.innerHTML = '<div style="font-size:12px;color:#94a3b8">Erro ao calcular saldo.</div>';
  }
}

function _irParaBancoHorasFuncionario(nome) {
  document.getElementById('modalFichaFuncWrap')?.remove();
  irPara('feriados', document.getElementById('menuFeriados'));
  setTimeout(() => {
    mudarTabRH('bancoHoras', document.querySelector('.tab-rh:nth-child(4)'));
    setTimeout(() => filtrarExtratoPorTecnicoBH(nome), 300);
  }, 150);
}
