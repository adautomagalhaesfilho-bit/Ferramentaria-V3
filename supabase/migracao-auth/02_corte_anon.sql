-- =====================================================================
-- 02_corte_anon.sql — Migração do login para o Supabase Auth (ETAPA 2 de 3)
-- =====================================================================
-- O QUE FAZ: REMOVE todo acesso do papel "anon" (quem não fez login).
-- A partir daqui, só quem entrou pelo Supabase Auth acessa os dados.
--
-- SÓ RODE DEPOIS QUE:
--   [x] 01_preparacao.sql foi rodado
--   [x] as 9 contas foram criadas no Auth e aparecem vinculadas
--   [x] o app novo (este pull request) está publicado
--   [x] cada usuário conseguiu entrar no app novo pelo menos uma vez
--
-- TRAVA DE SEGURANÇA: se algum usuário ATIVO estiver sem conta vinculada,
-- o script para com erro e NÃO muda nada.
-- Para desfazer: 02_rollback_volta_anon.sql
-- =====================================================================

begin;

do $$
declare faltando text;
begin
  select string_agg(nome, ', ') into faltando
    from public.usuarios where ativo is true and auth_user_id is null;
  if faltando is not null then
    raise exception 'Usuários ativos sem conta no Auth: %. Nada foi alterado.', faltando;
  end if;
end $$;

drop policy if exists anon_full_access on public.avaliacoes_competencia;
drop policy if exists anon_full_access on public.banco_horas;
drop policy if exists anon_full_access on public.cargos;
drop policy if exists anon_full_access on public.competencias;
drop policy if exists anon_full_access on public.config_sistema;
drop policy if exists anon_insert on public.copos;
drop policy if exists anon_select on public.copos;
drop policy if exists anon_update on public.copos;
drop policy if exists anon_delete on public.copos_compatibilidade;
drop policy if exists anon_insert on public.copos_compatibilidade;
drop policy if exists anon_select on public.copos_compatibilidade;
drop policy if exists anon_full_access on public.feriados;
drop policy if exists anon_full_access on public.ferias;
drop policy if exists anon_full_access on public.funcionario_turno_historico;
drop policy if exists anon_full_access on public.funcionarios;
drop policy if exists anon_full_access on public.jobs;
drop policy if exists anon_full_access on public.lancamentos;
drop policy if exists anon_full_access on public.log_alteracoes;
drop policy if exists anon_insert on public.maquina_capacidade_historico;
drop policy if exists anon_select on public.maquina_capacidade_historico;
drop policy if exists anon_full_access on public.maquinas;
drop policy if exists anon_delete on public.molde_anexos;
drop policy if exists anon_insert on public.molde_anexos;
drop policy if exists anon_select on public.molde_anexos;
drop policy if exists anon_full_access on public.molde_intervencoes;
drop policy if exists anon_full_access on public.molde_localizacao;
drop policy if exists anon_full_access on public.molde_localizacao_historico;
drop policy if exists anon_delete on public.molde_mapeamento_calcos;
drop policy if exists anon_insert on public.molde_mapeamento_calcos;
drop policy if exists anon_select on public.molde_mapeamento_calcos;
drop policy if exists anon_update on public.molde_mapeamento_calcos;
drop policy if exists anon_full_access on public.molde_pendencias;
drop policy if exists anon_insert on public.molde_peso_verificacoes;
drop policy if exists anon_select on public.molde_peso_verificacoes;
drop policy if exists anon_full_access on public.motivos_parada;
drop policy if exists anon_full_access on public.prod_categorias;
drop policy if exists anon_full_access on public.prod_injetoras;
drop policy if exists anon_full_access on public.prod_lancamentos;
drop policy if exists anon_full_access on public.prod_tecnicos;
drop policy if exists anon_delete on public.ram;
drop policy if exists anon_insert on public.ram;
drop policy if exists anon_select on public.ram;
drop policy if exists anon_update on public.ram;
drop policy if exists anon_delete on public.ram_setores;
drop policy if exists anon_insert on public.ram_setores;
drop policy if exists anon_select on public.ram_setores;
drop policy if exists anon_update on public.ram_setores;
drop policy if exists anon_full_access on public.rh_parciais;
drop policy if exists anon_full_access on public.status_jobs;
drop policy if exists anon_full_access on public.tipos_servico;
drop policy if exists anon_full_access on public.turnos;
drop policy if exists anon_full_access on public.usuarios;

-- Storage: upload só para quem fez login (leitura das fotos via link público continua)
drop policy if exists molde_anexos_insert_anon  on storage.objects;
drop policy if exists molde_anexos_select_public on storage.objects;
drop policy if exists rh_anexos_insert_anon     on storage.objects;

commit;

-- Conferência: não deve sobrar nenhuma linha com {anon}
-- select schemaname, tablename, policyname from pg_policies
--  where 'anon' = any(roles) and schemaname in ('public','storage');
