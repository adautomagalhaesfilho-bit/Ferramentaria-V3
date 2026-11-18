// ==========================================
// 🍽️ DOMINIO-REFEICAO.JS — refeição obrigatória, descontada por dia e por pessoa (REGRAS.md RG-08)
// Funções puras. Parâmetros da empresa (CONFIG_EMPRESA.refeicao): direito de refeição por turno e limite mínimo do dia.
// Não existe horário fixo. O que a pessoa deixou sem apontar entre um apontamento e outro já foi refeição; só se desconta
// o que faltar. Dia com tempo apontado até o limite não conta (não chegou a almoçar). Apontamentos antigos que já tiveram
// o desconto gravado (caixa marcada) entram na conta para não descontar duas vezes. Nada é gravado: é só o cálculo do dia.
// ==========================================

var REFEICAO_DESCONTO_ANTIGO_MAX = 70; // a caixa antiga de almoço descontava no máximo 70 min por apontamento (dado histórico)

function refeicaoDireitoMin(turno) {
  const R = CONFIG_EMPRESA.refeicao;
  // turno sem valor cadastrado usa o do turno padrão da empresa (como na escala); sem nenhum, o direito padrão
  const v = R.direitoMin[turno] != null ? R.direitoMin[turno] : R.direitoMin[CONFIG_EMPRESA.turnoPadrao];
  return v != null ? Number(v) : R.direitoPadraoMin;
}

// Minutos de refeição a descontar do dia da pessoa (lancs = apontamentos dela no dia)
function almocoAjusteDia(lancs, turno) {
  const iv = []; let jaDescontado = 0;
  (lancs || []).forEach(l => {
    const i = tempoIntervalo(l.horaInicio, l.horaFim);
    if (!i) return;
    iv.push(i);
    if (l.descontaAlmoco === true || l.descontaAlmoco === 'true') {
      jaDescontado += Math.min(REFEICAO_DESCONTO_ANTIGO_MAX, Math.max(0, (i[1] - i[0]) - (l.minutos || 0)));
    }
  });
  if (!iv.length) return 0;
  const uniao = tempoUnico(iv);
  if (uniao <= CONFIG_EMPRESA.refeicao.limiteDiaMin) return 0;
  const inicioDia = Math.min(...iv.map(i => i[0])), fimDia = Math.max(...iv.map(i => i[1]));
  const lacunas = (fimDia - inicioDia) - uniao;
  return Math.max(0, refeicaoDireitoMin(turno) - lacunas - jaDescontado);
}

if (typeof module !== 'undefined') module.exports = { refeicaoDireitoMin, almocoAjusteDia };
