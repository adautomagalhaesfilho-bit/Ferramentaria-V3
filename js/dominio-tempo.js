// ==========================================
// ⏱️ DOMINIO-TEMPO.JS — regras de tempo (REGRAS.md RG-07)
// Funções puras: não acessam tela nem banco. É o ÚNICO lugar que converte hora em minutos,
// trata a virada do dia e junta intervalos que se sobrepõem. Quem precisar dessas contas usa daqui.
// ==========================================

// "HH:MM" ou "HH:MM:SS" -> minutos desde 00:00 (ou null se vazio/inválido)
function tempoHM(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || '');
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

// Intervalo [início, fim] em minutos. Fim menor que o início = passou da meia-noite (soma 24 h).
// Retorna null se faltar hora ou se a duração for zero (nada a contar).
function tempoIntervalo(horaInicio, horaFim) {
  const a = tempoHM(horaInicio), b = tempoHM(horaFim);
  if (a === null || b === null || a === b) return null;
  return [a, b > a ? b : b + 1440];
}

// Junta intervalos que se sobrepõem ou se encostam e devolve os blocos ordenados
function tempoMesclar(intervalos) {
  const ord = (intervalos || []).slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const blocos = [];
  ord.forEach(([a, b]) => {
    const ult = blocos[blocos.length - 1];
    if (ult && a <= ult[1]) ult[1] = Math.max(ult[1], b);
    else blocos.push([a, b]);
  });
  return blocos;
}

// Total de minutos únicos (sem contar duas vezes o mesmo horário)
function tempoUnico(intervalos) {
  return tempoMesclar(intervalos).reduce((s, [a, b]) => s + (b - a), 0);
}

// Blocos mesclados de uma lista de lançamentos ({horaInicio, horaFim})
function tempoBlocosDeLancamentos(lancs) {
  const iv = [];
  (lancs || []).forEach(l => { const i = tempoIntervalo(l.horaInicio, l.horaFim); if (i) iv.push(i); });
  return tempoMesclar(iv);
}

if (typeof module !== 'undefined') module.exports = { tempoHM, tempoIntervalo, tempoMesclar, tempoUnico, tempoBlocosDeLancamentos };
