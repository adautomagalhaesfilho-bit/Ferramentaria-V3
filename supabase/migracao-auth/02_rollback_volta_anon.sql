-- =====================================================================
-- 02_rollback_volta_anon.sql — DESFAZ a etapa 2 (emergência)
-- =====================================================================
-- Recria exatamente as políticas de anon que existiam antes (lidas do banco
-- em 07/10/2026). Use só se, depois do 02, algo parar de funcionar e for
-- preciso voltar rápido. O app novo continua funcionando com isso também.
-- =====================================================================

begin;

drop policy if exists anon_full_access on public.avaliacoes_competencia;
create policy anon_full_access on public.avaliacoes_competencia for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.banco_horas;
create policy anon_full_access on public.banco_horas for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.cargos;
create policy anon_full_access on public.cargos for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.competencias;
create policy anon_full_access on public.competencias for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.config_sistema;
create policy anon_full_access on public.config_sistema for all to anon using (true) with check (true);
drop policy if exists anon_insert on public.copos;
create policy anon_insert on public.copos for insert to anon with check (true);
drop policy if exists anon_select on public.copos;
create policy anon_select on public.copos for select to anon using (true);
drop policy if exists anon_update on public.copos;
create policy anon_update on public.copos for update to anon using (true) with check (true);
drop policy if exists anon_delete on public.copos_compatibilidade;
create policy anon_delete on public.copos_compatibilidade for delete to anon using (true);
drop policy if exists anon_insert on public.copos_compatibilidade;
create policy anon_insert on public.copos_compatibilidade for insert to anon with check (true);
drop policy if exists anon_select on public.copos_compatibilidade;
create policy anon_select on public.copos_compatibilidade for select to anon using (true);
drop policy if exists anon_full_access on public.feriados;
create policy anon_full_access on public.feriados for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.ferias;
create policy anon_full_access on public.ferias for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.funcionario_turno_historico;
create policy anon_full_access on public.funcionario_turno_historico for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.funcionarios;
create policy anon_full_access on public.funcionarios for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.jobs;
create policy anon_full_access on public.jobs for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.lancamentos;
create policy anon_full_access on public.lancamentos for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.log_alteracoes;
create policy anon_full_access on public.log_alteracoes for all to anon using (true) with check (true);
drop policy if exists anon_insert on public.maquina_capacidade_historico;
create policy anon_insert on public.maquina_capacidade_historico for insert to anon with check (true);
drop policy if exists anon_select on public.maquina_capacidade_historico;
create policy anon_select on public.maquina_capacidade_historico for select to anon using (true);
drop policy if exists anon_full_access on public.maquinas;
create policy anon_full_access on public.maquinas for all to anon using (true) with check (true);
drop policy if exists anon_delete on public.molde_anexos;
create policy anon_delete on public.molde_anexos for delete to anon using (true);
drop policy if exists anon_insert on public.molde_anexos;
create policy anon_insert on public.molde_anexos for insert to anon with check (true);
drop policy if exists anon_select on public.molde_anexos;
create policy anon_select on public.molde_anexos for select to anon using (true);
drop policy if exists anon_full_access on public.molde_intervencoes;
create policy anon_full_access on public.molde_intervencoes for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.molde_localizacao;
create policy anon_full_access on public.molde_localizacao for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.molde_localizacao_historico;
create policy anon_full_access on public.molde_localizacao_historico for all to anon using (true) with check (true);
drop policy if exists anon_delete on public.molde_mapeamento_calcos;
create policy anon_delete on public.molde_mapeamento_calcos for delete to anon using (true);
drop policy if exists anon_insert on public.molde_mapeamento_calcos;
create policy anon_insert on public.molde_mapeamento_calcos for insert to anon with check (true);
drop policy if exists anon_select on public.molde_mapeamento_calcos;
create policy anon_select on public.molde_mapeamento_calcos for select to anon using (true);
drop policy if exists anon_update on public.molde_mapeamento_calcos;
create policy anon_update on public.molde_mapeamento_calcos for update to anon using (true) with check (true);
drop policy if exists anon_full_access on public.molde_pendencias;
create policy anon_full_access on public.molde_pendencias for all to anon using (true) with check (true);
drop policy if exists anon_insert on public.molde_peso_verificacoes;
create policy anon_insert on public.molde_peso_verificacoes for insert to anon with check (true);
drop policy if exists anon_select on public.molde_peso_verificacoes;
create policy anon_select on public.molde_peso_verificacoes for select to anon using (true);
drop policy if exists anon_full_access on public.motivos_parada;
create policy anon_full_access on public.motivos_parada for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.prod_categorias;
create policy anon_full_access on public.prod_categorias for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.prod_injetoras;
create policy anon_full_access on public.prod_injetoras for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.prod_lancamentos;
create policy anon_full_access on public.prod_lancamentos for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.prod_tecnicos;
create policy anon_full_access on public.prod_tecnicos for all to anon using (true) with check (true);
drop policy if exists anon_delete on public.ram;
create policy anon_delete on public.ram for delete to anon using (true);
drop policy if exists anon_insert on public.ram;
create policy anon_insert on public.ram for insert to anon with check (true);
drop policy if exists anon_select on public.ram;
create policy anon_select on public.ram for select to anon using (true);
drop policy if exists anon_update on public.ram;
create policy anon_update on public.ram for update to anon using (true) with check (true);
drop policy if exists anon_delete on public.ram_setores;
create policy anon_delete on public.ram_setores for delete to anon using (true);
drop policy if exists anon_insert on public.ram_setores;
create policy anon_insert on public.ram_setores for insert to anon with check (true);
drop policy if exists anon_select on public.ram_setores;
create policy anon_select on public.ram_setores for select to anon using (true);
drop policy if exists anon_update on public.ram_setores;
create policy anon_update on public.ram_setores for update to anon using (true) with check (true);
drop policy if exists anon_full_access on public.rh_parciais;
create policy anon_full_access on public.rh_parciais for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.status_jobs;
create policy anon_full_access on public.status_jobs for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.tipos_servico;
create policy anon_full_access on public.tipos_servico for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.turnos;
create policy anon_full_access on public.turnos for all to anon using (true) with check (true);
drop policy if exists anon_full_access on public.usuarios;
create policy anon_full_access on public.usuarios for all to anon using (true) with check (true);

drop policy if exists molde_anexos_insert_anon  on storage.objects;
create policy molde_anexos_insert_anon on storage.objects for insert to anon
  with check (bucket_id = 'molde-anexos');
drop policy if exists molde_anexos_select_public on storage.objects;
create policy molde_anexos_select_public on storage.objects for select to anon
  using (bucket_id = 'molde-anexos');
drop policy if exists rh_anexos_insert_anon on storage.objects;
create policy rh_anexos_insert_anon on storage.objects for insert to anon
  with check (bucket_id = 'rh-anexos');

commit;
