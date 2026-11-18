-- Perfil Bomix: parâmetros em config_sistema (ver docs/perfis/bomix.md). Seguro para repetir: não sobrescreve valores existentes.
insert into public.config_sistema (chave, valor) values
  ('refeicao_limite_dia_min', '300'),
  ('refeicao_direito_min', '{"5x2":70,"6x1":70,"Estágio":70,"Turma A":60,"Turma B":60}'),
  ('ajustes_capacidade', '[{"setor":"Usinagem","turnos":["5x2","Turma A","Turma B"],"desde":"2026-09-01","minutos":-30}]'),
  ('isentos_meta', '{"setores":["Supervisão"],"cargos":["Supervisor","Encarregado","Líder de Ferramentaria"]}'),
  ('bh_ciclo_dia_inicio', '16'),
  ('ocorrencia_gap_producao_dias', '1'),
  ('ocorrencia_gap_bancada_dias', '45'),
  ('ocorrencia_gap_bancada_sem_hist_dias', '7')
on conflict (chave) do nothing;
