// ==========================================
// 📅 DOMINIO-ESCALA.JS — escala, capacidade e turno na data (REGRAS.md RG-01 a RG-04)
// Funções puras: não acessam tela nem banco. Os VALORES (capacidade de cada turno, quais dias cada turno trabalha,
// início do rodízio, ajustes por setor, isentos) vêm da configuração da empresa (CONFIG_EMPRESA, js/dominio-config.js).
// ==========================================

// (parâmetros em CONFIG_EMPRESA, js/dominio-config.js)

// Turno cadastrado; turno desconhecido é tratado como o turno padrão da empresa
function _escalaTurno(turno) { return CONFIG_EMPRESA.turnos[turno] || CONFIG_EMPRESA.turnos[CONFIG_EMPRESA.turnoPadrao] || null; }

// RG-01 — turma do rodízio 2x2 em serviço no dia (ciclo de 4 dias: 2 trabalha, 2 folga)
function turmaEmDia(data) {
  if (!CONFIG_EMPRESA.rodizio.inicio) return null;
  const inicio = new Date(CONFIG_EMPRESA.rodizio.inicio + 'T12:00:00');
  const dia = Math.floor((new Date(data + 'T12:00:00') - inicio) / 86400000);
  const ciclo = ((dia % 4) + 4) % 4;
  const turmas = Object.keys(CONFIG_EMPRESA.turnos).filter(n => CONFIG_EMPRESA.turnos[n].dias === 'rodizio-2x2').sort();
  const primeira = CONFIG_EMPRESA.rodizio.turmaInicial || turmas[0];
  const segunda = turmas.find(n => n !== primeira) || primeira;
  return ciclo < 2 ? primeira : segunda;
}

// RG-01 — o turno trabalha neste dia? (feriado da empresa é folga)
function funcTrabalhaEmDia(turno, dataStr, feriados) {
  const diaSem = new Date(dataStr + 'T12:00:00').getDay();
  const feriado = (feriados || []).includes(dataStr);
  const t = _escalaTurno(turno);
  const dias = t ? t.dias : 'seg-sex';
  if (dias === 'rodizio-2x2') return turmaEmDia(dataStr) === turno;
  if (dias === 'seg-sab') return diaSem !== 0 && !feriado;
  return diaSem !== 0 && diaSem !== 6 && !feriado;
}

// RG-02 — capacidade diária do turno, em minutos
function capMinutosPorTurno(turno) {
  const t = _escalaTurno(turno);
  return t ? t.capacidade : CONFIG_EMPRESA.capacidadePadrao;
}

// RG-04 — turno da pessoa numa data. Sem histórico: o turno atual. Com histórico: o turno da mudança que cobre o dia;
// antes da primeira mudança registrada vale o turno padrão da empresa.
function turnoNaData(nome, ds, dados) {
  const f = (dados.funcionarios || []).find(x => x.nome === nome);
  const atual = (f && f.turno) || CONFIG_EMPRESA.turnoPadrao;
  const hist = (dados.turnoHistorico || []).filter(h => f && h.funcionario_id === f.id).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  if (!hist.length) return atual;
  if (ds < hist[0].data_inicio) return CONFIG_EMPRESA.turnoPadrao;
  const cobre = hist.filter(h => ds >= h.data_inicio && (!h.data_fim || ds <= h.data_fim));
  return cobre.length ? cobre[cobre.length - 1].turno : atual;
}

// RG-03 — capacidade do dia já com os ajustes por setor (ex.: setor cujo dia produtivo começa mais tarde)
function capMinutosNaData(turno, setor, ds) {
  let cap = capMinutosPorTurno(turno);
  CONFIG_EMPRESA.ajustes.forEach(a => {
    if (a.setor === setor && a.turnos.includes(turno) && ds >= a.desde) cap += a.minutos;
  });
  return cap;
}

// RG-06 — quem fica fora de meta, ocupação e hora extra (setores e cargos isentos, definidos pela empresa)
function isSupervisor(nome, dados) {
  const f = (dados.funcionarios || []).find(x => x.nome === nome);
  if (!f) return false;
  const iso = CONFIG_EMPRESA.isentos;
  return iso.setores.includes(f.setor) || iso.cargos.includes(f.cargo);
}

if (typeof module !== 'undefined') module.exports = { isSupervisor, turmaEmDia, funcTrabalhaEmDia, capMinutosPorTurno, turnoNaData, capMinutosNaData };
