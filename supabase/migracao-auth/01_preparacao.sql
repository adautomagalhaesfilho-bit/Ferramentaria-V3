-- =====================================================================
-- 01_preparacao.sql — Migração do login para o Supabase Auth (ETAPA 1 de 3)
-- =====================================================================
-- O QUE FAZ: só ACRESCENTA coisas. Não remove nada, não muda nenhum dado.
--   • usuarios.auth_user_id / usuarios.email_login (vínculo com a conta do Auth)
--   • usuarios.senha passa a aceitar NULL (usuários novos não têm mais senha aqui)
--   • funções usuario_ativo() / usuario_admin() usadas nas políticas
--   • vínculo automático usuário ⇄ conta do Auth pelo e-mail <nome>@ferramentaria.local
--   • políticas novas para "authenticated", AO LADO das de "anon" (que continuam)
-- EFEITO EM PRODUÇÃO: nenhum. O app atual continua funcionando igual.
-- PODE SER RODADO MAIS DE UMA VEZ sem problema.
-- Se mudar DOMINIO_LOGIN em js/supabase.js, troque 'ferramentaria.local' aqui também.
-- =====================================================================

begin;

-- 1) Colunas de vínculo -------------------------------------------------
alter table public.usuarios
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists email_login  text;

alter table public.usuarios alter column senha drop not null;

-- 2) Funções auxiliares das políticas ----------------------------------
-- security definer: leem a tabela usuarios sem esbarrar no próprio RLS dela
create or replace function public.usuario_ativo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios
     where auth_user_id = auth.uid() and ativo is true
  );
$$;

create or replace function public.usuario_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios
     where auth_user_id = auth.uid() and ativo is true and perfil = 'admin'
  );
$$;

revoke all on function public.usuario_ativo()  from public, anon;
revoke all on function public.usuario_admin()  from public, anon;
grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.usuario_admin() to authenticated;

-- 3) Vínculo automático pelo e-mail --------------------------------------
-- a) Ao criar a conta no Auth: liga ao usuário cujo nome bate com o e-mail
create or replace function public.vincular_conta_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.usuarios u
     set auth_user_id = new.id, email_login = new.email
   where u.id = (
     select min(x.id) from public.usuarios x
      where x.auth_user_id is null
        and lower(x.nome) || '@ferramentaria.local' = lower(new.email)
   );
  return new;
end $$;

drop trigger if exists trg_vincular_conta_auth on auth.users;
create trigger trg_vincular_conta_auth
  after insert on auth.users
  for each row execute function public.vincular_conta_auth();

-- b) Ao cadastrar o usuário no app depois que a conta do Auth já existe
create or replace function public.vincular_usuario_existente()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.auth_user_id is null then
    select a.id, a.email into new.auth_user_id, new.email_login
      from auth.users a
     where lower(a.email) = lower(new.nome) || '@ferramentaria.local'
       and not exists (select 1 from public.usuarios u where u.auth_user_id = a.id)
     limit 1;
  end if;
  return new;
end $$;

drop trigger if exists trg_vincular_usuario_existente on public.usuarios;
create trigger trg_vincular_usuario_existente
  before insert on public.usuarios
  for each row execute function public.vincular_usuario_existente();

revoke all on function public.vincular_conta_auth()        from public, anon, authenticated;
revoke all on function public.vincular_usuario_existente() from public, anon, authenticated;

-- 4) Políticas para "authenticated" (convivem com as de anon por enquanto) ---
-- Regra: qualquer conta do Auth VINCULADA a um usuário ATIVO tem o mesmo acesso
-- que o app tinha antes. As permissões finas (menus, editar etc.) continuam
-- valendo no app, pela coluna permissoes.

