// RG-01 a RG-04 — js/dominio-escala.js: os valores vêm da configuração da empresa (tabelas turnos e config_sistema)
const test = require('node:test'), assert = require('node:assert/strict');
const { carregar } = require('./carregar');
const novo = () => carregar(['dominio-escala.js']);

const TURNOS_BOMIX = [
  { nome: '5x2', dias_semana: 'seg-sex', capacidade_min: 528, ativo: true },
  { nome: '6x1', dias_semana: 'seg-sab', capacidade_min: 440, ativo: true },
  { nome: 'Estágio', dias_semana: 'seg-sex', capacidade_min: 440, ativo: true },
  { nome: 'Turma A', dias_semana: 'rodizio-2x2', capacidade_min: 660, ativo: true },
  { nome: 'Turma B', dias_semana: 'rodizio-2x2', capacidade_min: 660, ativo: true },
];

test('configuração vinda do banco (cadastro atual) dá os mesmos valores de fábrica', () => {
  const a = novo(), b = novo();
  b.escalaConfigurar({ turnos: TURNOS_BOMIX, config: [{ chave: 'rodizio_start', valor: '2026-02-17' }, { chave: 'rodizio_turma_start', valor: 'Turma A' }] });
  for (const t of ['5x2', '6x1', 'Estágio', 'Turma A', 'Turma B', 'ADM']) assert.equal(b.capMinutosPorTurno(t), a.capMinutosPorTurno(t));
  for (const d of ['2026-02-17', '2026-02-19', '2026-03-01', '2026-11-10']) assert.equal(b.turmaEmDia(d), a.turmaEmDia(d));
});

test('RG-02 a capacidade do turno vem da configuração da empresa', () => {
  const c = novo();
  c.escalaConfigurar({ turnos: [{ nome: '5x2', dias_semana: 'seg-sex', capacidade_min: 500, ativo: true }] });
  assert.equal(c.capMinutosPorTurno('5x2'), 500);
  assert.equal(c.capMinutosPorTurno('6x1'), 440); // não informado: mantém o valor de fábrica
  assert.equal(c.capMinutosNaData('5x2', 'Usinagem', '2026-10-01'), 470); // ajuste da Usinagem (−30) sobre a nova capacidade
});

test('RG-01 dias da semana do turno vêm da configuração (seg-sab trabalha sábado)', () => {
  const c = novo();
  c.escalaConfigurar({ turnos: [{ nome: '5x2', dias_semana: 'seg-sab', capacidade_min: 528, ativo: true }] });
  assert.equal(c.funcTrabalhaEmDia('5x2', '2026-11-14', []), true); // sábado
  assert.equal(c.funcTrabalhaEmDia('5x2', '2026-11-15', []), false); // domingo
});

test('RG-01 início do rodízio e turma inicial vêm da configuração', () => {
  const c = novo();
  c.escalaConfigurar({ config: [{ chave: 'rodizio_start', valor: '2026-02-19' }] });
  assert.equal(c.turmaEmDia('2026-02-19'), 'Turma A');
  assert.equal(c.turmaEmDia('2026-02-21'), 'Turma B');
  c.escalaConfigurar({ config: [{ chave: 'rodizio_turma_start', valor: 'Turma B' }] });
  assert.equal(c.turmaEmDia('2026-02-19'), 'Turma B');
});

test('configuração inválida ou ausente não apaga os valores de fábrica', () => {
  const c = novo();
  c.escalaConfigurar(null);
  c.escalaConfigurar({ turnos: [{ nome: '6x1', capacidade_min: 'abc', dias_semana: null, ativo: true }, { nome: 'Inativo', capacidade_min: 1, ativo: false }], config: [{ chave: 'rodizio_start', valor: 'lixo' }] });
  assert.equal(c.capMinutosPorTurno('6x1'), 440);
  assert.equal(c.funcTrabalhaEmDia('6x1', '2026-11-14', []), true);
  assert.equal(c.turmaEmDia('2026-02-17'), 'Turma A');
  assert.equal(c.capMinutosPorTurno('Inativo'), 528); // turno inativo é ignorado
});

test('RG-04 turno padrão da empresa vale antes do primeiro registro do histórico', () => {
  const c = novo();
  const dados = { funcionarios: [{ id: 1, nome: 'Ana', turno: 'Turma A' }], turnoHistorico: [{ funcionario_id: 1, turno: 'Turma A', data_inicio: '2026-03-01', data_fim: null }] };
  assert.equal(c.turnoNaData('Ana', '2026-02-10', dados), '5x2');
});
