-- =====================================================================
-- Phase 5 : nettoyage (produits, consommables, procédures, planning,
-- interventions, validation, matériel) et personnel (habilitations,
-- formations).
-- =====================================================================


-- Le compte utilisateur lié à une personne doit être membre de l'organisation.
create or replace function app.verifier_utilisateur_membre()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.user_id is not null and not exists (select 1 from public.membres m where m.org_id = new.org_id and m.user_id = new.user_id) then
    raise exception 'Rattachement invalide : cet utilisateur n''est pas membre de l''organisation';
  end if;
  return new;
end
$$;

create table public.produits_nettoyage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  famille text not null default 'detergent',
  fournisseur text not null default '',
  reference text not null default '',
  substance_active text not null default '',
  dilution text not null default '',
  temps_contact_min numeric check (temps_contact_min >= 0),
  spectre text not null default '',
  rincage boolean not null default false,
  sterile boolean not null default false,
  compatibilites text not null default '',
  groupe_rotation text not null default '',
  peremption_solution_h numeric check (peremption_solution_h >= 0),
  fds_document_id uuid references public.documents (id) on delete set null,
  modele_cle text,
  a_completer boolean not null default false,
  actif boolean not null default true,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.consommables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  type text not null default 'lingette' check (type in ('lingette', 'mop', 'gant', 'tenue', 'autre')),
  matiere text not null default '',
  sterile boolean not null default false,
  preimpregne text not null default '',
  classe_iso_min numeric check (classe_iso_min between 1 and 9),
  fournisseur text not null default '',
  reference text not null default '',
  unite text not null default 'unité',
  stock numeric not null default 0,
  seuil_alerte numeric not null default 0,
  modele_cle text,
  a_completer boolean not null default false,
  actif boolean not null default true,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.procedures_nettoyage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  categorie text not null default 'nettoyage' check (categorie in ('nettoyage', 'habillage')),
  titre text not null check (length(trim(titre)) > 0),
  zones uuid[] not null default '{}',
  version integer not null default 1,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'approuvee', 'perimee')),
  contenu jsonb not null default '{}'::jsonb,
  gabarit_ref jsonb,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.personnes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  prenom text not null default '',
  fonction text not null default '',
  employeur text not null default 'interne' check (employeur in ('interne', 'prestataire', 'interimaire')),
  entreprise text not null default '',
  user_id uuid references public.profils (id) on delete set null,
  actif boolean not null default true,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.habilitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  personne_id uuid not null references public.personnes (id) on delete cascade,
  type text not null default 'acces_zone' check (type in ('acces_zone', 'habillage', 'nettoyage')),
  -- classe la plus propre autorisée (ex. 7 : ISO 7, 8 et 9)
  classe_iso_max numeric check (classe_iso_max between 1 and 9),
  grade_bpf text check (grade_bpf in ('A', 'B', 'C', 'D')),
  date_obtention date not null default current_date,
  date_expiration date,
  evaluateur text not null default '',
  resultat text not null default '',
  document_id uuid references public.documents (id) on delete set null,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.formations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  personne_id uuid not null references public.personnes (id) on delete cascade,
  intitule text not null check (length(trim(intitule)) > 0),
  theme text not null default 'autre',
  organisme text not null default '',
  date_formation date not null default current_date,
  duree_h numeric,
  date_recyclage date,
  document_id uuid references public.documents (id) on delete set null,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.interventions_nettoyage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid not null references public.zones (id) on delete cascade,
  procedure_id uuid not null references public.procedures_nettoyage (id) on delete cascade,
  titre text not null default '',
  date_prevue date not null,
  moment text not null default 'journee' check (moment in ('debut_poste', 'fin_poste', 'journee')),
  surfaces text[] not null default '{}',
  personne_id uuid references public.personnes (id) on delete set null,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'realisee', 'non_realisee', 'reportee')),
  realise_le timestamptz,
  duree_min numeric,
  etapes_faites integer[] not null default '{}',
  lots jsonb not null default '[]'::jsonb,
  anomalies text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (procedure_id, zone_id, date_prevue, moment)
);

create table public.validations_nettoyage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  procedure_id uuid references public.procedures_nettoyage (id) on delete set null,
  titre text not null check (length(trim(titre)) > 0),
  date_validation date not null default current_date,
  criteres text not null default '',
  statut text not null default 'planifiee' check (statut in ('planifiee', 'en_cours', 'conforme', 'non_conforme')),
  conclusion text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.materiel_nettoyage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid references public.salles_propres (id) on delete set null,
  libelle text not null check (length(trim(libelle)) > 0),
  type text not null default 'autre',
  couleur text not null default '',
  zones_dediees text not null default '',
  etat text not null default 'bon' check (etat in ('bon', 'use', 'hors_service')),
  date_mise_service date,
  date_remplacement_prevue date,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

alter table public.resultats add column validation_id uuid references public.validations_nettoyage (id) on delete set null;

create index on public.procedures_nettoyage (salle_id);
create index on public.interventions_nettoyage (salle_id, date_prevue);
create index on public.interventions_nettoyage (personne_id);
create index on public.habilitations (personne_id);
create index on public.formations (personne_id);
create index on public.resultats (validation_id);

