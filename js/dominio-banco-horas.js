// Banco de horas — regras puras (RG-13). Sem acesso a banco nem a tela.
// Ciclo do relatório mensal: começa no dia `diaInicio` e termina na véspera do mesmo dia do mês seguinte.
// Devolve o ciclo mais recente já encerrado (ou que encerra hoje).

function _bhPad(n) { return String(n).padStart(2, '0'); }
function _bhData(a, m, d) { return a + '-' + _bhPad(m) + '-' + _bhPad(d); }
function _bhMesAnterior(a, m) { return m === 1 ? [a - 1, 12] : [a, m - 1]; }
function _bhUltimoDia(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); }

function bancoHorasCiclo(hojeStr, diaInicio) {
  const d = Math.min(28, Math.max(1, parseInt(diaInicio, 10) || 1));
  const [a, m, dia] = String(hojeStr).slice(0, 10).split('-').map(Number);
  let fa, fm, fd;
  if (d === 1) {
    [fa, fm] = _bhMesAnterior(a, m);
    fd = _bhUltimoDia(fa, fm);
  } else {
    fd = d - 1;
    [fa, fm] = dia >= fd ? [a, m] : _bhMesAnterior(a, m);
  }
  const [ia, im] = d === 1 ? [fa, fm] : _bhMesAnterior(fa, fm);
  return { ini: _bhData(ia, im, d), fim: _bhData(fa, fm, fd) };
}

// Dia de início configurado (config_sistema.bh_ciclo_dia_inicio); sem configuração vale 1 (mês cheio).
function bancoHorasDiaInicio() {
  return typeof CONFIG_EMPRESA !== 'undefined' ? CONFIG_EMPRESA.bhCicloDiaInicio : 1;
}

if (typeof module !== 'undefined') module.exports = { bancoHorasCiclo, bancoHorasDiaInicio };
