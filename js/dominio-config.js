// ==========================================
// ⚙️ DOMINIO-CONFIG.JS — configuração da empresa usada pelas regras (REGRAS.md, parâmetros)
// Aqui moram os PARÂMETROS que cada empresa define. O código das regras não contém valor de nenhuma empresa:
// os valores chegam das tabelas `turnos` e `config_sistema` (hoje) e, depois, da tela de Configurações.
// Os valores de fábrica abaixo são neutros: servem de ponto de partida para uma empresa nova.
// Se a configuração não carregar, o sistema avisa (ver carregarConfigEmpresa em app.js).
// ==========================================

var CONFIG_EMPRESA = {
  turnoPadrao: '5x2',          // vale para pessoa sem turno cadastrado e antes do primeiro registro de histórico (RG-04)
  turnos: {},                  // nome -> { dias: 'seg-sex' | 'seg-sab' | 'rodizio-2x2', capacidade: minutos }
  capacidadePadrao: 480,       // usada só se nem o turno nem o turno padrão estiverem cadastrados
  rodizio: { inicio: null, turmaInicial: null },       // RG-01
  ajustes: [],                 // RG-03: { setor, turnos: [...], desde: 'AAAA-MM-DD', minutos }
  refeicao: { limiteDiaMin: 300, direitoPadraoMin: 60, direitoMin: {} },   // RG-08
  isentos: { setores: [], cargos: [] },                // RG-06
  ocorrencia: { producaoDias: 1, bancadaDias: 45, bancadaSemHistDias: 7 },   // RG-14: dias para juntar corretivas
  bhCicloDiaInicio: 1          // RG-13: dia do mês em que o ciclo do relatório começa (1 = mês cheio)
};

// Valores de fábrica (cópia intacta de antes de carregar a configuração da empresa): usados por "restaurar padrão"
var CONFIG_FABRICA = JSON.parse(JSON.stringify(CONFIG_EMPRESA));

function _cfgJson(txt, padrao) { try { const v = JSON.parse(txt); return v == null ? padrao : v; } catch (e) { return padrao; } }

// Recebe as linhas de `turnos` e `config_sistema` e atualiza a configuração em uso.
// Dado ausente ou inválido não apaga o valor anterior.
function configurarEmpresa(fonte) {
  const f = fonte || {};
  const C = CONFIG_EMPRESA;
  (f.turnos || []).forEach(t => {
    if (!t || !t.nome || t.ativo === false) return;
    const cap = Number(t.capacidade_min), ant = C.turnos[t.nome] || {};
    C.turnos[t.nome] = { dias: t.dias_semana || ant.dias || 'seg-sex', capacidade: cap > 0 ? cap : (ant.capacidade || C.capacidadePadrao) };
  });
  const cfg = {};
  (f.config || []).forEach(r => { if (r && r.chave) cfg[r.chave] = r.valor; });
  if (cfg.turno_padrao) C.turnoPadrao = cfg.turno_padrao;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cfg.rodizio_start || '')) C.rodizio.inicio = cfg.rodizio_start;
  if (cfg.rodizio_turma_start) C.rodizio.turmaInicial = cfg.rodizio_turma_start;
  const lim = Number(cfg.refeicao_limite_dia_min);
  if (cfg.refeicao_limite_dia_min != null && lim >= 0 && !isNaN(lim)) C.refeicao.limiteDiaMin = lim;
  const dir = _cfgJson(cfg.refeicao_direito_min, null);
  if (dir && typeof dir === 'object') C.refeicao.direitoMin = dir;
  const aj = _cfgJson(cfg.ajustes_capacidade, null);
  if (Array.isArray(aj)) C.ajustes = aj.filter(a => a && a.setor && Array.isArray(a.turnos) && a.desde && !isNaN(Number(a.minutos))).map(a => ({ setor: a.setor, turnos: a.turnos, desde: a.desde, minutos: Number(a.minutos) }));
  [['ocorrencia_gap_producao_dias', 'producaoDias'], ['ocorrencia_gap_bancada_dias', 'bancadaDias'],
    ['ocorrencia_gap_bancada_sem_hist_dias', 'bancadaSemHistDias']].forEach(([k, campo]) => {
    const n = parseInt(cfg[k], 10);
    if (cfg[k] != null && n >= 0 && !isNaN(n)) C.ocorrencia[campo] = n;
  });
  const dia = parseInt(cfg.bh_ciclo_dia_inicio, 10);
  if (dia >= 1 && dia <= 28) C.bhCicloDiaInicio = dia;
  const iso = _cfgJson(cfg.isentos_meta, null);
  if (iso && typeof iso === 'object') C.isentos = { setores: iso.setores || [], cargos: iso.cargos || [] };
}

if (typeof module !== 'undefined') module.exports = { CONFIG_EMPRESA, CONFIG_FABRICA, configurarEmpresa };
