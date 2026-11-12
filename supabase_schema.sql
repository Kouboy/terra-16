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

-- 5b. SALUTATIONS DE CAIRNS (Traçabilité & unicité d'un vote par explorateur)
create table if not exists public.cairn_upvotes (
  cairn_id text not null references public.cairns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cairn_id, user_id)
);
create index if not exists idx_cairn_upvotes_user on public.cairn_upvotes(user_id);

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

-- Cairn Upvotes policies
alter table public.cairn_upvotes enable row level security;
drop policy if exists "cairn_upvotes_select_all" on public.cairn_upvotes;
create policy "cairn_upvotes_select_all" on public.cairn_upvotes for select using (true);

drop policy if exists "cairn_upvotes_insert_own" on public.cairn_upvotes;
create policy "cairn_upvotes_insert_own" on public.cairn_upvotes for insert with check (auth.uid() = user_id);

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

-- Permet aux explorateurs authentifiés de saluer un cairn une seule fois sans pouvoir modifier son contenu ni voter pour leur propre cairn
create or replace function public.increment_cairn_upvote(target_cairn_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cairn_owner uuid;
begin
  -- 1. Contrôle strict de l'authentification
  if v_user_id is null then
    raise exception 'Authentification requise pour saluer un cairn' using errcode = '42501';
  end if;

  -- 2. Vérification de l'existence et du propriétaire
  select owner_id into v_cairn_owner
  from public.cairns
  where id = target_cairn_id;

  if not found then
    raise exception 'Cairn introuvable' using errcode = 'P0002';
  end if;

  if v_cairn_owner = v_user_id then
    raise exception 'Impossible de saluer son propre cairn' using errcode = '23514';
  end if;

  -- 3. Inscription idempotente du vote (unicité par explorateur et cairn)
  insert into public.cairn_upvotes (cairn_id, user_id, created_at)
  values (target_cairn_id, v_user_id, now())
  on conflict (cairn_id, user_id) do nothing;

  -- 4. Si premier vote effectif, incrémentation du compteur
  if found then
    update public.cairns
    set upvotes = upvotes + 1
    where id = target_cairn_id;
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.increment_cairn_upvote(text) from public, anon;
grant execute on function public.increment_cairn_upvote(text) to authenticated;

-- Permet d'inscrire une signature authentifiée sur le registre d'une géocache avec intégrité de l'identité
create or replace function public.record_geocache_log(
  target_cache_id text,
  p_finder_id uuid,
  p_finder_name text,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cache_owner uuid;
  v_already_found boolean;
  v_sanitized_name text;
  v_sanitized_msg text;
  v_log_id text;
begin
  -- 1. Contrôle strict de l'authentification
  if v_user_id is null then
    raise exception 'Authentification requise pour signer une géocache' using errcode = '42501';
  end if;

  -- 2. Vérification de conformité de l'identité client (anti-spoofing)
  if p_finder_id is not null and p_finder_id <> v_user_id then
    raise exception 'Identité non conforme : l''identifiant ne correspond pas au compte connecté' using errcode = '42501';
  end if;

  -- 3. Vérification de l'existence de la géocache
  select owner_id into v_cache_owner
  from public.geocaches
  where id = target_cache_id;

  if not found then
    raise exception 'Géocache introuvable' using errcode = 'P0002';
  end if;

  -- 4. Limitation anti-spam : refuser les soumissions répétées à moins de 15 secondes
  if exists (
    select 1 from public.geocache_logs
    where geocache_id = target_cache_id
      and owner_id = v_user_id
      and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'Signature récente déjà enregistrée, veuillez patienter un instant' using errcode = '23505';
  end if;

  v_sanitized_name := coalesce(nullif(trim(p_finder_name), ''), 'Explorateur');
  v_sanitized_msg := coalesce(nullif(trim(p_message), ''), 'Visite inscrite sur le carnet.');
  v_log_id := target_cache_id || '_' || v_user_id::text || '_' || extract(epoch from now())::bigint::text;

  -- 5. Insertion du log avec l'identité réelle v_user_id
  insert into public.geocache_logs (
    id,
    geocache_id,
    owner_id,
    finder_name,
    log_message,
    created_at
  )
  values (
    v_log_id,
    target_cache_id,
    v_user_id,
    substr(v_sanitized_name, 1, 60),
    substr(v_sanitized_msg, 1, 280),
    now()
  );

  -- 6. Incrémentation de finder_count uniquement si première découverte et non propriétaire
  if v_cache_owner <> v_user_id then
    select exists (
      select 1 from public.geocache_logs
      where geocache_id = target_cache_id
        and owner_id = v_user_id
        and id <> v_log_id
    ) into v_already_found;

    if not v_already_found then
      update public.geocaches
      set finder_count = finder_count + 1
      where id = target_cache_id;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.record_geocache_log(text, uuid, text, text) from public, anon;
grant execute on function public.record_geocache_log(text, uuid, text, text) to authenticated;