drop policy if exists auth_full_access on public.avaliacoes_competencia;
create policy auth_full_access on public.avaliacoes_competencia for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.banco_horas;
create policy auth_full_access on public.banco_horas for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.cargos;
create policy auth_full_access on public.cargos for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.competencias;
create policy auth_full_access on public.competencias for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.config_sistema;
create policy auth_full_access on public.config_sistema for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.copos;
create policy auth_insert on public.copos for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.copos;
create policy auth_select on public.copos for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_update on public.copos;
create policy auth_update on public.copos for update to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_delete on public.copos_compatibilidade;
create policy auth_delete on public.copos_compatibilidade for delete to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.copos_compatibilidade;
create policy auth_insert on public.copos_compatibilidade for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.copos_compatibilidade;
create policy auth_select on public.copos_compatibilidade for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.feriados;
create policy auth_full_access on public.feriados for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.ferias;
create policy auth_full_access on public.ferias for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.funcionario_turno_historico;
create policy auth_full_access on public.funcionario_turno_historico for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.funcionarios;
create policy auth_full_access on public.funcionarios for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.jobs;
create policy auth_full_access on public.jobs for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.lancamentos;
create policy auth_full_access on public.lancamentos for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.log_alteracoes;
create policy auth_full_access on public.log_alteracoes for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.maquina_capacidade_historico;
create policy auth_insert on public.maquina_capacidade_historico for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.maquina_capacidade_historico;
create policy auth_select on public.maquina_capacidade_historico for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.maquinas;
create policy auth_full_access on public.maquinas for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_delete on public.molde_anexos;
create policy auth_delete on public.molde_anexos for delete to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.molde_anexos;
create policy auth_insert on public.molde_anexos for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.molde_anexos;
create policy auth_select on public.molde_anexos for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.molde_intervencoes;
create policy auth_full_access on public.molde_intervencoes for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.molde_localizacao;
create policy auth_full_access on public.molde_localizacao for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.molde_localizacao_historico;
create policy auth_full_access on public.molde_localizacao_historico for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_delete on public.molde_mapeamento_calcos;
create policy auth_delete on public.molde_mapeamento_calcos for delete to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.molde_mapeamento_calcos;
create policy auth_insert on public.molde_mapeamento_calcos for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.molde_mapeamento_calcos;
create policy auth_select on public.molde_mapeamento_calcos for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_update on public.molde_mapeamento_calcos;
create policy auth_update on public.molde_mapeamento_calcos for update to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.molde_pendencias;
create policy auth_full_access on public.molde_pendencias for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.molde_peso_verificacoes;
create policy auth_insert on public.molde_peso_verificacoes for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.molde_peso_verificacoes;
create policy auth_select on public.molde_peso_verificacoes for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.motivos_parada;
create policy auth_full_access on public.motivos_parada for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.prod_categorias;
create policy auth_full_access on public.prod_categorias for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.prod_injetoras;
create policy auth_full_access on public.prod_injetoras for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.prod_lancamentos;
create policy auth_full_access on public.prod_lancamentos for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.prod_tecnicos;
create policy auth_full_access on public.prod_tecnicos for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_delete on public.ram;
create policy auth_delete on public.ram for delete to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.ram;
create policy auth_insert on public.ram for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.ram;
create policy auth_select on public.ram for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_update on public.ram;
create policy auth_update on public.ram for update to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_delete on public.ram_setores;
create policy auth_delete on public.ram_setores for delete to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_insert on public.ram_setores;
create policy auth_insert on public.ram_setores for insert to authenticated with check ((select public.usuario_ativo()));
drop policy if exists auth_select on public.ram_setores;
create policy auth_select on public.ram_setores for select to authenticated using ((select public.usuario_ativo()));
drop policy if exists auth_update on public.ram_setores;
create policy auth_update on public.ram_setores for update to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.rh_parciais;
create policy auth_full_access on public.rh_parciais for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.status_jobs;
create policy auth_full_access on public.status_jobs for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.tipos_servico;
create policy auth_full_access on public.tipos_servico for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));
drop policy if exists auth_full_access on public.turnos;
create policy auth_full_access on public.turnos for all to authenticated using ((select public.usuario_ativo())) with check ((select public.usuario_ativo()));

-- usuarios: cada um lê só a própria linha; o admin lê e altera todas
drop policy if exists auth_select_proprio_ou_admin on public.usuarios;
create policy auth_select_proprio_ou_admin on public.usuarios for select to authenticated
  using (auth_user_id = auth.uid() or (select public.usuario_admin()));
drop policy if exists auth_admin_insert on public.usuarios;
create policy auth_admin_insert on public.usuarios for insert to authenticated
  with check ((select public.usuario_admin()));
drop policy if exists auth_admin_update on public.usuarios;
create policy auth_admin_update on public.usuarios for update to authenticated
  using ((select public.usuario_admin())) with check ((select public.usuario_admin()));
drop policy if exists auth_admin_delete on public.usuarios;
create policy auth_admin_delete on public.usuarios for delete to authenticated
  using ((select public.usuario_admin()));

-- 5) Storage (fotos/vídeos) — os buckets continuam públicos para LEITURA via link
drop policy if exists molde_anexos_insert_auth on storage.objects;
create policy molde_anexos_insert_auth on storage.objects for insert to authenticated
  with check (bucket_id = 'molde-anexos' and (select public.usuario_ativo()));
drop policy if exists molde_anexos_select_auth on storage.objects;
create policy molde_anexos_select_auth on storage.objects for select to authenticated
  using (bucket_id = 'molde-anexos' and (select public.usuario_ativo()));
drop policy if exists rh_anexos_insert_auth on storage.objects;
create policy rh_anexos_insert_auth on storage.objects for insert to authenticated
  with check (bucket_id = 'rh-anexos' and (select public.usuario_ativo()));

commit;

-- Conferência (opcional): deve listar as políticas novas "auth_*"
-- select tablename, policyname, roles, cmd from pg_policies
--  where schemaname in ('public','storage') order by 1, 2;
