// Linhas do perfil Bomix exatamente como estão no banco (tabelas turnos e config_sistema). Ver docs/perfis/bomix.md.
const turnos = [
  { nome: '5x2', dias_semana: 'seg-sex', capacidade_min: 528, ativo: true },
  { nome: '6x1', dias_semana: 'seg-sab', capacidade_min: 440, ativo: true },
  { nome: 'Estágio', dias_semana: 'seg-sex', capacidade_min: 440, ativo: true },
  { nome: 'Turma A', dias_semana: 'rodizio-2x2', capacidade_min: 660, ativo: true },
  { nome: 'Turma B', dias_semana: 'rodizio-2x2', capacidade_min: 660, ativo: true },
];
const config = [
  { chave: 'rodizio_start', valor: '2026-02-17' },
  { chave: 'rodizio_turma_start', valor: 'Turma A' },
  { chave: 'refeicao_limite_dia_min', valor: '300' },
  { chave: 'refeicao_direito_min', valor: '{"5x2":70,"6x1":70,"Estágio":70,"Turma A":60,"Turma B":60}' },
  { chave: 'ajustes_capacidade', valor: '[{"setor":"Usinagem","turnos":["5x2","Turma A","Turma B"],"desde":"2026-09-01","minutos":-30}]' },
  { chave: 'isentos_meta', valor: '{"setores":["Supervisão"],"cargos":["Supervisor","Encarregado","Líder de Ferramentaria"]}' },
];
module.exports = { PERFIL_BOMIX: { turnos, config } };
