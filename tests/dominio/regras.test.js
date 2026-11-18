// Casos de ouro de docs/REGRAS.md. Cada teste cita o ID da regra.
const test = require('node:test'), assert = require('node:assert/strict');
const { carregar } = require('./carregar');
const c = carregar(['util.js', 'dashboard.js']);

const L = (a, b, extra) => Object.assign({ data: '2026-11-10', horaInicio: a, horaFim: b, minutos: 0 }, extra || {});

test('RG-01 rodízio 2x2: ciclo de 4 dias começando na Turma A em 17/02/2026', () => {
  assert.equal(c.turmaEmDia('2026-02-17'), 'Turma A');
  assert.equal(c.turmaEmDia('2026-02-18'), 'Turma A');
  assert.equal(c.turmaEmDia('2026-02-19'), 'Turma B');
  assert.equal(c.turmaEmDia('2026-02-20'), 'Turma B');
  assert.equal(c.turmaEmDia('2026-02-21'), 'Turma A');
});

test('RG-01 escala semanal: 5x2, 6x1 e Estágio; feriado é folga', () => {
  const seg = '2026-11-09', sab = '2026-11-14', dom = '2026-11-15';
  assert.equal(c.funcTrabalhaEmDia('5x2', seg, []), true);
  assert.equal(c.funcTrabalhaEmDia('5x2', sab, []), false);
  assert.equal(c.funcTrabalhaEmDia('6x1', sab, []), true);
  assert.equal(c.funcTrabalhaEmDia('6x1', dom, []), false);
  assert.equal(c.funcTrabalhaEmDia('Estágio', sab, []), false);
  assert.equal(c.funcTrabalhaEmDia('5x2', seg, [seg]), false);
  assert.equal(c.funcTrabalhaEmDia('Turma A', '2026-02-17', []), true);
  assert.equal(c.funcTrabalhaEmDia('Turma B', '2026-02-17', []), false);
});

test('RG-02 capacidade diária por turno (valores iniciais da Bomix)', () => {
  assert.equal(c.capMinutosPorTurno('5x2'), 528);
  assert.equal(c.capMinutosPorTurno('6x1'), 440);
  assert.equal(c.capMinutosPorTurno('Estágio'), 440);
  assert.equal(c.capMinutosPorTurno('Turma A'), 660);
  assert.equal(c.capMinutosPorTurno('Turma B'), 660);
});

test('RG-03 ajuste de −30 min na Usinagem a partir de 01/09/2026', () => {
  assert.equal(c.capMinutosNaData('5x2', 'Usinagem', '2026-09-02'), 498);
  assert.equal(c.capMinutosNaData('5x2', 'Usinagem', '2026-08-31'), 528);
  assert.equal(c.capMinutosNaData('Turma A', 'Usinagem', '2026-09-02'), 630);
  assert.equal(c.capMinutosNaData('5x2', 'Bancada', '2026-09-02'), 528);
  assert.equal(c.capMinutosNaData('6x1', 'Usinagem', '2026-09-02'), 440);
});

test('RG-04 turno da pessoa na data: histórico; antes do primeiro registro vale 5x2', () => {
  const dados = {
    funcionarios: [{ id: 1, nome: 'Ana', turno: 'Turma A' }],
    turnoHistorico: [{ funcionario_id: 1, turno: 'Turma A', data_inicio: '2026-03-01', data_fim: null }],
  };
  assert.equal(c.turnoNaData('Ana', '2026-02-10', dados), '5x2');
  assert.equal(c.turnoNaData('Ana', '2026-03-05', dados), 'Turma A');
  assert.equal(c.turnoNaData('Sem Cadastro', '2026-03-05', dados), '5x2');
});