-- Rattachements
create trigger site before insert or update on public.procedures_nettoyage for each row execute function app.deduire_site('salle_id', 'salles_propres');
create trigger site before insert or update on public.interventions_nettoyage for each row execute function app.deduire_site('salle_id', 'salles_propres');
create trigger site before insert or update on public.validations_nettoyage for each row execute function app.deduire_site('salle_id', 'salles_propres');
create trigger parent_zone before insert or update on public.interventions_nettoyage for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_procedure before insert or update on public.interventions_nettoyage for each row execute function app.verifier_parent('procedure_id', 'procedures_nettoyage');
create trigger parent_personne before insert or update on public.interventions_nettoyage for each row execute function app.verifier_parent('personne_id', 'personnes');
create trigger parent_procedure before insert or update on public.validations_nettoyage for each row execute function app.verifier_parent('procedure_id', 'procedures_nettoyage');
create trigger parent_salle before insert or update on public.materiel_nettoyage for each row execute function app.verifier_parent('salle_id', 'salles_propres');
create trigger parent_personne before insert or update on public.habilitations for each row execute function app.verifier_parent('personne_id', 'personnes');
create trigger parent_personne before insert or update on public.formations for each row execute function app.verifier_parent('personne_id', 'personnes');
create trigger parent_document before insert or update on public.habilitations for each row execute function app.verifier_parent('document_id', 'documents');
create trigger parent_document before insert or update on public.formations for each row execute function app.verifier_parent('document_id', 'documents');
create trigger parent_fds before insert or update on public.produits_nettoyage for each row execute function app.verifier_parent('fds_document_id', 'documents');
create trigger parent_validation before insert or update on public.resultats for each row execute function app.verifier_parent('validation_id', 'validations_nettoyage');
create trigger parent_utilisateur before insert or update on public.personnes for each row execute function app.verifier_utilisateur_membre();

-- ---------------------------------------------------------------------
-- Procédures : approbation signée ; toute modification d'une procédure
-- approuvée crée une nouvelle version en brouillon.
-- ---------------------------------------------------------------------

insert into app.objets_signables values ('procedure', 'procedures_nettoyage', 'version', 'nettoyage_procedures');
create trigger signature before insert or update on public.procedures_nettoyage
  for each row execute function app.exiger_signature('procedure', 'approuvee', 'approuve', '', 'version');

create or replace function app.versionner_procedure()
returns trigger
language plpgsql
as $$
begin
  if old.statut = 'approuvee' and new.statut = 'approuvee'
     and (new.contenu is distinct from old.contenu or new.titre is distinct from old.titre or new.zones is distinct from old.zones) then
    new.version := old.version + 1;
    new.statut := 'brouillon';
  end if;
  return new;
end
$$;
create trigger versionner before update on public.procedures_nettoyage for each row execute function app.versionner_procedure();

-- ---------------------------------------------------------------------
-- Habilitations : une personne n'intervient que dans les zones pour
-- lesquelles elle détient une habilitation valide.
-- ---------------------------------------------------------------------

create or replace function app.personne_habilitee(p_personne uuid, p_zone uuid, p_date date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.habilitations h
    join public.zones z on z.id = p_zone
    where h.personne_id = p_personne
      and h.type in ('acces_zone', 'nettoyage')
      and h.date_obtention <= p_date
      and (h.date_expiration is null or h.date_expiration >= p_date)
      and (
        (z.grade_bpf is not null and h.grade_bpf is not null and h.grade_bpf <= z.grade_bpf)
        or (h.classe_iso_max is not null and h.classe_iso_max <= coalesce(z.iso_repos, 9))
        or (z.grade_bpf is null and z.iso_repos is null)
      )
  )
$$;
grant execute on function app.personne_habilitee(uuid, uuid, date) to authenticated;

create or replace function app.controler_intervention()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_statut text; v_salle uuid;
begin
  if tg_op = 'INSERT' then
    select statut, salle_id into v_statut, v_salle from public.procedures_nettoyage where id = new.procedure_id;
    if v_statut is distinct from 'approuvee' then
      raise exception 'Procédure non approuvée : planification impossible';
    end if;
  end if;
  if new.personne_id is not null and (tg_op = 'INSERT' or new.personne_id is distinct from old.personne_id or new.statut is distinct from old.statut)
     and not app.personne_habilitee(new.personne_id, new.zone_id, coalesce(new.realise_le::date, new.date_prevue)) then
    raise exception 'Personne non habilitée pour cette zone à cette date';
  end if;
  if new.statut = 'realisee' then
    if new.personne_id is null then raise exception 'Indiquez qui a réalisé le nettoyage'; end if;
    new.realise_le := coalesce(new.realise_le, now());
  end if;
  return new;
end
$$;
create trigger controler before insert or update on public.interventions_nettoyage for each row execute function app.controler_intervention();

do $$
declare t text;
begin
  foreach t in array array['produits_nettoyage', 'consommables', 'procedures_nettoyage', 'personnes', 'habilitations', 'formations',
    'interventions_nettoyage', 'validations_nettoyage', 'materiel_nettoyage'] loop
    perform app.tracer(t);
  end loop;
end
$$;
select app.politiques('produits_nettoyage', 'nettoyage_procedures', 'org');
select app.politiques('consommables', 'nettoyage_procedures', 'org');
select app.politiques('materiel_nettoyage', 'nettoyage_procedures', 'org');
select app.politiques('procedures_nettoyage', 'nettoyage_procedures', 'site');
select app.politiques('interventions_nettoyage', 'nettoyage_execution', 'site');
select app.politiques('validations_nettoyage', 'nettoyage_execution', 'site');
select app.politiques('personnes', 'personnel', 'org');
select app.politiques('habilitations', 'personnel', 'org');
select app.politiques('formations', 'personnel', 'org');
