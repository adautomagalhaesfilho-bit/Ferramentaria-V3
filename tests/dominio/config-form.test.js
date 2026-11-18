const test = require('node:test');
const assert = require('node:assert');
const { carregarComPerfil } = require('./carregar');
const ARQ = ['util.js', 'dominio-tempo.js', 'dominio-config.js', 'dominio-config-form.js'];
const J = x => JSON.parse(JSON.stringify(x));
const nomes = ['5x2', '6x1', 'Estágio', 'Turma A', 'Turma B'];

test('formulário nasce da configuração e volta igual para o banco (nada muda sem edição)', () => {
  const c = carregarComPerfil(null, ARQ);
  const f = c.configFormDe(c.CONFIG_EMPRESA);
  assert.deepStrictEqual(J(c.configValidar(f, nomes)), []);
  const { PERFIL_BOMIX } = require('./perfil-bomix');
  const atuais = {}; PERFIL_BOMIX.config.forEach(r => { atuais[r.chave] = r.valor; });
  const mud = c.configMudancas(c.configLinhas(f), atuais).map(m => m.chave);
  ['refeicao_limite_dia_min', 'refeicao_direito_min', 'ajustes_capacidade', 'isentos_meta', 'rodizio_start'].forEach(k => assert.ok(!mud.includes(k), k));
});
test('alterar um valor gera só aquela mudança', () => {
  const c = carregarComPerfil(null, ARQ);
  const f = c.configFormDe(c.CONFIG_EMPRESA); f.refeicaoLimite = 240;
  const mud = c.configMudancas(c.configLinhas(f), { refeicao_limite_dia_min: '300' });
  assert.deepStrictEqual(J(mud.find(m => m.chave === 'refeicao_limite_dia_min')), { chave: 'refeicao_limite_dia_min', antigo: '300', novo: '240' });
});
test('valores inválidos são recusados com mensagem', () => {
  const c = carregarComPerfil(null, ARQ);
  const f = c.configFormDe(c.CONFIG_EMPRESA);
  f.refeicaoLimite = -5; f.bhDia = 31; f.ocBancada = 'abc'; f.turnoPadrao = 'XYZ';
  f.ajustes.push({ setor: '', turnos: [], desde: '', minutos: 'x' });
  assert.strictEqual(c.configValidar(f, nomes).length, 8);
});
test('turno: valida nome repetido, escala e horários', () => {
  const c = carregarComPerfil(null, ARQ);
  const ok = { nome: 'Noite', dias_semana: 'seg-sex', capacidade_min: 420, hora_entrada: '22:00', hora_saida: '06:00', intervalo_min: 60 };
  assert.deepStrictEqual(J(c.configTurnoValidar(ok, ['5x2'])), []);
  assert.strictEqual(c.configTurnoValidar({ ...ok, nome: '5x2' }, ['5x2']).length, 1);
  assert.strictEqual(c.configTurnoValidar({ ...ok, dias_semana: 'x', hora_saida: '' }, []).length, 2);
});
test('restaurar padrão: fábrica é neutra e não muda quando a empresa carrega valores', () => {
  const c = carregarComPerfil(null, ARQ);
  assert.strictEqual(c.CONFIG_FABRICA.refeicao.limiteDiaMin, 300);
  assert.deepStrictEqual(J(c.CONFIG_FABRICA.ajustes), []);
  assert.ok(c.CONFIG_EMPRESA.ajustes.length > 0);
});
