// ==========================================
// 📅 DOMINIO-ESCALA.JS — escala, capacidade e turno na data (REGRAS.md RG-01 a RG-04)
// Funções puras: não acessam tela nem banco. Os VALORES (capacidade de cada turno, quais dias cada turno trabalha,
// início do rodízio, ajustes por setor) vêm da configuração da empresa: tabelas `turnos` e `config_sistema`,
// entregues por escalaConfigurar(). Enquanto a configuração não chega, valem os valores de fábrica abaixo.
// ==========================================

// Valores de fábrica (equivalem ao cadastro atual; a tela de configuração da empresa vai substituí-los)
var ESCALA_CFG = {
  turnoPadrao: '5x2',
  turnos: {
    '5x2':     { dias: 'seg-sex',     capacidade: 528 },
    '6x1':     { dias: 'seg-sab',     capacidade: 440 },
    'Estágio': { dias: 'seg-sex',     capacidade: 440 },
    'Turma A': { dias: 'rodizio-2x2', capacidade: 660 },
    'Turma B': { dias: 'rodizio-2x2', capacidade: 660 }
  },
  rodizio: { inicio: '2026-02-17', turmaInicial: 'Turma A' },
  // RG-03: ajustes de capacidade por setor e turno, com data de início (minutos somados à capacidade do dia)
  ajustes: [
    { setor: 'Usinagem', turnos: ['5x2', 'Turma A', 'Turma B'], desde: '2026-09-01', minutos: -30 }
  ]
};
var _ESCALA_PADRAO_CAP = 528; // turno desconhecido: tratado como semana (seg-sex) com a capacidade do turno padrão

// Recebe as linhas das tabelas `turnos` e `config_sistema` e atualiza a configuração em uso.
// Dado ausente ou inválido não apaga o valor de fábrica.
function escalaConfigurar(fonte) {
  const f = fonte || {};
  (f.turnos || []).forEach(t => {
    if (!t || !t.nome || t.ativo === false) return;
    const cap = Number(t.capacidade_min);
    ESCALA_CFG.turnos[t.nome] = {
      dias: t.dias_semana || (ESCALA_CFG.turnos[t.nome] || {}).dias || 'seg-sex',
      capacidade: cap > 0 ? cap : ((ESCALA_CFG.turnos[t.nome] || {}).capacidade || _ESCALA_PADRAO_CAP)
    };
  });
  const cfg = {};
  (f.config || []).forEach(r => { if (r && r.chave) cfg[r.chave] = r.valor; });
  if (/^\d{4}-\d{2}-\d{2}$/.test(cfg.rodizio_start || '')) ESCALA_CFG.rodizio.inicio = cfg.rodizio_start;
  if (cfg.rodizio_turma_start && ESCALA_CFG.turnos[cfg.rodizio_turma_start]) ESCALA_CFG.rodizio.turmaInicial = cfg.rodizio_turma_start;
}

// RG-01 — turma do rodízio 2x2 em serviço no dia (ciclo de 4 dias: 2 trabalha, 2 folga)
function turmaEmDia(data) {
  const inicio = new Date(ESCALA_CFG.rodizio.inicio + 'T12:00:00');
  const dia = Math.floor((new Date(data + 'T12:00:00') - inicio) / 86400000);
  const ciclo = ((dia % 4) + 4) % 4;
  const turmas = Object.keys(ESCALA_CFG.turnos).filter(n => ESCALA_CFG.turnos[n].dias === 'rodizio-2x2').sort();
  const primeira = ESCALA_CFG.rodizio.turmaInicial;
  const segunda = turmas.find(n => n !== primeira) || primeira;
  return ciclo < 2 ? primeira : segunda;
}

// RG-01 — o turno trabalha neste dia? (feriado da empresa é folga)
function funcTrabalhaEmDia(turno, dataStr, feriados) {
  const diaSem = new Date(dataStr + 'T12:00:00').getDay();
  const feriado = (feriados || []).includes(dataStr);
  const t = ESCALA_CFG.turnos[turno];
  const dias = t ? t.dias : 'seg-sex';
  if (dias === 'rodizio-2x2') return turmaEmDia(dataStr) === turno;
  if (dias === 'seg-sab') return diaSem !== 0 && !feriado;
  return diaSem !== 0 && diaSem !== 6 && !feriado;
}

// RG-02 — capacidade diária do turno, em minutos
function capMinutosPorTurno(turno) {
  const t = ESCALA_CFG.turnos[turno];
  return t ? t.capacidade : _ESCALA_PADRAO_CAP;
}

// RG-04 — turno da pessoa numa data. Sem histórico: o turno atual. Com histórico: o turno da mudança que cobre o dia;
// antes da primeira mudança registrada vale o turno padrão da empresa.
function turnoNaData(nome, ds, dados) {
  const f = (dados.funcionarios || []).find(x => x.nome === nome);
  const atual = (f && f.turno) || ESCALA_CFG.turnoPadrao;
  const hist = (dados.turnoHistorico || []).filter(h => f && h.funcionario_id === f.id).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  if (!hist.length) return atual;
  if (ds < hist[0].data_inicio) return ESCALA_CFG.turnoPadrao;
  const cobre = hist.filter(h => ds >= h.data_inicio && (!h.data_fim || ds <= h.data_fim));
  return cobre.length ? cobre[cobre.length - 1].turno : atual;
}

// RG-03 — capacidade do dia já com os ajustes por setor (ex.: início às 08:00 na Usinagem, −30 min desde 01/09/2026)
function capMinutosNaData(turno, setor, ds) {
  let cap = capMinutosPorTurno(turno);
  ESCALA_CFG.ajustes.forEach(a => {
    if (a.setor === setor && a.turnos.includes(turno) && ds >= a.desde) cap += a.minutos;
  });
  return cap;
}

if (typeof module !== 'undefined') module.exports = { ESCALA_CFG, escalaConfigurar, turmaEmDia, funcTrabalhaEmDia, capMinutosPorTurno, turnoNaData, capMinutosNaData };
