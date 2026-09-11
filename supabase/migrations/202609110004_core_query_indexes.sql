-- Índices de suporte para as rotas mais usadas do Hydra Agro.
-- Não alteram dados nem regras de acesso; reduzem scans em relações frequentes.

create index if not exists animals_property_id_idx
  on public.animals(property_id);
create index if not exists animals_sector_id_idx
  on public.animals(sector_id) where sector_id is not null;

create index if not exists activities_property_id_idx
  on public.activities(property_id);
create index if not exists activities_sector_id_idx
  on public.activities(sector_id) where sector_id is not null;
create index if not exists activities_animal_id_idx
  on public.activities(animal_id) where animal_id is not null;

create index if not exists monitoring_records_property_id_idx
  on public.monitoring_records(property_id);
create index if not exists monitoring_records_sector_id_idx
  on public.monitoring_records(sector_id) where sector_id is not null;
create index if not exists monitoring_records_animal_id_idx
  on public.monitoring_records(animal_id) where animal_id is not null;

create index if not exists water_records_property_id_idx
  on public.water_records(property_id);
create index if not exists water_records_source_id_idx
  on public.water_records(source_id) where source_id is not null;
create index if not exists water_sources_property_id_idx
  on public.water_sources(property_id);

create index if not exists nfc_tags_animal_id_idx
  on public.nfc_tags(animal_id);
create index if not exists property_sectors_property_id_idx
  on public.property_sectors(property_id);
create index if not exists property_map_features_sector_id_idx
  on public.property_map_features(sector_id) where sector_id is not null;
