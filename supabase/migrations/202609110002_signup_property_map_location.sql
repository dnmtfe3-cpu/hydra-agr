-- Salva o ponto escolhido no cadastro como um ponto inicial do mapa da propriedade.
-- O frontend envia temporariamente esse ponto em property.locationDetails no formato geo:lat,lng.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  property_data jsonb := coalesce(new.raw_user_meta_data -> 'property', '{}'::jsonb);
  is_staff boolean := lower(coalesce(new.raw_user_meta_data ->> 'account_type', '')) = 'staff';
  assigned_role public.app_role := case
    when lower(coalesce(new.email, '')) = 'danqxy7@gmail.com' then 'owner'::public.app_role
    else 'user'::public.app_role
  end;
  location_token text := coalesce(property_data ->> 'locationDetails', '');
  map_lat double precision;
  map_lng double precision;
  property_key text := 'property-' || new.id::text;
begin
  if location_token ~ '^geo:-?[0-9]+([.][0-9]+)?,-?[0-9]+([.][0-9]+)?$' then
    map_lat := split_part(substring(location_token from 5), ',', 1)::double precision;
    map_lng := split_part(substring(location_token from 5), ',', 2)::double precision;
    if map_lat < -90 or map_lat > 90 or map_lng < -180 or map_lng > 180 then
      map_lat := null;
      map_lng := null;
    end if;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  ) on conflict (id) do nothing;

  insert into public.roles (user_id, role)
  values (new.id, assigned_role)
  on conflict (user_id) do update set role = case
    when excluded.role = 'owner' then 'owner'::public.app_role
    else public.roles.role
  end;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  if not is_staff then
    insert into public.properties (
      id, owner_user_id, name, municipality, state, postal_code,
      municipality_ibge_code, state_name, region, street, district,
      address_complement, ddd, location_details, area, area_unit,
      property_type, main_activity, other_activities, approximate_animals, water_kinds
    ) values (
      property_key,
      new.id,
      coalesce(property_data ->> 'name', ''),
      coalesce(property_data ->> 'municipality', ''),
      upper(coalesce(property_data ->> 'state', '')),
      nullif(property_data ->> 'postalCode', ''),
      nullif(property_data ->> 'municipalityIbgeCode', ''),
      nullif(property_data ->> 'stateName', ''),
      nullif(property_data ->> 'region', ''),
      nullif(property_data ->> 'street', ''),
      nullif(property_data ->> 'district', ''),
      nullif(property_data ->> 'addressComplement', ''),
      nullif(property_data ->> 'ddd', ''),
      case when map_lat is not null and map_lng is not null then null else nullif(location_token, '') end,
      nullif(property_data ->> 'area', '')::numeric,
      coalesce(property_data ->> 'areaUnit', 'hectares'),
      coalesce(property_data ->> 'type', ''),
      coalesce(property_data ->> 'mainActivity', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(property_data -> 'otherActivities', '[]'::jsonb))), '{}'),
      nullif(property_data ->> 'approximateAnimals', '')::integer,
      coalesce(array(select jsonb_array_elements_text(coalesce(property_data -> 'waterKinds', '[]'::jsonb))), '{}')
    ) on conflict (owner_user_id) do nothing;

    if map_lat is not null
      and map_lng is not null
      and to_regclass('public.property_map_features') is not null then
      execute $insert_map$
        insert into public.property_map_features (
          id, owner_user_id, property_id, feature_type, name, sector_id, geometry
        ) values (
          $1, $2, $3, 'other', 'Localização da propriedade', null,
          jsonb_build_object('type', 'Point', 'coordinates', jsonb_build_array($4, $5))
        )
        on conflict (id) do update
          set geometry = excluded.geometry,
              name = excluded.name,
              updated_at = now()
      $insert_map$
      using 'map-origin-' || new.id::text, new.id, property_key, map_lng, map_lat;
    end if;
  end if;

  return new;
end;
$$;
