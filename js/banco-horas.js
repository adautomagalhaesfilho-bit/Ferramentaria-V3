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

// ==========================================
// 🧮 REGRA DO SALDO (valem para a tela, a ficha e o Dashboard)
//  - "Acerto de Saldo" = saldo oficial digitado numa data. O saldo passa a ser:
//      saldo do acerto + lançamentos VALIDADOS com data DEPOIS da data do acerto.
//    O que é da data do acerto ou anterior fica no extrato, mas não soma.
//  - Só lançamentos "Validado" entram no saldo. "Pendente" aparece à parte e "Recusado" não conta.
// ==========================================
const _ORIGEM_ACERTO_BH = 'Acerto de Saldo';
function _sinalBH(r) { return (r.tipo==='Credito' ? 1 : -1) * (r.minutos||0); }
function _statusBH(r) { return r.status || 'Validado'; }

// registros = lançamentos de UM funcionário
function calcularSaldoBH(registros) {
  const acertos = (registros||[]).filter(r => r.origem === _ORIGEM_ACERTO_BH && _statusBH(r) !== 'Recusado')
    .sort((a,b) => (a.data===b.data ? (a.id-b.id) : a.data.localeCompare(b.data)));
  const acerto = acertos.length ? acertos[acertos.length-1] : null;
  let saldo = acerto ? _sinalBH(acerto) : 0, pendente = 0, qtdPendente = 0;
  (registros||[]).forEach(r => {
    if (r === acerto || r.origem === _ORIGEM_ACERTO_BH) return;
    if (acerto && r.data <= acerto.data) return;
    const st = _statusBH(r);
    if (st === 'Validado') saldo += _sinalBH(r);
    else if (st === 'Pendente') { pendente += _sinalBH(r); qtdPendente++; }
  });
  return { saldo, pendente, qtdPendente, acertoData: acerto ? acerto.data : null };
}

// todos = lançamentos de vários funcionários -> { nome: {saldo, pendente, ...} }
function calcularSaldosBH(todos) {
  const porFunc = {};
  (todos||[]).forEach(r => { if (r.funcionario) (porFunc[r.funcionario] = porFunc[r.funcionario] || []).push(r); });
  const out = {};
  Object.keys(porFunc).forEach(n => { out[n] = calcularSaldoBH(porFunc[n]); });
  return out;
}

async function calcularSaldoBancoHoras(nome) {
  try {
    const res = await db.listarBancoHoras(nome);
    return calcularSaldoBH(res||[]).saldo;
  } catch(e) { avisarErro('calcular o saldo do banco de horas', e); return 0; }
}

// Atalho do painel inicial: abre RH > Banco de Horas (onde ficam os pendentes)
function irParaPendentesBH() {
  const menu = document.getElementById('menuFeriados');
  irPara('feriados', menu);
  setTimeout(() => {
    const btn = [...document.querySelectorAll('.tab-rh')].find(b => (b.getAttribute('onclick')||'').includes('bancoHoras'));
    mudarTabRH('bancoHoras', btn);
  }, 250);
}

function _podeValidarBH() { return ['admin','gestor','supervisor'].includes(_sessao?.perfil); }

