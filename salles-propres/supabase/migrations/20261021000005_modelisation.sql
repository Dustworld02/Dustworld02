-- =====================================================================
-- Phase 2 : modélisation — plan 2D, portes, traitement d'air, filtres,
-- équipements, mobilier, points de prélèvement, flux.
-- Coordonnées du plan en mètres, origine en haut à gauche.
-- =====================================================================

alter table public.salles_propres
  add column plan_largeur_m numeric not null default 30 check (plan_largeur_m > 0),
  add column plan_hauteur_m numeric not null default 20 check (plan_hauteur_m > 0),
  add column plan_fond text,
  add column plan_fond_largeur_m numeric check (plan_fond_largeur_m > 0);

-- Polygone de la zone sur le plan : [[x, y], ...] en mètres.
alter table public.zones add column geometrie jsonb;

create table public.portes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  libelle text not null default '',
  type text not null default 'porte' check (type in ('porte', 'porte_sas', 'passe_plat', 'porte_secours')),
  -- null = extérieur des locaux propres (pression de référence 0 Pa)
  zone_a uuid references public.zones (id) on delete set null,
  zone_b uuid references public.zones (id) on delete set null,
  x numeric not null default 0,
  y numeric not null default 0,
  angle numeric not null default 0,
  asservie boolean not null default false,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.ctas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  nom text not null check (length(trim(nom)) > 0),
  repere text not null default '',
  localisation text not null default '',
  debit_nominal_m3h numeric check (debit_nominal_m3h >= 0),
  debit_reduit_m3h numeric check (debit_reduit_m3h >= 0),
  air_neuf_pct numeric check (air_neuf_pct between 0 and 100),
  -- étages dans l'ordre du flux : [{type, libelle, classe}]
  etages jsonb not null default '[]'::jsonb,
  puissance_ventilateur_kw numeric check (puissance_ventilateur_kw >= 0),
  heures_nominal_jour numeric check (heures_nominal_jour between 0 and 24),
  heures_reduit_jour numeric check (heures_reduit_jour between 0 and 24),
  statut text not null default 'en_service' check (statut in ('en_service', 'maintenance', 'arret')),
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.bouches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid references public.zones (id) on delete set null,
  cta_id uuid references public.ctas (id) on delete set null,
  type text not null default 'soufflage' check (type in ('soufflage', 'reprise', 'extraction')),
  repere text not null default '',
  debit_m3h numeric check (debit_m3h >= 0),
  x numeric not null default 0,
  y numeric not null default 0,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.filtres (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid,
  cta_id uuid references public.ctas (id) on delete cascade,
  bouche_id uuid references public.bouches (id) on delete cascade,
  repere text not null default '',
  emplacement text not null default 'etage_cta' check (emplacement in ('etage_cta', 'terminal')),
  classe text not null default '',
  norme text not null default '' check (norme in ('', 'ISO 16890', 'EN 779', 'EN 1822', 'ISO 29463')),
  reference_fabricant text not null default '',
  dimensions text not null default '',
  date_pose date,
  dp_initiale_pa numeric check (dp_initiale_pa >= 0),
  dp_finale_pa numeric check (dp_finale_pa >= 0),
  periodicite_remplacement_mois integer check (periodicite_remplacement_mois > 0),
  test_integrite boolean not null default false,
  statut text not null default 'en_place' check (statut in ('en_place', 'remplace')),
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  check (cta_id is not null or bouche_id is not null)
);

