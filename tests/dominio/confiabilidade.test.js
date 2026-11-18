const test = require('node:test');
const assert = require('node:assert');
const { carregarComPerfil } = require('./carregar');
const ARQ = ['util.js', 'dominio-tempo.js', 'dominio-config.js', 'confiabilidade.js'];
const banc = (id, data) => ({ id, setor: 'Bancada', tipo: 'Corretiva', data, hora_inicio: '08:00', minutos: 60, funcionario: 'F' });
const prod = (id, data) => ({ id, tipo: 'Corretiva', data, hora_inicio: '08:00', minutos: 60, injetora: 'I1', tecnicos: 'A' });
const nOc = (ctx, dados) => ctx.confCalcular({ prod: [], banc: [], hist: [], hoje: '2026-12-31', cont: [], ...dados }).ocorrencias.length;

// RG-14 — limites vêm da configuração
test('RG-14 produção: 1 dia junta, 2 dias separa (perfil Bomix)', () => {
  const c = carregarComPerfil(null, ARQ);
  assert.strictEqual(nOc(c, { prod: [prod(1, '2026-10-01'), prod(2, '2026-10-02')] }), 1);
  assert.strictEqual(nOc(c, { prod: [prod(1, '2026-10-01'), prod(2, '2026-10-03')] }), 2);
});
test('RG-14 bancada com histórico: 45 dias junta; sem histórico: 7', () => {
  const c = carregarComPerfil(null, ARQ);
  const hist = [{ id: 1, movido_em: '2026-01-01', localizacao: 'Bancada' }];
  const dois = [banc(1, '2026-10-01'), banc(2, '2026-11-14')];
  assert.strictEqual(nOc(c, { banc: dois, hist }), 1);
  assert.strictEqual(nOc(c, { banc: dois }), 2);
});
test('RG-14 muda o limite na configuração e o resultado acompanha', () => {
  const c = carregarComPerfil(null, ARQ);
  c.configurarEmpresa({ config: [{ chave: 'ocorrencia_gap_producao_dias', valor: '3' }] });
  assert.strictEqual(nOc(c, { prod: [prod(1, '2026-10-01'), prod(2, '2026-10-03')] }), 1);
});