// Aceita "12:30", "-12:30", "+3", "-12,5", "2.25" -> minutos (com sinal) ou null
function _parseHorasBH(txt) {
  const t = String(txt||'').trim().replace(',', '.');
  if (!t) return null;
  const neg = t.startsWith('-');
  const corpo = t.replace(/^[+-]/, '');
  let min;
  if (corpo.includes(':')) {
    const [h, m] = corpo.split(':');
    if (!/^\d+$/.test(h) || !/^\d{1,2}$/.test(m||'0')) return null;
    min = parseInt(h,10)*60 + parseInt(m||'0',10);
  } else {
    if (!/^\d+(\.\d+)?$/.test(corpo)) return null;
    min = Math.round(parseFloat(corpo)*60);
  }
  return neg ? -min : min;
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

// Mescla intervalos sobrepostos/adjacentes e retorna os BLOCOS mesclados (ordenados, sem sobreposição)
function _mesclarIntervalosArray(intervalos) {
  if (!intervalos.length) return [];
  const ordenados = intervalos.slice().sort((a,b)=>a[0]-b[0]);
  const resultado = [];
  let [curIni, curFim] = ordenados[0];
  for (let i=1; i<ordenados.length; i++) {
    const [ini, fim] = ordenados[i];
    if (ini <= curFim) {
      if (fim > curFim) curFim = fim;
    } else {
      resultado.push([curIni, curFim]);
      curIni = ini; curFim = fim;
    }
  }
  resultado.push([curIni, curFim]);
  return resultado;
}

// Mescla intervalos sobrepostos/adjacentes e retorna o total de minutos ÚNICOS trabalhados
// (evita contar 2x quando o operador tem lançamentos simultâneos em máquinas diferentes)
function _mesclarIntervalos(intervalos) {
  return _mesclarIntervalosArray(intervalos).reduce((soma, [ini, fim]) => soma + (fim - ini), 0);
}

// Dado os blocos mesclados de um dia e o horário oficial do turno (em minutos desde 00:00),
// retorna quantos minutos ficaram FORA do expediente (chegou mais cedo + saiu mais tarde).
// O tempo dentro do próprio horário do turno não conta aqui (isso é jornada normal).
function _minutosForaDoTurno(blocosMesclados, entradaMin, saidaMin) {
  let fora = 0;
  blocosMesclados.forEach(([ini, fim]) => {
    const overlapIni = Math.max(ini, entradaMin);
    const overlapFim = Math.min(fim, saidaMin);
    const dentroTurno = Math.max(0, overlapFim - overlapIni);
    fora += (fim - ini) - dentroTurno;
  });
  return fora;
}

// Ciclo padrão do relatório: do dia 16 ao dia 15 mais recente já ocorrido
function _cicloBH() {
  const h = new Date(); h.setHours(12,0,0,0);
  const fim = new Date(h.getFullYear(), h.getMonth(), 15, 12);
  if (h.getDate() < 15) fim.setMonth(fim.getMonth() - 1);
  const ini = new Date(fim.getFullYear(), fim.getMonth() - 1, 16, 12);
  return { ini: dataLocal(ini), fim: dataLocal(fim) };
}

function exportarRelatorioMensalBH() {
  if (typeof XLSX === 'undefined') return toast('Biblioteca do Excel não carregou. Atualize a página (Ctrl+Shift+R).','erro');
  const ini = document.getElementById('bhRelIni')?.value, fim = document.getElementById('bhRelFim')?.value;
  if (!ini || !fim || ini > fim) return toast('Informe um período válido.','erro');
  const br = d => d ? String(d).split('-').reverse().join('/') : '';
  const hm = m => { m = Math.round(m||0); const a = Math.abs(m); return (m<0?'-':'') + Math.floor(a/60) + ':' + String(a%60).padStart(2,'0'); };

  const porFunc = {};
  (_todosBancoHoras||[]).forEach(r => { if (r.funcionario) (porFunc[r.funcionario] = porFunc[r.funcionario] || []).push(r); });
  const linhas = [];
  Object.keys(porFunc).sort().forEach(nome => {
    const regs = porFunc[nome];
    const inicial = calcularSaldoBH(regs.filter(r => r.data < ini)).saldo;
    const finalR  = calcularSaldoBH(regs.filter(r => r.data <= fim));
    const noPeriodo = regs.filter(r => r.data >= ini && r.data <= fim);
    let cred = 0, deb = 0, pend = 0, qPend = 0;
    noPeriodo.forEach(r => {
      if (r.origem === _ORIGEM_ACERTO_BH) return;
      const st = _statusBH(r);
      if (st === 'Validado') { if (r.tipo === 'Credito') cred += r.minutos||0; else deb += r.minutos||0; }
      else if (st === 'Pendente') { pend += _sinalBH(r); qPend++; }
    });
    if (!noPeriodo.length && !inicial && !finalR.saldo) return;
    const ajuste = finalR.saldo - (inicial + cred - deb);
    linhas.push([nome, hm(inicial), hm(cred), hm(-deb), hm(ajuste), hm(finalR.saldo), qPend ? hm(pend) + ' (' + qPend + ')' : '—', inicial, cred, -deb, ajuste, finalR.saldo, pend]);
  });
  if (!linhas.length) return toast('Nenhum dado de banco de horas no período.','erro');

  const cab = ['Técnico','Saldo inicial','Créditos validados','Débitos validados','Ajuste (acerto de saldo)','Saldo final','Aguardando validação (qtd)','Saldo inicial (min)','Créditos (min)','Débitos (min)','Ajuste (min)','Saldo final (min)','Pendente (min)'];
  const tot = i => linhas.reduce((a,r) => a + (r[i]||0), 0);
  const totais = ['TOTAL', hm(tot(7)), hm(tot(8)), hm(tot(9)), hm(tot(10)), hm(tot(11)), hm(tot(12)), tot(7), tot(8), tot(9), tot(10), tot(11), tot(12)];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([['Relatório de Banco de Horas'], ['Período', br(ini) + ' a ' + br(fim)], ['Saldo final = saldo oficial (acerto) + movimentos validados. Pendentes não entram.'], [], cab, ...linhas, totais]);
  ws1['!cols'] = cab.map((c,i) => ({ wch: i === 0 ? 40 : 16 }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');

  const ext = (_todosBancoHoras||[]).filter(r => r.data >= ini && r.data <= fim)
    .sort((a,b) => a.funcionario.localeCompare(b.funcionario) || a.data.localeCompare(b.data) || (a.id-b.id))
    .map(r => [br(r.data), r.funcionario, r.tipo === 'Credito' ? 'Crédito' : 'Débito', r.origem||'', hm(_sinalBH(r)), _sinalBH(r), _statusBH(r), r.validado_por||'', r.descricao||'']);
  const cabE = ['Data','Técnico','Tipo','Origem','Horas','Minutos','Situação','Validado por','Descrição'];
  const ws2 = XLSX.utils.aoa_to_sheet([cabE, ...ext]);
  ws2['!cols'] = [{wch:11},{wch:38},{wch:9},{wch:22},{wch:9},{wch:9},{wch:11},{wch:22},{wch:70}];
  ws2['!autofilter'] = { ref: XLSX.utils.encode_range({ s:{r:0,c:0}, e:{r:Math.max(ext.length,1),c:cabE.length-1} }) };
  XLSX.utils.book_append_sheet(wb, ws2, 'Extrato do período');
  XLSX.writeFile(wb, `BancoHoras_${ini}_a_${fim}.xlsx`);
  toast('Relatório exportado!','sucesso');
}

async function sincronizarHorasExtras() {
  const ini = document.getElementById('bhSincIni')?.value;
  const fim = document.getElementById('bhSincFim')?.value;
  if (!ini || !fim) return toast('Selecione o período para sincronizar.','erro');
  const btn = document.getElementById('btnSincHE');
  if (btn) { btn.disabled = true; btn.innerText = 'Sincronizando...'; }
  try {
    const [lancamentos, funcionarios, feriados, turnos] = await Promise.all([
      db._get('lancamentos', 'data=gte.'+ini+'&data=lte.'+fim, 'funcionario,data,minutos,hora_inicio,hora_fim'),
      db._get('funcionarios', 'ativo=eq.true', '*'),
      db._get('feriados', '', 'data'),
      db._get('turnos', 'ativo=eq.true', 'nome,hora_entrada,hora_saida')
    ]);
    const feriadosArr = (feriados||[]).map(f=>f.data);

    // Mapa turno -> horário oficial de entrada/saída (em minutos desde 00:00), vindo da tabela `turnos`
    const turnoHorario = {};
    (turnos||[]).forEach(t => {
      const eMin = _paraMinutosDoDia(t.hora_entrada);
      let sMin = _paraMinutosDoDia(t.hora_saida);
      if (eMin !== null && sMin !== null) {
        if (sMin <= eMin) sMin += 1440; // turno atravessa meia-noite
        turnoHorario[t.nome] = { entrada: eMin, saida: sMin };
      }
    });

    // Agrupa por funcionário+dia, guardando os INTERVALOS de horário (não só a soma bruta)
    // para não contar duas vezes quando o operador trabalha em mais de uma máquina ao mesmo tempo.
    const porDia = {};
    (lancamentos||[]).forEach(l => {
      const f = (funcionarios||[]).find(fn=>fn.nome===l.funcionario);
      if (!f) return;
      if (f.setor === 'Supervisão' || f.cargo === 'Supervisor' || f.cargo === 'Encarregado' || f.cargo === 'Líder de Ferramentaria') return;
      const turno = f.turno || '5x2';
      if (typeof funcTrabalhaEmDia !== 'function') return;
      const diaDaEscala = funcTrabalhaEmDia(turno, l.data, feriadosArr);

      const key = l.funcionario + '|' + l.data;
      if (!porDia[key]) porDia[key] = { funcionario:l.funcionario, data:l.data, turno, diaDaEscala, intervalos:[] };

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
      const blocos = _mesclarIntervalosArray(item.intervalos);

      let minutosExtra, descricao;
      if (!item.diaDaEscala) {
        // Dia fora da escala normal (folga/fim de semana/feriado) — tudo que foi trabalhado é hora extra
        minutosExtra = blocos.reduce((s,[i,f])=>s+(f-i), 0);
        descricao = 'Trabalho em dia fora da escala normal (horários sobrepostos mesclados)';
      } else {
        // Dia normal de trabalho — só conta hora extra o que passou do horário oficial do turno
        // (chegou mais cedo e/ou saiu mais tarde do que hora_entrada/hora_saida da tabela turnos)
        const horario = turnoHorario[item.turno];
        if (!horario) continue; // turno sem horário cadastrado em `turnos` — não dá pra calcular, pula
        minutosExtra = _minutosForaDoTurno(blocos, horario.entrada, horario.saida);
        descricao = 'Hora extra por lançamento fora do horário do turno (entrada antecipada e/ou saída após o expediente)';
      }

      if (!minutosExtra || minutosExtra <= 0) continue;
      const refId = 'HE-' + item.funcionario + '-' + item.data;
      const jaExiste = await db.buscarBancoHorasPorReferencia(refId);
      if (jaExiste) { ignorados++; continue; }
      await db.salvarBancoHoras({
        funcionario: item.funcionario, data: item.data, tipo: 'Credito',
        origem: 'Hora Extra Automática', minutos: minutosExtra,
        descricao, referencia_id: refId, criado_por: _sessao?.nome || null
      });
      criados++;
    }
    toast(`Sincronizado! ${criados} crédito(s) novo(s), ${ignorados} já existiam.`, 'sucesso');
    await renderizarBancoHoras();
  } catch(e) { toast('Erro ao sincronizar.','erro'); console.error(e); }
  if (btn) { btn.disabled = false; btn.innerText = '🔄 Sincronizar Horas Extras'; }
}

// ==========================================
// ➖ DÉBITO AUTOMÁTICO — Saída Antecipada / Banco de Horas (aba Atrasos do RH)
// ==========================================
// Regra combinada com o usuário:
//   - Saída SEM retorno  -> débito = do horário de saída registrado até o fim do expediente do turno
//   - Saída COM retorno  -> débito = tempo que ficou ausente (retorno - saída)
// Chamada em toda criação/edição de um "parcial" (rh_parciais). Usa referencia_id 'PARC-<id>'
// para não duplicar e para poder recalcular quando o registro é editado.
async function sincronizarDebitoParcial(parcial) {
  try {
    const motivosComDebito = ['Saída Antecipada', 'Banco de Horas'];
    if (!parcial || !motivosComDebito.includes(parcial.motivo) || !parcial.id || !parcial.inicio) return;

    const refId = 'PARC-' + parcial.id;
    // Remove débito anterior deste registro (caso de edição) antes de recalcular
    const existentes = await db._get('banco_horas', 'referencia_id=eq.'+encodeURIComponent(refId), 'id,status,validado_por,validado_em');
    const anterior = (existentes||[])[0] || null; // mantém a validação já feita pelo supervisor
    for (const ex of (existentes||[])) await db.excluirBancoHoras(ex.id);

    const iniMin = _paraMinutosDoDia(parcial.inicio);
    if (iniMin === null) return;
    let minutosDebito = 0;
    let descricao;

    if (parcial.fim) {
      // Saída com retorno no mesmo dia — débito é só o tempo ausente
      const fimMin = _paraMinutosDoDia(parcial.fim);
      if (fimMin === null) return;
      minutosDebito = fimMin - iniMin;
      descricao = 'Ausência com retorno no mesmo dia (débito automático — ' + parcial.motivo + ')';
    } else {
      // Saída sem retorno — débito vai até o fim do expediente do turno dela
      const funcRow = await db._get('funcionarios', 'nome=eq.'+encodeURIComponent(parcial.funcionario), 'turno');
      const turnoNome = (funcRow && funcRow[0] && funcRow[0].turno) || '5x2';
      const turnoRow = await db._get('turnos', 'nome=eq.'+encodeURIComponent(turnoNome)+'&ativo=eq.true', 'hora_saida');
      const saidaTurno = (turnoRow && turnoRow[0]) ? _paraMinutosDoDia(turnoRow[0].hora_saida) : null;
      if (saidaTurno === null) return;
      minutosDebito = saidaTurno - iniMin;
      descricao = 'Saída antecipada sem retorno — débito até o fim do expediente (automático)';
    }

    if (minutosDebito <= 0) return;
    await db.salvarBancoHoras({
      funcionario: parcial.funcionario, data: parcial.data, tipo: 'Debito',
      origem: parcial.motivo, minutos: minutosDebito, descricao,
      referencia_id: refId, criado_por: _sessao?.nome || null,
      ...(anterior ? { status: anterior.status || 'Pendente', validado_por: anterior.validado_por || null, validado_em: anterior.validado_em || null } : {})
    });
  } catch(e) { avisarErro('sincronizar o débito do parcial no banco de horas', e); }
}

// Remove o débito de banco de horas vinculado a um "parcial" excluído
async function removerDebitoParcial(parcialId) {
  try {
    const existentes = await db._get('banco_horas', 'referencia_id=eq.'+encodeURIComponent('PARC-'+parcialId), 'id');
    for (const ex of (existentes||[])) await db.excluirBancoHoras(ex.id);
  } catch(e) { avisarErro('remover o débito do parcial do banco de horas', e); }
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
      const ds = dataLocal(d);
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
  } catch(e) { avisarErro('registrar o débito da folga compensatória', e); }
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
  const primeiroDia = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12));
  const hojeStr = dataLocal(hoje);

  el.innerHTML = `
  <div class="card" style="background:#eff6ff;border-color:#bfdbfe">
    <div style="font-size:13px;font-weight:700;color:#1e40af;margin-bottom:12px">🔄 Sincronizar Horas Extras (Crédito Automático)</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:12px">Varre os lançamentos no período e credita automaticamente quem trabalhou fora da escala normal (feriados, fins de semana, folgas). Não duplica créditos já sincronizados.</div>
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="margin-bottom:0"><label>Início</label><input type="date" id="bhSincIni" value="${esc(primeiroDia)}"></div>
      <div class="form-group" style="margin-bottom:0"><label>Fim</label><input type="date" id="bhSincFim" value="${esc(hojeStr)}"></div>
      <button class="btn-primary" id="btnSincHE" onclick="sincronizarHorasExtras()">🔄 Sincronizar Horas Extras</button>
    </div>
  </div>

  <div class="card" style="background:#f0fdf4;border-color:#bbf7d0">
    <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:6px">📊 Relatório mensal (Excel)</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:12px">Saldo inicial, créditos, débitos, pendentes e saldo final de cada pessoa no período, mais o extrato completo. Padrão: ciclo do dia 16 ao dia 15.</div>
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="margin-bottom:0"><label>Início</label><input type="date" id="bhRelIni" value="${esc(_cicloBH().ini)}"></div>
      <div class="form-group" style="margin-bottom:0"><label>Fim</label><input type="date" id="bhRelFim" value="${esc(_cicloBH().fim)}"></div>
      <button class="btn-success" onclick="exportarRelatorioMensalBH()">📊 Gerar Excel</button>
    </div>
  </div>

  ${_podeValidarBH() ? `
  <div class="card" style="background:#faf5ff;border-color:#e9d5ff">
    <div style="font-size:13px;font-weight:700;color:#6b21a8;margin-bottom:6px">🧮 Acerto de Saldo (digitar o saldo atual)</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:12px">Informe o saldo oficial do técnico numa data. A partir dela o sistema soma só o que for lançado <b>depois</b> daquele dia — o que é anterior continua no extrato, mas não soma por cima.</div>
    <div class="form-row">
      <div class="form-group"><label>Técnico *</label><select id="bhAcFunc" onchange="atualizarPreviaAcertoBH()"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Saldo oficial *</label><input type="text" id="bhAcSaldo" placeholder="Ex: 12:30 ou -8:15" oninput="atualizarPreviaAcertoBH()"></div>
      <div class="form-group"><label>Data do saldo *</label><input type="date" id="bhAcData" value="${esc(hojeStr)}"></div>
    </div>
    <div class="form-group"><label>Observação</label><input type="text" id="bhAcObs" placeholder="Ex: Extrato do RH de 15/10"></div>
    <div id="bhAcPrevia" style="font-size:12px;color:#475569;margin-bottom:10px"></div>
    <button class="btn-primary" onclick="salvarAcertoSaldoBH()">🧮 Aplicar acerto</button>
  </div>

  <div class="card" style="background:#fffbeb;border-color:#fde68a">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:#92400e">⏳ Aguardando validação do supervisor</div>
      <button class="btn-success" style="font-size:12px;padding:5px 12px" onclick="validarTodosPendentesBH()">✅ Validar todos (do filtro)</button>
    </div>
    <div style="font-size:12px;color:#64748b;margin-bottom:10px">Hora extra e atrasos calculados automaticamente só entram no saldo depois de validados. Recusado não conta.</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Técnico</th><th>Origem</th><th>Horas</th><th>Descrição / horários</th><th>Ação</th></tr></thead>
      <tbody id="tbodyPendentesBH"><tr><td colspan="6" class="empty-msg">Carregando...</td></tr></tbody>
    </table></div>
  </div>` : ''}

  <div class="card">
    <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:12px">✏️ Lançamento Manual</div>
    <div class="form-row">
      <div class="form-group"><label>Técnico *</label><select id="bhManFunc"><option value="">Selecione...</option>${funcs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Tipo *</label>
        <select id="bhManTipo">
          <option value="Credito">➕ Crédito</option>
          <option value="Debito">➖ Débito</option>
        </select>
      </div>
      <div class="form-group"><label>Horas *</label><input type="number" id="bhManHoras" step="0.25" min="0" placeholder="Ex: 2.5"></div>
      <div class="form-group"><label>Data *</label><input type="date" id="bhManData" value="${esc(hojeStr)}"></div>
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
        ${funcs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Técnico</th><th>Tipo</th><th>Origem</th><th>Horas</th><th>Situação</th><th>Descrição</th><th>Ação</th></tr></thead>
        <tbody id="tbodyExtratoBH"><tr><td colspan="8" class="empty-msg">Carregando...</td></tr></tbody>
      </table>
    </div>
  </div>`;

  await renderizarBancoHoras();
}

async function renderizarBancoHoras() {
  try {
    _todosBancoHoras = await db.listarBancoHoras() || [];
    _renderizarResumoSaldosBH();
    _renderizarPendentesBH();
    filtrarExtratoBH();
  } catch(e) {
    toast('Erro ao carregar banco de horas.','erro');
    console.error(e);
  }
}

function _renderizarResumoSaldosBH() {
  const el = document.getElementById('resumoSaldosBH');
  if (!el) return;
  const saldos = calcularSaldosBH(_todosBancoHoras);
  const entradas = Object.entries(saldos).sort((a,b)=>a[0].localeCompare(b[0]));

  if (!entradas.length) {
    el.innerHTML = '<div style="color:#94a3b8;font-size:13px">Nenhum lançamento de banco de horas ainda.</div>';
    return;
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
    ${entradas.map(([nome,d]) => {
      const saldo = d.saldo;
      const cor = saldo>0?'#059669':saldo<0?'#dc2626':'#64748b';
      const bg  = saldo>0?'#d1fae5':saldo<0?'#fee2e2':'#f1f5f9';
      const nota = [
        d.acertoData ? `🧮 acerto de ${esc(d.acertoData.split('-').reverse().join('/'))}` : '',
        d.qtdPendente ? `⏳ ${d.qtdPendente} pendente(s): ${esc(fmtMinSaldo(d.pendente))}` : ''
      ].filter(Boolean).join(' · ');
      return `<div style="background:${bg};border-radius:10px;padding:12px;cursor:pointer" onclick="filtrarExtratoPorTecnicoBH('${escJs(nome)}')">
        <div style="font-size:12px;font-weight:600;color:#1e3a5f">${esc(nome)}</div>
        <div style="font-size:20px;font-weight:800;color:${cor};margin-top:4px">${esc(fmtMinSaldo(saldo))}</div>
        ${nota?`<div style="font-size:10px;color:#64748b;margin-top:4px">${nota}</div>`:''}
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
  _renderizarPendentesBH();
}

function _renderizarTabelaExtratoBH(lista) {
  const tbody = document.getElementById('tbodyExtratoBH');
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Nenhum registro encontrado.</td></tr>';
    return;
  }
  const acertoPorFunc = {};
  Object.keys(calcularSaldosBH(_todosBancoHoras)).forEach(n => { acertoPorFunc[n] = calcularSaldoBH(_todosBancoHoras.filter(x=>x.funcionario===n)).acertoData; });
  tbody.innerHTML = lista.map(r => {
    const corTipo = r.tipo==='Credito' ? '#059669' : '#dc2626';
    const icoTipo = r.tipo==='Credito' ? '➕' : '➖';
    const ehManual = r.origem === 'Ajuste Manual';
    const st = _statusBH(r);
    const ehAcerto = r.origem === _ORIGEM_ACERTO_BH;
    const dataAc = acertoPorFunc[r.funcionario];
    const antesDoAcerto = !!(dataAc && !ehAcerto && r.data <= dataAc);
    const situacao = ehAcerto ? '<span style="background:#f3e8ff;color:#6b21a8;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700">🧮 Saldo oficial</span>'
      : antesDoAcerto ? '<span style="background:#f1f5f9;color:#64748b;font-size:10px;padding:2px 8px;border-radius:8px">anterior ao acerto</span>'
      : st==='Pendente' ? '<span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700">⏳ Pendente</span>'
      : st==='Recusado' ? '<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700">❌ Recusado</span>'
      : `<span style="background:#d1fae5;color:#047857;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700" title="${esc(r.validado_por?('Validado por '+r.validado_por):'')}">✅ Validado</span>`;
    const apagado = (antesDoAcerto || st==='Recusado') ? 'opacity:.55;' : '';
    return `<tr style="${apagado}">
      <td><b>${r.data?r.data.split('-').reverse().join('/'):'—'}</b></td>
      <td>${typeof nomeTecnicoClicavel==='function'?nomeTecnicoClicavel(r.funcionario):esc(r.funcionario)}</td>
      <td><span style="color:${esc(corTipo)};font-weight:700">${esc(icoTipo)} ${esc(r.tipo==='Credito'?'Crédito':'Débito')}</span></td>
      <td style="font-size:11px;color:#64748b">${esc(r.origem)}</td>
      <td style="font-weight:700;color:${esc(corTipo)}">${esc(fmtMinSaldo(r.tipo==='Credito'?r.minutos:-r.minutos))}</td>
      <td>${situacao}</td>
      <td style="font-size:12px;color:#64748b">${esc(r.descricao||'—')}</td>
      <td>
        ${(ehManual) ? `<button class="btn-warning" style="padding:4px 8px;font-size:11px;margin-right:4px" onclick="abrirEdicaoBancoHoras(_obj(${_guardarObj(r)}))">✏️</button>` : ''}
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
        <select id="efBHFunc">${funcs.map(f=>`<option value="${esc(f)}" ${r.funcionario===f?'selected':''}>${esc(f)}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tipo *</label>
          <select id="efBHTipo">
            <option value="Credito" ${r.tipo==='Credito'?'selected':''}>➕ Crédito</option>
            <option value="Debito" ${r.tipo==='Debito'?'selected':''}>➖ Débito</option>
          </select>
        </div>
        <div class="form-group"><label>Horas *</label><input type="number" id="efBHHoras" step="0.25" min="0" value="${esc(horasAtual)}"></div>
      </div>
      <div class="form-group"><label>Data *</label><input type="date" id="efBHData" value="${esc(r.data||'')}"></div>
      <div class="form-group"><label>Descrição</label><input type="text" id="efBHDesc" value="${esc(r.descricao||'')}"></div>
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
// 🧮 ACERTO DE SALDO
// ==========================================
function atualizarPreviaAcertoBH() {
  const el = document.getElementById('bhAcPrevia'); if (!el) return;
  const nome = document.getElementById('bhAcFunc')?.value;
  const novo = _parseHorasBH(document.getElementById('bhAcSaldo')?.value);
  if (!nome) { el.innerHTML = ''; return; }
  const atual = calcularSaldoBH(_todosBancoHoras.filter(r => r.funcionario === nome)).saldo;
  el.innerHTML = `Saldo hoje no sistema: <b>${esc(fmtMinSaldo(atual))}</b>` +
    (novo !== null ? ` → passará a ser <b>${esc(fmtMinSaldo(novo))}</b> (diferença de ${esc(fmtMinSaldo(novo-atual))})` : '');
}

async function salvarAcertoSaldoBH() {
  if (!_podeValidarBH()) return toast('Só supervisor, gestor ou administrador pode fazer o acerto de saldo.','erro');
  const funcionario = document.getElementById('bhAcFunc')?.value;
  const minutos = _parseHorasBH(document.getElementById('bhAcSaldo')?.value);
  const data = document.getElementById('bhAcData')?.value;
  const obs = document.getElementById('bhAcObs')?.value?.trim();
  if (!funcionario) return toast('Selecione o técnico.','erro');
  if (minutos === null) return toast('Informe o saldo no formato 12:30 ou -8:15.','erro');
  if (!data) return toast('Informe a data do saldo.','erro');
  const atual = calcularSaldoBH(_todosBancoHoras.filter(r => r.funcionario === funcionario)).saldo;
  confirmarAcao(`Definir o saldo de ${funcionario} como ${fmtMinSaldo(minutos)} em ${data.split('-').reverse().join('/')}? (hoje: ${fmtMinSaldo(atual)})`, 'Aplicar', async () => {
    try {
      await db.salvarBancoHoras({
        funcionario, data, tipo: minutos >= 0 ? 'Credito' : 'Debito', origem: _ORIGEM_ACERTO_BH,
        minutos: Math.abs(minutos), status: 'Validado', validado_por: _sessao?.nome || null, validado_em: new Date().toISOString(),
        descricao: 'Saldo oficial informado: ' + fmtMinSaldo(minutos) + (obs ? ' — ' + obs : ''),
        criado_por: _sessao?.nome || null
      });
      toast('Acerto de saldo aplicado!','sucesso');
      ['bhAcSaldo','bhAcObs'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
      await renderizarBancoHoras();
      atualizarPreviaAcertoBH();
    } catch(e) { avisarErro('aplicar o acerto de saldo', e); }
  });
}

// ==========================================
// ⏳ VALIDAÇÃO DO SUPERVISOR
// ==========================================
function _renderizarPendentesBH() {
  const tb = document.getElementById('tbodyPendentesBH'); if (!tb) return;
  const pend = _todosBancoHoras.filter(r => _statusBH(r) === 'Pendente')
    .sort((a,b) => a.data.localeCompare(b.data));
  const filtro = _filtroFuncBancoHoras;
  const lista = filtro && filtro !== 'Todos' ? pend.filter(r => r.funcionario === filtro) : pend;
  if (!lista.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-msg">Nada aguardando validação. ✅</td></tr>'; return; }
  tb.innerHTML = lista.map(r => {
    const cor = r.tipo==='Credito' ? '#059669' : '#dc2626';
    return `<tr>
      <td><b>${esc(r.data.split('-').reverse().join('/'))}</b></td>
      <td>${esc(r.funcionario)}</td>
      <td style="font-size:11px;color:#64748b">${esc(r.origem)}</td>
      <td style="font-weight:700;color:${cor}">${esc(fmtMinSaldo(_sinalBH(r)))}</td>
      <td style="font-size:12px;color:#64748b">${esc(r.descricao||'—')}<div id="bhDet-${r.id}" style="margin-top:4px;color:#0f172a">${_detalheBHCache[r.id] || '<span style="color:#94a3b8">Carregando horários...</span>'}</div></td>
      <td style="white-space:nowrap">
        <button class="btn-success" style="padding:4px 8px;font-size:11px" onclick="validarLancamentoBH(${r.id},'Validado')">✅ Validar</button>
        <button class="btn-warning" style="padding:4px 8px;font-size:11px" onclick="abrirAjusteValidacaoBH(${r.id})">✏️ Ajustar</button>
        <button class="btn-danger" style="padding:4px 8px;font-size:11px" onclick="validarLancamentoBH(${r.id},'Recusado')">❌ Recusar</button>
      </td>
    </tr>`;
  }).join('');
  _carregarDetalhesPendentesBH(lista);
}

// Detalhe de HORÁRIOS de cada pendente (para o supervisor saber o motivo antes de validar).
// Calculado na hora a partir dos apontamentos (hora extra) ou do registro de atraso/saída (parcial).
const _detalheBHCache = {};
const _fmtHM = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0'); };
const _fmtDur = m => Math.floor(m/60) + 'h' + (m%60 ? String(m%60).padStart(2,'0') : '');

async function _carregarDetalhesPendentesBH(lista) {
  try {
    const faltam = lista.filter(r => !_detalheBHCache[r.id]);
    if (!faltam.length) return;
    const he = faltam.filter(r => (r.referencia_id||'').startsWith('HE-'));
    const par = faltam.filter(r => (r.referencia_id||'').startsWith('PARC-'));
    let lancs = [], turnos = [], funcs = [], parciais = [];
    if (he.length) {
      const datas = he.map(r => r.data).sort();
      [lancs, turnos, funcs] = await Promise.all([
        db._get('lancamentos', 'data=gte.'+datas[0]+'&data=lte.'+datas[datas.length-1], 'funcionario,data,hora_inicio,hora_fim,tipo,maquina,job,descricao'),
        db._get('turnos', 'ativo=eq.true', 'nome,hora_entrada,hora_saida'),
        db._get('funcionarios', 'ativo=eq.true', 'nome,turno')
      ]);
    }
    if (par.length) {
      const ids = par.map(r => r.referencia_id.slice(5)).filter(x => /^\d+$/.test(x));
      if (ids.length) parciais = await db._get('rh_parciais', 'id=in.('+ids.join(',')+')', 'id,data,funcionario,inicio,fim,motivo,obs');
    }
    faltam.forEach(r => {
      let html = '';
      if ((r.referencia_id||'').startsWith('HE-')) {
        const dia = (lancs||[]).filter(l => l.funcionario === r.funcionario && l.data === r.data && l.hora_inicio && l.hora_fim)
          .sort((a,b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
        const intervalos = dia.map(l => { const i=_paraMinutosDoDia(l.hora_inicio); let f=_paraMinutosDoDia(l.hora_fim); if (f<i) f+=1440; return [i,f]; });
        const blocos = _mesclarIntervalosArray(intervalos);
        const foraEscala = (r.descricao||'').startsWith('Trabalho em dia fora');
        const f = (funcs||[]).find(x => x.nome === r.funcionario);
        const t = (turnos||[]).find(x => x.nome === (f?.turno || '5x2'));
        const linhas = [];
        if (foraEscala) {
          linhas.push('📅 <b>Dia de folga / fim de semana / feriado</b> — tudo que foi trabalhado conta como extra.');
          linhas.push('⏱️ Trabalhou: ' + blocos.map(([i,fm]) => _fmtHM(i)+'–'+_fmtHM(fm)).join(' · '));
        } else if (t) {
          const e = _paraMinutosDoDia(t.hora_entrada); let sd = _paraMinutosDoDia(t.hora_saida); if (sd <= e) sd += 1440;
          const extras = [];
          blocos.forEach(([i,fm]) => {
            if (i < e) extras.push('antes do turno ' + _fmtHM(i) + '–' + _fmtHM(Math.min(fm,e)) + ' (' + _fmtDur(Math.min(fm,e)-i) + ')');
            if (fm > sd) extras.push('depois do turno ' + _fmtHM(Math.max(i,sd)) + '–' + _fmtHM(fm) + ' (' + _fmtDur(fm-Math.max(i,sd)) + ')');
          });
          linhas.push('🕐 Turno ' + esc(t.nome) + ': ' + _fmtHM(e) + '–' + _fmtHM(sd));
          linhas.push('⏱️ Trabalhou: ' + blocos.map(([i,fm]) => _fmtHM(i)+'–'+_fmtHM(fm)).join(' · '));
          if (extras.length) linhas.push('➕ Extra: <b>' + extras.join(' + ') + '</b>');
        }
        const oque = dia.slice(0,6).map(l => _fmtHM(_paraMinutosDoDia(l.hora_inicio))+'–'+_fmtHM(_paraMinutosDoDia(l.hora_fim))+' '+esc(l.tipo||'')+(l.maquina?' ('+esc(l.maquina)+')':'')+(l.job?' · '+esc(l.job):'')).join('<br>');
        if (oque) linhas.push('<span style="color:#64748b">Apontamentos:<br>' + oque + (dia.length>6?'<br>… +'+(dia.length-6):'') + '</span>');
        html = linhas.join('<br>') || '<span style="color:#94a3b8">Sem apontamentos com horário neste dia.</span>';
      } else if ((r.referencia_id||'').startsWith('PARC-')) {
        const p = (parciais||[]).find(x => String(x.id) === r.referencia_id.slice(5));
        if (p) {
          html = '🚪 ' + esc(p.motivo||'') + ': saiu <b>' + esc(String(p.inicio).slice(0,5)) + '</b>' +
                 (p.fim ? ', voltou <b>' + esc(String(p.fim).slice(0,5)) + '</b>' : ' e não voltou') +
                 (p.obs ? '<br><span style="color:#64748b">Obs: ' + esc(p.obs) + '</span>' : '');
        }
      }
      _detalheBHCache[r.id] = html || '<span style="color:#94a3b8">Sem detalhes de horário.</span>';
      const el = document.getElementById('bhDet-' + r.id);
      if (el) el.innerHTML = _detalheBHCache[r.id];
    });
  } catch(e) { console.error(e); }
}

async function validarLancamentoBH(id, status, minutos) {
  if (!_podeValidarBH()) return toast('Só supervisor, gestor ou administrador pode validar.','erro');
  try {
    const dados = { id, status, validado_por: _sessao?.nome || null, validado_em: new Date().toISOString() };
    if (minutos) dados.minutos = minutos;
    await db._patch('banco_horas', 'id=eq.' + id, dados);
    toast(status === 'Validado' ? 'Validado!' : 'Recusado.', 'sucesso');
    await renderizarBancoHoras();
  } catch(e) { avisarErro('validar o lançamento do banco de horas', e); }
}

function abrirAjusteValidacaoBH(id) {
  const r = _todosBancoHoras.find(x => x.id === id); if (!r) return;
  const div = document.createElement('div');
  div.id = 'modalAjusteBHWrap';
  div.innerHTML = `
  <div class="modal-overlay" onclick="fecharAjusteValidacaoBH()" style="display:block"></div>
  <div class="modal" style="display:block;max-width:380px">
    <div class="modal-header"><h3>✏️ Ajustar e validar</h3><button onclick="fecharAjusteValidacaoBH()">✕</button></div>
    <div class="modal-body">
      <div style="font-size:12px;color:#64748b;margin-bottom:10px">${esc(r.funcionario)} · ${esc(r.data.split('-').reverse().join('/'))} · ${esc(r.origem)}<br>Calculado: <b>${esc(fmtMinSaldo(_sinalBH(r)))}</b></div>
      <div class="form-group"><label>Horas corretas (sem sinal) *</label><input type="text" id="ajBHHoras" value="${esc(fmtMinSaldo(r.minutos).replace('h',''))}" placeholder="Ex: 1:30"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" onclick="confirmarAjusteValidacaoBH(${r.id})">✅ Ajustar e validar</button>
      <button class="btn-secondary" onclick="fecharAjusteValidacaoBH()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(div);
}
function fecharAjusteValidacaoBH() { document.getElementById('modalAjusteBHWrap')?.remove(); }
async function confirmarAjusteValidacaoBH(id) {
  const m = _parseHorasBH(document.getElementById('ajBHHoras')?.value);
  if (m === null || m <= 0) return toast('Informe as horas no formato 1:30.','erro');
  fecharAjusteValidacaoBH();
  await validarLancamentoBH(id, 'Validado', Math.abs(m));
}

function validarTodosPendentesBH() {
  if (!_podeValidarBH()) return toast('Só supervisor, gestor ou administrador pode validar.','erro');
  const filtro = _filtroFuncBancoHoras;
  const lista = _todosBancoHoras.filter(r => _statusBH(r) === 'Pendente' && (!filtro || filtro === 'Todos' || r.funcionario === filtro));
  if (!lista.length) return toast('Nada para validar.','erro');
  confirmarAcao(`Validar ${lista.length} lançamento(s) pendente(s)${filtro && filtro !== 'Todos' ? ' de ' + filtro : ''}?`, 'Validar', async () => {
    try {
      const quando = new Date().toISOString();
      for (const r of lista) await db._patch('banco_horas', 'id=eq.' + r.id, { status:'Validado', validado_por:_sessao?.nome||null, validado_em:quando });
      toast(lista.length + ' lançamento(s) validado(s)!', 'sucesso');
      await renderizarBancoHoras();
    } catch(e) { avisarErro('validar os lançamentos pendentes', e); }
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
    const d = calcularSaldoBH(await db.listarBancoHoras(nome) || []);
    const saldo = d.saldo;
    const cor = saldo>0?'#059669':saldo<0?'#dc2626':'#64748b';
    el.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:8px">🏦 BANCO DE HORAS</div>
    <div style="font-size:24px;font-weight:800;color:${cor};margin-bottom:4px">${esc(fmtMinSaldo(saldo))}</div>
    ${d.qtdPendente?`<div style="font-size:11px;color:#92400e;margin-bottom:6px">⏳ ${d.qtdPendente} pendente(s) de validação: ${esc(fmtMinSaldo(d.pendente))}</div>`:''}
    <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="_irParaBancoHorasFuncionario('${escJs(nome)}')">📋 Ver extrato</button>`;
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
