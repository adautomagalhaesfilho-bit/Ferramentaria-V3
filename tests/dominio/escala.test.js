// RG-01 a RG-04, RG-06 — os valores vêm da configuração da empresa (CONFIG_EMPRESA), não do código
const test = require('node:test'), assert = require('node:assert/strict');
const { carregar, carregarComPerfil, ARQUIVOS_REGRAS } = require('./carregar');
const { PERFIL_BOMIX } = require('./perfil-bomix');
const vazio = () => carregar(ARQUIVOS_REGRAS);

test('sem configuração, o código não traz valor de nenhuma empresa', () => {
  const c = vazio();
  assert.equal(c.capMinutosPorTurno('5x2'), 480);
  assert.equal(c.capMinutosNaData('5x2', 'Usinagem', '2026-10-01'), 480);
  assert.equal(c.turmaEmDia('2026-02-17'), null);
  assert.equal(c.isSupervisor('A', { funcionarios: [{ nome: 'A', setor: 'Supervisão', cargo: 'Supervisor' }] }), false);
  assert.equal(c.refeicaoDireitoMin('5x2'), 60);
  assert.equal(c.funcTrabalhaEmDia('5x2', '2026-11-14', []), false); // padrão segunda a sexta
});

test('RG-02 a capacidade do turno vem da configuração da empresa', () => {
  const c = carregarComPerfil({ turnos: [{ nome: '5x2', dias_semana: 'seg-sex', capacidade_min: 500, ativo: true }] });
  assert.equal(c.capMinutosPorTurno('5x2'), 500);
  assert.equal(c.capMinutosPorTurno('Desconhecido'), 500); // turno desconhecido = turno padrão da empresa
});

test('RG-01 dias da semana do turno vêm da configuração (seg-sab trabalha sábado)', () => {
  const c = carregarComPerfil({ turnos: [{ nome: '5x2', dias_semana: 'seg-sab', capacidade_min: 528, ativo: true }] });
  assert.equal(c.funcTrabalhaEmDia('5x2', '2026-11-14', []), true);
  assert.equal(c.funcTrabalhaEmDia('5x2', '2026-11-15', []), false);
});

test('RG-01 início do rodízio e turma inicial vêm da configuração', () => {
  const c = carregarComPerfil(PERFIL_BOMIX);
  assert.equal(c.turmaEmDia('2026-02-17'), 'Turma A');
  c.configurarEmpresa({ config: [{ chave: 'rodizio_start', valor: '2026-02-19' }] });
  assert.equal(c.turmaEmDia('2026-02-19'), 'Turma A');
  assert.equal(c.turmaEmDia('2026-02-21'), 'Turma B');
  c.configurarEmpresa({ config: [{ chave: 'rodizio_turma_start', valor: 'Turma B' }] });
  assert.equal(c.turmaEmDia('2026-02-19'), 'Turma B');
});

test('RG-03 ajustes de capacidade por setor vêm da configuração, com data de início', () => {
  const c = carregarComPerfil({ turnos: PERFIL_BOMIX.turnos, config: [{ chave: 'ajustes_capacidade', valor: '[{"setor":"Corte","turnos":["6x1"],"desde":"2027-01-01","minutos":20}]' }] });
  assert.equal(c.capMinutosNaData('6x1', 'Corte', '2027-01-01'), 460);
  assert.equal(c.capMinutosNaData('6x1', 'Corte', '2026-12-31'), 440);
  assert.equal(c.capMinutosNaData('5x2', 'Corte', '2027-02-01'), 528);
  assert.equal(c.capMinutosNaData('6x1', 'Usinagem', '2027-02-01'), 440); // o ajuste da Bomix não existe nesta empresa
});

test('RG-06 isentos de meta vêm da configuração da empresa', () => {
  const c = carregarComPerfil({ config: [{ chave: 'isentos_meta', valor: '{"setores":["Gerência"],"cargos":["Diretor"]}' }] });
  const dados = { funcionarios: [{ nome: 'A', setor: 'Gerência' }, { nome: 'B', cargo: 'Diretor' }, { nome: 'C', setor: 'Supervisão', cargo: 'Supervisor' }] };
  assert.equal(c.isSupervisor('A', dados), true);
  assert.equal(c.isSupervisor('B', dados), true);
  assert.equal(c.isSupervisor('C', dados), false); // regra da Bomix não vale aqui
});

test('RG-08 refeição: direito por turno e limite do dia vêm da configuração', () => {
  const c = carregarComPerfil({ config: [{ chave: 'refeicao_limite_dia_min', valor: '240' }, { chave: 'refeicao_direito_min', valor: '{"5x2":45}' }] });
  const l = (a, b) => ({ data: '2026-11-10', horaInicio: a, horaFim: b, minutos: 0 });
  assert.equal(c.almocoAjusteDia([l('08:00', '17:00')], '5x2'), 45);
  assert.equal(c.almocoAjusteDia([l('08:00', '12:00')], '5x2'), 0); // 240 min: não passa do limite
  assert.equal(c.almocoAjusteDia([l('08:00', '17:00')], '6x1'), 45); // sem valor para o turno: usa o do turno padrão
  c.configurarEmpresa({ config: [{ chave: 'refeicao_direito_min', valor: '{"Noturno":30}' }] });
  assert.equal(c.almocoAjusteDia([l('08:00', '17:00')], '5x2'), 60); // nem o turno padrão tem valor: direito padrão de fábrica
});

test('configuração inválida ou ausente não apaga o que já estava configurado', () => {
  const c = carregarComPerfil(PERFIL_BOMIX);
  c.configurarEmpresa(null);
  c.configurarEmpresa({ turnos: [{ nome: '6x1', capacidade_min: 'abc', dias_semana: null, ativo: true }, { nome: 'Inativo', capacidade_min: 1, ativo: false }],
    config: [{ chave: 'rodizio_start', valor: 'lixo' }, { chave: 'ajustes_capacidade', valor: 'não é json' }, { chave: 'isentos_meta', valor: '{' }, { chave: 'refeicao_limite_dia_min', valor: 'x' }] });
  assert.equal(c.capMinutosPorTurno('6x1'), 440);
  assert.equal(c.funcTrabalhaEmDia('6x1', '2026-11-14', []), true);
  assert.equal(c.turmaEmDia('2026-02-17'), 'Turma A');
  assert.equal(c.capMinutosNaData('5x2', 'Usinagem', '2026-10-01'), 498);
  assert.equal(c.isSupervisor('A', { funcionarios: [{ nome: 'A', setor: 'Supervisão' }] }), true);
  assert.equal(c.almocoAjusteDia([{ data: 'd', horaInicio: '08:00', horaFim: '17:30', minutos: 0 }], '5x2'), 70);
  assert.equal(c.capMinutosPorTurno('Inativo'), 528);
});

test('RG-04 turno padrão da empresa vale antes do primeiro registro do histórico', () => {
  const c = carregarComPerfil(PERFIL_BOMIX);
  const dados = { funcionarios: [{ id: 1, nome: 'Ana', turno: 'Turma A' }], turnoHistorico: [{ funcionario_id: 1, turno: 'Turma A', data_inicio: '2026-03-01', data_fim: null }] };
  assert.equal(c.turnoNaData('Ana', '2026-02-10', dados), '5x2');
  c.configurarEmpresa({ config: [{ chave: 'turno_padrao', valor: '6x1' }] });
  assert.equal(c.turnoNaData('Ana', '2026-02-10', dados), '6x1');
});
