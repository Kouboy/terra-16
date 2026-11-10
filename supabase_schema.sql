-- ============================================================================
-- TERRA 16 - ARCHITECTURE BASE DE DONNÉES SUPABASE (PostgreSQL + RLS)
-- ============================================================================
-- Script corrigé : type 'uuid' conforme à auth.users(id) de Supabase.
-- Vous pouvez l'exécuter dans Supabase > SQL Editor > New query > Run.
-- ============================================================================

-- 1. PROFIL EXPLORATEUR (Progression, XP 5 branches, cosmétiques 16-bit)
create table if not exists public.explorers (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Explorateur',
  total_xp integer not null default 0 check (total_xp >= 0 and total_xp <= 10000000),
  xp_histoire integer not null default 0 check (xp_histoire >= 0 and xp_histoire <= 10000000),
  xp_geographie integer not null default 0 check (xp_geographie >= 0 and xp_geographie <= 10000000),
  xp_ecosysteme integer not null default 0 check (xp_ecosysteme >= 0 and xp_ecosysteme <= 10000000),
  xp_etrange integer not null default 0 check (xp_etrange >= 0 and xp_etrange <= 10000000),
  xp_legende integer not null default 0 check (xp_legende >= 0 and xp_legende <= 10000000),
  gender text not null default 'masculin',
  avatar_preset text not null default 'cartographe',
  skin_tone text not null default 'hale',
  headgear_id text not null default 'tricorne_fauve',
  outfit_id text not null default 'arpenteur',
  tool_id text not null default 'lanterne_laiton',
  pack_id text not null default 'besace_cuir',
  familiar_id text not null default 'aucun',
  pinned_trophy_id text default '',
  walked_meters integer not null default 0 check (walked_meters >= 0),
  night_feats_count integer not null default 0,
  storm_feats_count integer not null default 0,
  completed_contracts_count integer not null default 0,
  solved_riddles_count integer not null default 0,
  completed_hunts_count integer not null default 0,
  claimed_almanac_count integer not null default 0,
  completed_narratives_count integer not null default 0,
  claimed_community_challenges_count integer not null default 0,
  claimed_live_events_count integer not null default 0,
  discoveries_count integer not null default 0 check (discoveries_count >= 0),
  completed_missions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. DÉCOUVERTES (Lieux débloqués, carnets et notes)
create table if not exists public.discoveries (
  id text primary key, -- Format: owner_id + '_' + poi_id
  owner_id uuid not null references auth.users(id) on delete cascade,
  poi_id text not null,
  name text not null,
  category text not null,
  sub_type text not null default 'Point remarquable',
  era_label text default 'Strate locale',
  source text default 'OpenStreetMap',
  lat double precision not null,
  lng double precision not null,
  summary text default '',
  near_waterway boolean default false,
  waterway_name text default '',
  safety_notice text default '',
  external_url text default '',
  xp_awarded integer default 0,
  related_poi_ids text[] default '{}',
  related_poi_titles text[] default '{}',
  personal_note text default '',
  photo_count integer default 0,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_discoveries_owner on public.discoveries(owner_id);

-- 3. SPÉCIMENS NATURELS & MINÉRAUX (Herbier & Lithothèque)
create table if not exists public.specimens (
  id text primary key, -- Format: owner_id + '_' + specimen_id
  owner_id uuid not null references auth.users(id) on delete cascade,
  specimen_id text not null,
  domain text not null default 'botanique',
  affinity text not null default 'calcaire',
  name text not null,
  latin_or_mineral_name text not null,
  family_label text default '',
  lithology_label text default '',
  bedrock_period text default '',
  bedrock_age_ma text default '',
  region_label text default '',
  habitat_label text default '',
  lat double precision not null,
  lng double precision not null,
  altitude_meters integer default null,
  is_subterranean boolean default false,
  harvest_count integer not null default 1,
  description text default '',
  first_collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_specimens_owner on public.specimens(owner_id);

-- 4. COFFRES D'ARCHIVISTE (Coffres cachés & reliques anciennes)
create table if not exists public.archivist_chests (
  id text primary key, -- Format: owner_id + '_' + chest_id
  owner_id uuid not null references auth.users(id) on delete cascade,
  chest_id text not null,
  archetype text not null,
  title text not null,
  place_note text default '',
  relic_id text not null,
  relic_name text not null,
  category text not null,
  region_label text default '',
  lat double precision not null,
  lng double precision not null,
  altitude_meters integer default null,
  is_subterranean boolean default false,
  xp_awarded integer not null default 0,
  opened_at timestamptz not null default now()
);
create index if not exists idx_archivist_chests_owner on public.archivist_chests(owner_id);

-- 5. CAIRNS DE TERRAIN (Marqueurs communautaires partagés)
create table if not exists public.cairns (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null,
  poi_id text not null,
  tag text not null,
  message text not null,
  upvotes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_cairns_poi on public.cairns(poi_id);

-- 6. GÉOCACHES & CAPSULES TEMPORELLES ENFOUIES
create table if not exists public.geocaches (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  clue_hint text not null,
  sector_key text not null,
  placement_mode text not null,
  lat double precision not null,
  lng double precision not null,
  gift_kind text not null,
  gift_domain text not null,
  gift_name text not null,
  gift_tier text not null,
  finder_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_geocaches_sector on public.geocaches(sector_key);

-- 7. REGISTRES DE GÉOCACHES (Signatures des visiteurs)
create table if not exists public.geocache_logs (
  id text primary key,
  geocache_id text not null references public.geocaches(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  finder_name text not null,
  log_message text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_geocache_logs_cache on public.geocache_logs(geocache_id);

-- 8. DÉFIS COMMUNAUTAIRES TEMPORAIRES (Classements périodiques)
create table if not exists public.community_challenge_entries (
  id text primary key, -- Format: period_key + '_' + challenge_id + '_' + owner_id
  period_key text not null,
  challenge_id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_preset text not null,
  score integer not null default 0,
  tier_reached text not null default 'bronze',
  region_label text default '',
  updated_at timestamptz not null default now()
);
create index if not exists idx_challenge_period on public.community_challenge_entries(period_key, challenge_id);

-- 9. PANTHÉON MULTIJOUEUR (Classement global XP + Rareté + Diversité)
create table if not exists public.pantheon_entries (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_preset text not null,
  total_xp integer not null default 0,
  discoveries_count integer not null default 0,
  diversity_score integer not null default 0,
  rarity_score integer not null default 0,
  specimens_count integer not null default 0,
  chests_count integer not null default 0,
  live_events_count integer not null default 0,
  pinned_trophy_id text default '',
  updated_at timestamptz not null default now()
);
create index if not exists idx_pantheon_xp on public.pantheon_entries(total_xp desc);

-- ============================================================================
-- SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ============================================================================

alter table public.explorers enable row level security;
alter table public.discoveries enable row level security;
alter table public.specimens enable row level security;
alter table public.archivist_chests enable row level security;
alter table public.cairns enable row level security;
alter table public.geocaches enable row level security;
alter table public.geocache_logs enable row level security;
alter table public.community_challenge_entries enable row level security;
alter table public.pantheon_entries enable row level security;

-- Explorers policies
drop policy if exists "explorers_select_all" on public.explorers;
create policy "explorers_select_all" on public.explorers for select using (true);

drop policy if exists "explorers_insert_own" on public.explorers;
create policy "explorers_insert_own" on public.explorers for insert with check (auth.uid() = owner_id);

drop policy if exists "explorers_update_own" on public.explorers;
create policy "explorers_update_own" on public.explorers for update using (auth.uid() = owner_id);

drop policy if exists "explorers_delete_own" on public.explorers;
create policy "explorers_delete_own" on public.explorers for delete using (auth.uid() = owner_id);

-- Discoveries policies
drop policy if exists "discoveries_select_own" on public.discoveries;
create policy "discoveries_select_own" on public.discoveries for select using (auth.uid() = owner_id);

drop policy if exists "discoveries_insert_own" on public.discoveries;
create policy "discoveries_insert_own" on public.discoveries for insert with check (auth.uid() = owner_id);

drop policy if exists "discoveries_update_own" on public.discoveries;
create policy "discoveries_update_own" on public.discoveries for update using (auth.uid() = owner_id);

drop policy if exists "discoveries_delete_own" on public.discoveries;
create policy "discoveries_delete_own" on public.discoveries for delete using (auth.uid() = owner_id);

-- Specimens policies
drop policy if exists "specimens_select_own" on public.specimens;
create policy "specimens_select_own" on public.specimens for select using (auth.uid() = owner_id);

drop policy if exists "specimens_insert_own" on public.specimens;
create policy "specimens_insert_own" on public.specimens for insert with check (auth.uid() = owner_id);

drop policy if exists "specimens_update_own" on public.specimens;
create policy "specimens_update_own" on public.specimens for update using (auth.uid() = owner_id);

drop policy if exists "specimens_delete_own" on public.specimens;
create policy "specimens_delete_own" on public.specimens for delete using (auth.uid() = owner_id);

-- Archivist Chests policies
drop policy if exists "chests_select_own" on public.archivist_chests;
create policy "chests_select_own" on public.archivist_chests for select using (auth.uid() = owner_id);

drop policy if exists "chests_insert_own" on public.archivist_chests;
create policy "chests_insert_own" on public.archivist_chests for insert with check (auth.uid() = owner_id);

drop policy if exists "chests_delete_own" on public.archivist_chests;
create policy "chests_delete_own" on public.archivist_chests for delete using (auth.uid() = owner_id);

-- Cairns policies
drop policy if exists "cairns_select_all" on public.cairns;
create policy "cairns_select_all" on public.cairns for select using (true);

drop policy if exists "cairns_insert_auth" on public.cairns;
create policy "cairns_insert_auth" on public.cairns for insert with check (auth.uid() = owner_id);

drop policy if exists "cairns_update_upvote" on public.cairns;
drop policy if exists "cairns_update_own" on public.cairns;
create policy "cairns_update_own" on public.cairns for update using (auth.uid() = owner_id);

drop policy if exists "cairns_delete_own" on public.cairns;
create policy "cairns_delete_own" on public.cairns for delete using (auth.uid() = owner_id);

-- Geocaches policies
drop policy if exists "geocaches_select_all" on public.geocaches;
create policy "geocaches_select_all" on public.geocaches for select using (true);

drop policy if exists "geocaches_insert_auth" on public.geocaches;
create policy "geocaches_insert_auth" on public.geocaches for insert with check (auth.uid() = owner_id);

drop policy if exists "geocaches_update_finder" on public.geocaches;
drop policy if exists "geocaches_update_own" on public.geocaches;
create policy "geocaches_update_own" on public.geocaches for update using (auth.uid() = owner_id);

drop policy if exists "geocaches_delete_own" on public.geocaches;
create policy "geocaches_delete_own" on public.geocaches for delete using (auth.uid() = owner_id);

-- Geocache Logs policies
drop policy if exists "geocache_logs_select_all" on public.geocache_logs;
create policy "geocache_logs_select_all" on public.geocache_logs for select using (true);

drop policy if exists "geocache_logs_insert_auth" on public.geocache_logs;
create policy "geocache_logs_insert_auth" on public.geocache_logs for insert with check (auth.uid() = owner_id);

drop policy if exists "geocache_logs_delete_own" on public.geocache_logs;
create policy "geocache_logs_delete_own" on public.geocache_logs for delete using (auth.uid() = owner_id);

-- Community Challenges policies
drop policy if exists "challenges_select_all" on public.community_challenge_entries;
create policy "challenges_select_all" on public.community_challenge_entries for select using (true);

drop policy if exists "challenges_insert_own" on public.community_challenge_entries;
create policy "challenges_insert_own" on public.community_challenge_entries for insert with check (auth.uid() = owner_id);

drop policy if exists "challenges_update_own" on public.community_challenge_entries;
create policy "challenges_update_own" on public.community_challenge_entries for update using (auth.uid() = owner_id);

drop policy if exists "challenges_delete_own" on public.community_challenge_entries;
create policy "challenges_delete_own" on public.community_challenge_entries for delete using (auth.uid() = owner_id);

-- Pantheon policies
drop policy if exists "pantheon_select_all" on public.pantheon_entries;
create policy "pantheon_select_all" on public.pantheon_entries for select using (true);

drop policy if exists "pantheon_insert_own" on public.pantheon_entries;
create policy "pantheon_insert_own" on public.pantheon_entries for insert with check (auth.uid() = owner_id);

drop policy if exists "pantheon_update_own" on public.pantheon_entries;
create policy "pantheon_update_own" on public.pantheon_entries for update using (auth.uid() = owner_id);

drop policy if exists "pantheon_delete_own" on public.pantheon_entries;
create policy "pantheon_delete_own" on public.pantheon_entries for delete using (auth.uid() = owner_id);

-- ============================================================================
-- PUBLICATION REALTIME (Pour mise à jour instantanée des cairns et classements)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'cairns'
  ) then
    alter publication supabase_realtime add table public.cairns;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'geocaches'
  ) then
    alter publication supabase_realtime add table public.geocaches;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'community_challenge_entries'
  ) then
    alter publication supabase_realtime add table public.community_challenge_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'pantheon_entries'
  ) then
    alter publication supabase_realtime add table public.pantheon_entries;
  end if;
end $$;

-- ============================================================================
-- 10. FONCTIONS RPC SÉCURISÉES (Incrémentation atomique & intégrité des données)
-- ============================================================================

-- Permet aux visiteurs d'upvoter un cairn sans avoir le droit de modifier son texte ou son auteur
create or replace function public.increment_cairn_upvote(target_cairn_id text)
returns void language plpgsql security definer as $$
begin
  update public.cairns
  set upvotes = upvotes + 1
  where id = target_cairn_id;
end;
$$;

-- Permet d'inscrire une signature et d'incrémenter finder_count sans exposer l'édition directe de la géocache
create or replace function public.record_geocache_log(
  target_cache_id text,
  p_finder_id uuid,
  p_finder_name text,
  p_message text
)
returns void language plpgsql security definer as $$
begin
  insert into public.geocache_logs (id, geocache_id, owner_id, finder_name, log_message, created_at)
  values (
    target_cache_id || '_' || p_finder_id::text || '_' || extract(epoch from now())::bigint::text,
    target_cache_id,
    p_finder_id,
    p_finder_name,
    p_message,
    now()
  );
  update public.geocaches
  set finder_count = finder_count + 1
  where id = target_cache_id;
end;
$$;
