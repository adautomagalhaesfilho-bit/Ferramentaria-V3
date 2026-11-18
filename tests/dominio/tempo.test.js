// RG-07 — js/dominio-tempo.js (conversão de hora, virada do dia, junção de intervalos)
const test = require('node:test'), assert = require('node:assert/strict');
const t = require('../../js/dominio-tempo.js');

test('RG-07 tempoHM converte hora em minutos e rejeita inválidos', () => {
  assert.equal(t.tempoHM('08:30'), 510);
  assert.equal(t.tempoHM('08:30:00'), 510);
  assert.equal(t.tempoHM('0:05'), 5);
  assert.equal(t.tempoHM(''), null);
  assert.equal(t.tempoHM(null), null);
  assert.equal(t.tempoHM('abc'), null);
});

test('RG-07 tempoIntervalo: virada de dia soma 24 h; duração zero ou hora faltando não conta', () => {
  assert.deepEqual(t.tempoIntervalo('22:00', '02:00'), [1320, 1560]);
  assert.deepEqual(t.tempoIntervalo('08:00:00', '10:00:00'), [480, 600]);
  assert.equal(t.tempoIntervalo('19:15', '19:15'), null);
  assert.equal(t.tempoIntervalo(null, '10:00'), null);
});

test('RG-07 tempoMesclar junta sobrepostos e encostados, ignora ordem de entrada', () => {
  assert.deepEqual(t.tempoMesclar([[540, 660], [480, 600]]), [[480, 660]]);
  assert.deepEqual(t.tempoMesclar([[480, 600], [600, 720]]), [[480, 720]]);
  assert.deepEqual(t.tempoMesclar([[480, 540], [600, 660]]), [[480, 540], [600, 660]]);
  assert.deepEqual(t.tempoMesclar([]), []);
});

test('RG-07 tempoUnico não conta duas vezes o mesmo horário', () => {
  assert.equal(t.tempoUnico([[480, 600], [540, 660]]), 180);
  assert.equal(t.tempoUnico([[480, 600], [480, 600]]), 120);
  assert.equal(t.tempoUnico([[480, 540], [600, 660]]), 120);
});

test('RG-07 tempoBlocosDeLancamentos', () => {
  const l = [{ horaInicio: '08:00', horaFim: '10:00' }, { horaInicio: '09:00', horaFim: '11:00' }, { horaInicio: null, horaFim: '12:00' }];
  assert.deepEqual(t.tempoBlocosDeLancamentos(l), [[480, 660]]);
});
