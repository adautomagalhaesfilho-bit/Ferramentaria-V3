// ==========================================
// 🧮 DOMINIO-CONFIG-FORM.JS — regras da tela de Configurações (puras, sem tela e sem banco)
// Converte a configuração em formulário, valida e devolve as linhas de config_sistema a gravar.
// ==========================================

var CONFIG_ESCALAS = { 'seg-sex': 'Segunda a sexta', 'seg-sab': 'Segunda a sábado', 'rodizio-2x2': 'Rodízio 2x2' };

function _cfLista(txt) {
  return String(txt || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
function _cfInt(v) {
  const n = Number(v);
  return v !== '' && v != null && Number.isInteger(n) ? n : null;
}

// Formulário inicial a partir da configuração em uso
function configFormDe(C) {
  return {
    turnoPadrao: C.turnoPadrao,
    rodizioInicio: C.rodizio.inicio || '',
    rodizioTurma: C.rodizio.turmaInicial || '',
    refeicaoLimite: C.refeicao.limiteDiaMin,
    refeicaoDireito: Object.assign({}, C.refeicao.direitoMin),
    ajustes: C.ajustes.map((a) => ({ setor: a.setor, turnos: a.turnos.slice(), desde: a.desde, minutos: a.minutos })),
    isentoSetores: C.isentos.setores.join(', '),
    isentoCargos: C.isentos.cargos.join(', '),
    bhDia: C.bhCicloDiaInicio,
    ocProducao: C.ocorrencia.producaoDias,
    ocBancada: C.ocorrencia.bancadaDias,
    ocSemHist: C.ocorrencia.bancadaSemHistDias,
  };
}

// Devolve a lista de erros em português (vazia = pode gravar)
function configValidar(f, nomesTurnos) {
  const erros = [];
  const nomes = nomesTurnos || [];
  if (nomes.length && !nomes.includes(f.turnoPadrao))
    erros.push('O turno padrão precisa ser um turno cadastrado e ativo.');
  if (f.rodizioInicio && !/^\d{4}-\d{2}-\d{2}$/.test(f.rodizioInicio))
    erros.push('Data de início do rodízio inválida.');
  const lim = _cfInt(f.refeicaoLimite);
  if (lim === null || lim < 0 || lim > 1440)
    erros.push('Limite mínimo do dia (refeição): informe minutos de 0 a 1440.');
  Object.keys(f.refeicaoDireito).forEach((t) => {
    const n = _cfInt(f.refeicaoDireito[t]);
    if (n === null || n < 0 || n > 240)
      erros.push('Direito de refeição do turno ' + t + ': informe minutos de 0 a 240.');
  });
  f.ajustes.forEach((a, i) => {
    const n = i + 1;
    if (!String(a.setor || '').trim()) erros.push('Ajuste ' + n + ': informe o setor.');
    if (!a.turnos || !a.turnos.length) erros.push('Ajuste ' + n + ': escolha ao menos um turno.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.desde || ''))
      erros.push('Ajuste ' + n + ': informe a data "vale a partir de".');
    const m = _cfInt(a.minutos);
    if (m === null || Math.abs(m) > 480) erros.push('Ajuste ' + n + ': minutos entre -480 e 480.');
  });
  const dia = _cfInt(f.bhDia);
  if (dia === null || dia < 1 || dia > 28) erros.push('Dia de início do ciclo do banco de horas: de 1 a 28.');
  [
    ['ocProducao', 'Produção'],
    ['ocBancada', 'Bancada (com histórico)'],
    ['ocSemHist', 'Bancada (sem histórico)'],
  ].forEach(([k, nome]) => {
    const n = _cfInt(f[k]);
    if (n === null || n < 0 || n > 365) erros.push('Limite de ocorrência ' + nome + ': de 0 a 365 dias.');
  });
  return erros;
}

// Linhas de config_sistema (chave -> valor em texto) que o formulário representa
function configLinhas(f) {
  const ajustes = f.ajustes.map((a) => ({
    setor: String(a.setor).trim(),
    turnos: a.turnos,
    desde: a.desde,
    minutos: Number(a.minutos),
  }));
  const direito = {};
  Object.keys(f.refeicaoDireito).forEach((t) => {
    direito[t] = Number(f.refeicaoDireito[t]);
  });
  const linhas = {
    turno_padrao: f.turnoPadrao,
    refeicao_limite_dia_min: String(Number(f.refeicaoLimite)),
    refeicao_direito_min: JSON.stringify(direito),
    ajustes_capacidade: JSON.stringify(ajustes),
    isentos_meta: JSON.stringify({ setores: _cfLista(f.isentoSetores), cargos: _cfLista(f.isentoCargos) }),
    bh_ciclo_dia_inicio: String(Number(f.bhDia)),
    ocorrencia_gap_producao_dias: String(Number(f.ocProducao)),
    ocorrencia_gap_bancada_dias: String(Number(f.ocBancada)),
    ocorrencia_gap_bancada_sem_hist_dias: String(Number(f.ocSemHist)),
  };
  if (f.rodizioInicio) linhas.rodizio_start = f.rodizioInicio;
  if (f.rodizioTurma) linhas.rodizio_turma_start = f.rodizioTurma;
  return linhas;
}

// Só o que mudou: [{ chave, antigo, novo }] comparando com as linhas atuais do banco (chave -> valor)
function configMudancas(novas, atuais) {
  return Object.keys(novas)
    .filter((k) => String(atuais[k] ?? '') !== String(novas[k]))
    .map((k) => ({ chave: k, antigo: atuais[k] ?? null, novo: novas[k] }));
}

function configTurnoValidar(t, outrosNomes) {
  const erros = [];
  if (!String(t.nome || '').trim()) erros.push('Informe o nome do turno.');
  if ((outrosNomes || []).includes(String(t.nome || '').trim())) erros.push('Já existe um turno com esse nome.');
  if (!CONFIG_ESCALAS[t.dias_semana]) erros.push('Escolha o tipo de escala.');
  const cap = _cfInt(t.capacidade_min);
  if (cap === null || cap < 1 || cap > 1440) erros.push('Capacidade diária: de 1 a 1440 minutos.');
  const ok = (h) => /^\d{2}:\d{2}/.test(h || '');
  if (!ok(t.hora_entrada) || !ok(t.hora_saida)) erros.push('Informe horário de entrada e de saída.');
  const iv = _cfInt(t.intervalo_min === '' ? 0 : t.intervalo_min);
  if (iv === null || iv < 0 || iv > 480) erros.push('Intervalo: de 0 a 480 minutos.');
  return erros;
}

if (typeof module !== 'undefined')
  module.exports = { CONFIG_ESCALAS, configFormDe, configValidar, configLinhas, configMudancas, configTurnoValidar };
