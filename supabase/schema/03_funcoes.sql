-- Funções e gatilho do schema public (retrato de 18/11/2026).

CREATE OR REPLACE FUNCTION public.vincular_conta_auth() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin
  update public.usuarios u
     set auth_user_id = new.id, email_login = new.email
   where u.id = (
     select min(x.id) from public.usuarios x
      where x.auth_user_id is null
        and lower(x.nome) || '@ferramentaria.local' = lower(new.email)
   );
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.vincular_usuario_existente() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
begin
  if new.auth_user_id is null then
    select a.id, a.email into new.auth_user_id, new.email_login
      from auth.users a
     where lower(a.email) = lower(new.nome) || '@ferramentaria.local'
       and not exists (select 1 from public.usuarios u where u.auth_user_id = a.id)
     limit 1;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.usuario_ativo() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (select 1 from public.usuarios where auth_user_id = auth.uid() and ativo is true);
$function$;

CREATE OR REPLACE FUNCTION private.usuario_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  select exists (select 1 from public.usuarios where auth_user_id = auth.uid() and ativo is true and perfil = 'admin');
$function$;

-- Consulta somente-leitura usada pela função de IA (miguelito): só SELECT, 200 linhas, 8 s, papel ia_leitor.
CREATE OR REPLACE FUNCTION public.ia_consultar(q text) RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public' AS $function$
declare r jsonb; qq text := btrim(q);
begin
  qq := regexp_replace(qq, ';+\s*$', '');
  if qq !~* '^(select|with)\s' then raise exception 'Só consultas SELECT são permitidas'; end if;
  if qq ~ ';' or qq ~ '--' or qq ~ '/\*' then raise exception 'Consulta inválida'; end if;
  perform set_config('statement_timeout', '8000', true);
  perform set_config('search_path', 'ia, pg_catalog', true);
  set local role ia_leitor;
  execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (' || qq || ') q limit 200) t' into r;
  reset role;
  return r;
end $function$;

CREATE TRIGGER trg_vincular_usuario_existente BEFORE INSERT ON public.usuarios FOR EACH ROW EXECUTE FUNCTION vincular_usuario_existente();

-- sincronizar_horas_extras(p_ini date, p_fim date, p_gravar boolean default true)
-- Regra RG-11 (hora extra automática). ATENÇÃO: repete em SQL a escala do RG-01 (rodízio 17/02/2026) e a
-- exclusão de supervisão do RG-06. Definição completa: consultar no banco com
--   select pg_get_functiondef('public.sincronizar_horas_extras(date,date,boolean)'::regprocedure);
-- e copiar para supabase/migrations/ na primeira migração que a alterar (Fase 1).
