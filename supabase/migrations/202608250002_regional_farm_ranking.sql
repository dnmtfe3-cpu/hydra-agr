-- Ranking regional do Hydra Agro.
-- Calcula XP a partir de uso real da propriedade e expõe apenas dados públicos necessários ao ranking.

create or replace function public.regional_farm_ranking(p_municipality text default null)
returns table (
  owner_user_id uuid,
  property_name text,
  municipality text,
  owner_name text,
  avatar_path text,
  xp bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with farm_scores as (
    select
      p.owner_user_id,
      p.name as property_name,
      p.municipality,
      coalesce(pr.full_name, 'Produtor') as owner_name,
      pr.avatar_path,
      (
        case when nullif(trim(p.name), '') is not null and nullif(trim(p.municipality), '') is not null then 120 else 0 end
        + coalesce((select count(*) * 45 from public.animals a where a.owner_user_id = p.owner_user_id), 0)
        + coalesce((select count(*) * 35 from public.animals a where a.owner_user_id = p.owner_user_id and nullif(trim(a.electronic_id), '') is not null), 0)
        + coalesce((select count(*) * 22 from public.property_sectors s where s.owner_user_id = p.owner_user_id), 0)
        + coalesce((select count(*) * 18 from public.activities ac where ac.owner_user_id = p.owner_user_id and ac.done = true), 0)
        + coalesce((select count(*) * 16 from public.monitoring_records mr where mr.owner_user_id = p.owner_user_id), 0)
        + coalesce((select count(*) * 12 from public.water_records wr where wr.owner_user_id = p.owner_user_id), 0)
        + least(coalesce((select sum(nt.read_count) from public.nfc_tags nt where nt.owner_user_id = p.owner_user_id), 0), 500)
      )::bigint as xp
    from public.properties p
    left join public.profiles pr on pr.id = p.owner_user_id
    where nullif(trim(p.name), '') is not null
      and nullif(trim(p.municipality), '') is not null
      and (p_municipality is null or trim(p_municipality) = '' or p.municipality = p_municipality)
  )
  select owner_user_id, property_name, municipality, owner_name, avatar_path, xp
  from farm_scores
  order by xp desc, property_name asc
  limit 3;
$$;

grant execute on function public.regional_farm_ranking(text) to authenticated;
