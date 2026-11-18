-- 0002: config_sistema e turnos — todo usuário ativo lê; só administrador grava (tela de Configurações).
-- Antes: política "auth_full_access" deixava qualquer usuário ativo alterar as regras pela API.
begin;
drop policy if exists auth_full_access on public.config_sistema;
drop policy if exists auth_full_access on public.turnos;

create policy leitura_ativos on public.config_sistema for select to authenticated
  using ((select public.usuario_ativo()));
create policy admin_grava on public.config_sistema for all to authenticated
  using ((select public.usuario_admin())) with check ((select public.usuario_admin()));

create policy leitura_ativos on public.turnos for select to authenticated
  using ((select public.usuario_ativo()));
create policy admin_grava on public.turnos for all to authenticated
  using ((select public.usuario_admin())) with check ((select public.usuario_admin()));
commit;