test('RG-05 meta: só dias de escala, entre admissão e demissão, sem férias e sem ausência parcial', () => {
  const dados = { funcionarios: [{ nome: 'Ana', turno: '5x2', setor: 'Bancada', admissao: '2026-10-01' }], feriados: [], ferias: [], parciais: [] };
  // 05/10/2026 é segunda; 5 dias úteis × 528
  assert.equal(c.calcularMeta('2026-10-05', '2026-10-11', 'Ana', dados), 5 * 528);
  dados.feriados = ['2026-10-07'];
  assert.equal(c.calcularMeta('2026-10-05', '2026-10-11', 'Ana', dados), 4 * 528);
  dados.ferias = [{ funcionario: 'Ana', inicio: '2026-10-08', fim: '2026-10-09', motivo: 'Férias' }];
  assert.equal(c.calcularMeta('2026-10-05', '2026-10-11', 'Ana', dados), 2 * 528);
  dados.parciais = [{ funcionario: 'Ana', data: '2026-10-05', inicio: '14:00', fim: '16:00' }];
  assert.equal(c.calcularMeta('2026-10-05', '2026-10-11', 'Ana', dados), 2 * 528 - 120);
  // antes da admissão não conta
  assert.equal(c.calcularMeta('2026-09-28', '2026-09-30', 'Ana', dados), 0);
});

test('RG-06 isentos de meta: Supervisão, Supervisor, Encarregado, Líder de Ferramentaria', () => {
  const dados = { funcionarios: [
    { nome: 'A', setor: 'Supervisão' }, { nome: 'B', cargo: 'Encarregado' },
    { nome: 'C', cargo: 'Líder de Ferramentaria' }, { nome: 'D', setor: 'Usinagem', cargo: 'Operador' } ] };
  assert.equal(c.isSupervisor('A', dados), true);
  assert.equal(c.isSupervisor('B', dados), true);
  assert.equal(c.isSupervisor('C', dados), true);
  assert.equal(c.isSupervisor('D', dados), false);
});

test('RG-07 tempo sem contar duas vezes', () => {
  assert.equal(c._minutosSemSobreposicao([L('08:00', '10:00', { minutos: 120 }), L('09:00', '11:00', { minutos: 120 })]), 180);
  assert.equal(c._minutosSemSobreposicao([L('08:00', '10:00', { minutos: 120 }), L('10:00', '12:00', { minutos: 120 })]), 240);
  assert.equal(c._minutosSemSobreposicao([L('08:00', '10:00', { minutos: 120 }), L('08:00', '10:00', { minutos: 120, data: '2026-11-11' })]), 240);
});

test('RG-08 refeição obrigatória descontada por dia', () => {
  // 1) lacuna de 70 min já é a refeição → nada a descontar
  assert.equal(c.almocoAjusteDia([L('08:00', '12:00'), L('13:10', '17:30')], '5x2'), 0);
  // 2) dia contínuo → desconta 70
  assert.equal(c.almocoAjusteDia([L('08:00', '17:30')], '5x2'), 70);
  // 3) até 300 min lançados não desconta
  assert.equal(c.almocoAjusteDia([L('08:00', '12:30')], '5x2'), 0);
  // 4) turma 2x2: direito de 60
  assert.equal(c.almocoAjusteDia([L('08:00', '19:30')], 'Turma A'), 60);
  // 5) lacuna de 30 min: falta 40
  assert.equal(c.almocoAjusteDia([L('08:00', '12:00'), L('12:30', '17:30')], '5x2'), 40);
  // 6) desconto já gravado (70) não é repetido
  assert.equal(c.almocoAjusteDia([L('08:00', '17:30', { minutos: 500, descontaAlmoco: true })], '5x2'), 0);
});

test('RG-09 uso da máquina = tempo único + tempo em automático', () => {
  assert.equal(c._minutosMaquina([L('08:00', '10:00', { minutos: 120, tempoAuto: '01:30' })]), 210);
  assert.equal(c._minutosMaquina([L('08:00', '10:00', { minutos: 120 }), L('09:00', '11:00', { minutos: 120 })]), 180);
});
