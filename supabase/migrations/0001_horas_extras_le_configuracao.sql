-- 0001: sincronizar_horas_extras passa a ler turnos e config_sistema (RG-01, RG-04, RG-06, RG-12).
-- Substitui a versão com escala, rodízio e isentos escritos dentro da função. Resultado idêntico (conferido 46 semanas, 0 diferenças).
CREATE OR REPLACE FUNCTION public.sincronizar_horas_extras(p_ini date, p_fim date, p_gravar boolean DEFAULT true)
 RETURNS TABLE(funcionario text, data date, minutos integer, descricao text, novo boolean, minutos_existente integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  return query
  with cfg as (
    -- parâmetros da empresa (RG-01, RG-04, RG-06): tabela config_sistema e turnos; nada de valor fixo de empresa aqui
    select (select valor::date from config_sistema where chave = 'rodizio_start') as rod_ini,
           (select valor from config_sistema where chave = 'rodizio_turma_start') as rod_primeira,
           coalesce((select valor from config_sistema where chave = 'turno_padrao'), '5x2') as turno_padrao,
           coalesce((select valor::jsonb->'setores' from config_sistema where chave = 'isentos_meta'), '[]'::jsonb) as iso_setores,
           coalesce((select valor::jsonb->'cargos' from config_sistema where chave = 'isentos_meta'), '[]'::jsonb) as iso_cargos,
           (select min(t.nome) from turnos t where t.ativo and t.dias_semana = 'rodizio-2x2'
              and t.nome <> (select valor from config_sistema where chave = 'rodizio_turma_start')) as rod_segunda
  ), lanc as (
    select l.funcionario, l.data,
           (substring(l.hora_inicio::text from 1 for 2)::int*60 + substring(l.hora_inicio::text from 4 for 2)::int) as i,
           (substring(l.hora_fim::text from 1 for 2)::int*60 + substring(l.hora_fim::text from 4 for 2)::int) as f
    from lancamentos l
    where l.data between p_ini and p_fim and l.hora_inicio is not null and l.hora_fim is not null
  ), lanc2 as (
    select funcionario, data, i, case when f < i then f+1440 else f end as f from lanc
  ), marc as (
    select *, max(f) over (partition by funcionario, data order by i, f rows between unbounded preceding and 1 preceding) as maxprev from lanc2
  ), ilhas as (
    select *, sum(case when maxprev is null or i > maxprev then 1 else 0 end) over (partition by funcionario, data order by i, f) as grp from marc
  ), blocos as (
    select funcionario, data, grp, min(i) as bi, max(f) as bf from ilhas group by funcionario, data, grp
  ), dias as (
    select distinct l.funcionario, l.data from lancamentos l where l.data between p_ini and p_fim
  ), info as (
    select d.funcionario, d.data, coalesce(fu.turno, c.turno_padrao) as turno, fu.id as fid,
      case tt.dias_semana
        when 'rodizio-2x2' then
          case when c.rod_ini is null then null
               else (((d.data - c.rod_ini) % 4)+4)%4 < 2 and coalesce(fu.turno, c.turno_padrao) = coalesce(c.rod_primeira, c.rod_segunda)
                 or (((d.data - c.rod_ini) % 4)+4)%4 >= 2 and coalesce(fu.turno, c.turno_padrao) = coalesce(c.rod_segunda, c.rod_primeira)
          end
        when 'seg-sab' then extract(dow from d.data) <> 0 and not exists(select 1 from feriados fe where fe.data=d.data)
        else extract(dow from d.data) not in (0,6) and not exists(select 1 from feriados fe where fe.data=d.data)
      end as dia_escala
    from dias d
    join funcionarios fu on fu.nome = d.funcionario and fu.ativo
    cross join cfg c
    left join turnos tt on tt.nome = coalesce(fu.turno, c.turno_padrao) and tt.ativo
    where not (coalesce(fu.setor,'') in (select jsonb_array_elements_text(c.iso_setores))
            or coalesce(fu.cargo,'') in (select jsonb_array_elements_text(c.iso_cargos)))
  ), calc as (
    select i.funcionario, i.data, i.fid, i.dia_escala,
      case when not i.dia_escala then coalesce(sum(b.bf-b.bi),0)
           else case when t.id is null then null else
             coalesce(sum((b.bf-b.bi) - greatest(0, least(b.bf, te.sd) - greatest(b.bi, te.e))),0) end end as extra
    from info i
    left join blocos b on b.funcionario=i.funcionario and b.data=i.data
    left join turnos t on t.nome=i.turno and t.ativo
    left join lateral (select (extract(hour from t.hora_entrada)*60+extract(minute from t.hora_entrada))::int as e,
        ((extract(hour from t.hora_saida)*60+extract(minute from t.hora_saida))::int + case when t.hora_saida <= t.hora_entrada then 1440 else 0 end) as sd) te on true
    where i.dia_escala is not null
    group by i.funcionario, i.data, i.fid, i.dia_escala, t.id, te.e, te.sd
  ), res as (
    select c.funcionario, c.data, c.fid, c.extra::int as minutos,
      case when c.dia_escala then 'Hora extra por lançamento fora do horário do turno (entrada antecipada e/ou saída após o expediente)'
           else 'Trabalho em dia fora da escala normal (horários sobrepostos mesclados)' end as descricao,
      'HE-'||c.funcionario||'-'||c.data::text as ref
    from calc c where c.extra is not null and c.extra > 0
  ), ins as (
    insert into banco_horas (funcionario, funcionario_id, data, tipo, origem, minutos, descricao, referencia_id, criado_por, status)
    select r.funcionario, r.fid, r.data, 'Credito', 'Hora Extra Automática', r.minutos, r.descricao, r.ref, 'Automático (07:00)', 'Pendente'
    from res r
    where p_gravar and not exists (select 1 from banco_horas bh where bh.referencia_id = r.ref or (bh.origem = 'Hora Extra Automática' and bh.data = r.data and (bh.funcionario = r.funcionario or (bh.funcionario_id is not null and bh.funcionario_id = r.fid))))
    returning 1
  )
  select r.funcionario, r.data, r.minutos, r.descricao,
         not exists (select 1 from banco_horas bh where bh.referencia_id = r.ref or (bh.origem = 'Hora Extra Automática' and bh.data = r.data and (bh.funcionario = r.funcionario or (bh.funcionario_id is not null and bh.funcionario_id = r.fid)))) as novo,
         (select bh.minutos from banco_horas bh where bh.referencia_id = r.ref or (bh.origem = 'Hora Extra Automática' and bh.data = r.data and (bh.funcionario = r.funcionario or (bh.funcionario_id is not null and bh.funcionario_id = r.fid))) limit 1) as minutos_existente
  from res r order by r.data, r.funcionario;
end $function$;
