# Políticas de acesso (RLS) — 57 políticas, 38 tabelas, todas com RLS ligada

Todas para o papel `authenticated`. Condição padrão: `usuario_ativo()` (usuário vinculado ao Auth e `ativo = true`).

- **Acesso total (ALL)** com `usuario_ativo()`: avaliacoes_competencia, banco_horas, cargos, competencias, config_sistema, feriados, ferias, funcionario_turno_historico, funcionarios, jobs, lancamentos, log_alteracoes, maquinas, molde_contador_ciclos, molde_intervencoes, molde_localizacao, molde_localizacao_historico, molde_pendencias, motivos_parada, prod_categorias, prod_injetoras, prod_lancamentos, prod_tecnicos, rh_parciais, status_jobs, tipos_servico, turnos.
- **select + insert + update** (sem delete): copos.
- **select + insert + update + delete**: molde_anexos, molde_mapeamento_calcos, ram, ram_setores.
- **select + insert + delete** (sem update): copos_compatibilidade.
- **select + insert** (somente acréscimo): maquina_capacidade_historico, molde_peso_verificacoes.
- **usuarios:** select do próprio registro (`auth_user_id = auth.uid()`) ou admin; insert/update/delete somente `usuario_admin()`.
- **ia_config, ia_uso:** RLS ligada, sem política (acesso apenas por funções/serviço).

Pendência: trocar `usuario_ativo()` por filtro por empresa na Fase 3 (`docs/MULTIEMPRESA.md`).
