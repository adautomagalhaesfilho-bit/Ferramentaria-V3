const test = require('node:test');
const assert = require('node:assert');
const { carregar } = require('./carregar');
const { bancoHorasCiclo } = carregar(['dominio-banco-horas.js']);

// RG-13 — ciclo do relatório mensal
test('RG-13 início dia 16: ciclo vai do 16 ao 15 do mês seguinte', () => {
  assert.deepStrictEqual({ ...bancoHorasCiclo('2026-11-18', 16) }, { ini: '2026-10-16', fim: '2026-11-15' });
  assert.deepStrictEqual({ ...bancoHorasCiclo('2026-11-15', 16) }, { ini: '2026-10-16', fim: '2026-11-15' });
  assert.deepStrictEqual({ ...bancoHorasCiclo('2026-11-14', 16) }, { ini: '2026-09-16', fim: '2026-10-15' });
});
test('RG-13 vira o ano', () => {
  assert.deepStrictEqual({ ...bancoHorasCiclo('2027-01-10', 16) }, { ini: '2026-11-16', fim: '2026-12-15' });
});
test('RG-13 início dia 1: mês cheio anterior', () => {
  assert.deepStrictEqual({ ...bancoHorasCiclo('2026-03-10', 1) }, { ini: '2026-02-01', fim: '2026-02-28' });
});