create table public.releves_filtres (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid,
  filtre_id uuid not null references public.filtres (id) on delete cascade,
  date_releve timestamptz not null default now(),
  dp_pa numeric not null check (dp_pa >= 0),
  commentaire text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.equipements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid references public.zones (id) on delete set null,
  type text not null default 'autre',
  libelle text not null check (length(trim(libelle)) > 0),
  repere text not null default '',
  marque text not null default '',
  modele text not null default '',
  numero_serie text not null default '',
  date_mise_service date,
  statut text not null default 'en_service' check (statut in ('en_service', 'en_qualification', 'hors_service')),
  x numeric, y numeric,
  largeur numeric not null default 1.2 check (largeur > 0),
  profondeur numeric not null default 0.8 check (profondeur > 0),
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.mobilier (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid references public.zones (id) on delete set null,
  type text not null default 'autre',
  libelle text not null default '',
  materiau text not null default '',
  nettoyabilite text not null default 'bonne' check (nettoyabilite in ('bonne', 'moyenne', 'faible')),
  x numeric not null default 0, y numeric not null default 0,
  largeur numeric not null default 1.2 check (largeur > 0),
  profondeur numeric not null default 0.6 check (profondeur > 0),
  angle numeric not null default 0,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.points_prelevement (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid references public.zones (id) on delete cascade,
  code text not null,
  natures text[] not null default array['particulaire']::text[],
  x numeric not null default 0, y numeric not null default 0,
  hauteur_m numeric,
  description text not null default '',
  actif boolean not null default true,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (salle_id, code)
);

create table public.flux (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  type text not null default 'personnel' check (type in ('personnel', 'materiel', 'produit', 'dechets')),
  libelle text not null default '',
  points jsonb not null default '[]'::jsonb,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create index on public.portes (salle_id);
create index on public.bouches (salle_id);
create index on public.bouches (cta_id);
create index on public.ctas (site_id);
create index on public.filtres (cta_id);
create index on public.filtres (bouche_id);
create index on public.releves_filtres (filtre_id, date_releve);
create index on public.equipements (salle_id);
create index on public.mobilier (salle_id);
create index on public.points_prelevement (salle_id);
create index on public.flux (salle_id);

-- Site déduit de la salle, cohérence des références.
do $$
declare t text;
begin
  foreach t in array array['portes', 'bouches', 'equipements', 'mobilier', 'points_prelevement', 'flux'] loop
    execute format('create trigger site before insert or update on public.%I for each row execute function app.deduire_site(''salle_id'', ''salles_propres'')', t);
  end loop;
end
$$;
create trigger parent_zone_a before insert or update on public.portes for each row execute function app.verifier_parent('zone_a', 'zones');
create trigger parent_zone_b before insert or update on public.portes for each row execute function app.verifier_parent('zone_b', 'zones');
create trigger parent_zone before insert or update on public.bouches for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_cta before insert or update on public.bouches for each row execute function app.verifier_parent('cta_id', 'ctas');
create trigger parent_zone before insert or update on public.equipements for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_zone before insert or update on public.mobilier for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_zone before insert or update on public.points_prelevement for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_site before insert or update on public.ctas for each row execute function app.verifier_parent('site_id', 'sites');
create trigger site before insert or update on public.releves_filtres for each row execute function app.deduire_site('filtre_id', 'filtres');

-- Un filtre hérite du site de sa CTA ou de sa bouche.
create or replace function app.site_filtre()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_site uuid; v_org uuid;
begin
  if new.cta_id is not null then
    select site_id, org_id into v_site, v_org from public.ctas where id = new.cta_id;
  else
    select site_id, org_id into v_site, v_org from public.bouches where id = new.bouche_id;
  end if;
  if v_org is distinct from new.org_id then
    raise exception 'Rattachement invalide : la CTA ou la bouche n''appartient pas à cette organisation';
  end if;
  new.site_id := v_site;
  return new;
end
$$;
create trigger site before insert or update on public.filtres for each row execute function app.site_filtre();

do $$
declare
  t text;
begin
  foreach t in array array['portes', 'ctas', 'bouches', 'filtres', 'releves_filtres', 'equipements', 'mobilier', 'points_prelevement', 'flux'] loop
    perform app.tracer(t);
  end loop;
  foreach t in array array['portes', 'equipements', 'mobilier', 'points_prelevement', 'flux'] loop
    perform app.politiques(t, 'installations', 'site');
  end loop;
  foreach t in array array['ctas', 'bouches', 'filtres', 'releves_filtres'] loop
    perform app.politiques(t, 'cta', 'site');
  end loop;
end
$$;
