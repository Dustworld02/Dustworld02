-- =====================================================================
-- Phase 3 : instruments et étalonnage, entrepôt des résultats de mesure,
-- campagnes de qualification et essais.
-- =====================================================================

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  type text not null default 'autre',
  libelle text not null check (length(trim(libelle)) > 0),
  marque text not null default '',
  modele text not null default '',
  numero_serie text not null default '',
  plage text not null default '',
  resolution text not null default '',
  incertitude text not null default '',
  periodicite_etalonnage_mois integer not null default 12 check (periodicite_etalonnage_mois > 0),
  proprietaire text not null default 'interne' check (proprietaire in ('interne', 'prestataire', 'location')),
  localisation text not null default '',
  statut text not null default 'en_service' check (statut in ('en_service', 'en_etalonnage', 'hors_service', 'reforme')),
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.etalonnages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  instrument_id uuid not null references public.instruments (id) on delete cascade,
  date_etalonnage date not null,
  prochaine_echeance date,
  organisme text not null default '',
  numero_certificat text not null default '',
  conforme boolean not null default true,
  document_id uuid references public.documents (id) on delete set null,
  commentaire text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.campagnes_qualification (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete restrict,
  site_id uuid,
  numero text,
  titre text not null check (length(trim(titre)) > 0),
  type_campagne text not null default 'initiale' check (type_campagne in ('initiale', 'periodique', 'modification')),
  etapes text[] not null default array['QO']::text[],
  objectif text not null default '',
  responsable text not null default '',
  prestataire text not null default '',
  date_debut date,
  date_fin date,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'protocole_approuve', 'en_execution', 'rapport_redige', 'cloturee', 'annulee')),
  verdict text check (verdict in ('qualifie', 'qualifie_reserves', 'non_qualifie')),
  conclusion text not null default '',
  version integer not null default 1,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (org_id, numero)
);

create table public.essais (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  campagne_id uuid not null references public.campagnes_qualification (id) on delete cascade,
  site_id uuid,
  ordre integer not null default 0,
  cle_essai text not null,
  libelle text not null,
  reference text not null default '',
  cible_type text not null default 'zone' check (cible_type in ('zone', 'cta', 'equipement', 'filtre', 'salle')),
  cible_id uuid,
  cible_libelle text not null default '',
  etat_occupation text check (etat_occupation in ('construction', 'repos', 'activite')),
  critere text not null default '',
  critere_min numeric,
  critere_max numeric,
  unite text not null default '',
  instrument_id uuid references public.instruments (id) on delete set null,
  date_realisation timestamptz,
  realise_par text not null default '',
  statut text not null default 'a_faire' check (statut in ('a_faire', 'realise', 'non_applicable')),
  verdict text check (verdict in ('conforme', 'non_conforme', 'sans_objet')),
  mesures jsonb not null default '[]'::jsonb,
  commentaire text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.resultats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid references public.zones (id) on delete set null,
  point_id uuid references public.points_prelevement (id) on delete set null,
  point_libre text not null default '',
  origine text not null default 'surveillance' check (origine in ('qualification', 'surveillance', 'nettoyage', 'investigation', 'autre')),
  essai_id uuid references public.essais (id) on delete cascade,
  milieu text not null check (milieu in ('air', 'surface', 'gants', 'liquide')),
  nature text not null check (nature in ('particulaire', 'microbiologique', 'chimique')),
  methode text not null default '',
  parametre text not null default '',
  taille_um numeric,
  unite text not null default '',
  valeur numeric not null,
  etat_occupation text check (etat_occupation in ('construction', 'repos', 'activite')),
  instrument_id uuid references public.instruments (id) on delete set null,
  date_prelevement timestamptz not null default now(),
  operateur text not null default '',
  lot_milieu text not null default '',
  germe text not null default '',
  limite_alerte numeric,
  limite_action numeric,
  verdict text not null default 'non_evalue' check (verdict in ('conforme', 'alerte', 'action', 'non_evalue')),
  commentaire text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create index on public.etalonnages (instrument_id, date_etalonnage);
create index on public.campagnes_qualification (salle_id);
create index on public.essais (campagne_id, ordre);
create index on public.resultats (salle_id, date_prelevement);
create index on public.resultats (zone_id, nature, milieu);
create index on public.resultats (point_id);
create index on public.resultats (essai_id);
create index on public.resultats (instrument_id, date_prelevement);

-- ---------------------------------------------------------------------
-- Étalonnage : échéance calculée, validité d'un instrument à une date
-- ---------------------------------------------------------------------

create or replace function app.echeance_etalonnage()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_mois integer;
begin
  if new.prochaine_echeance is null then
    select periodicite_etalonnage_mois into v_mois from public.instruments where id = new.instrument_id;
    new.prochaine_echeance := (new.date_etalonnage + make_interval(months => coalesce(v_mois, 12)))::date;
  end if;
  return new;
end
$$;
create trigger echeance before insert or update on public.etalonnages for each row execute function app.echeance_etalonnage();

-- Un instrument est valide à une date s'il n'est ni hors service ni réformé
-- et qu'un étalonnage conforme couvre cette date.
create or replace function app.instrument_valide(p_instrument uuid, p_date timestamptz)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.instruments i
    join public.etalonnages e on e.instrument_id = i.id
    where i.id = p_instrument and i.statut not in ('hors_service', 'reforme')
      and e.conforme and e.date_etalonnage <= p_date::date and e.prochaine_echeance >= p_date::date
  )
$$;
grant execute on function app.instrument_valide(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Résultats : site déduit de la salle, verdict calculé, instrument valide
-- ---------------------------------------------------------------------

create or replace function app.controler_resultat()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.instrument_id is not null and not app.instrument_valide(new.instrument_id, new.date_prelevement) then
    raise exception 'Instrument non étalonné (ou hors service) à la date du prélèvement : résultat refusé';
  end if;
  new.verdict := case
    when new.limite_action is not null and new.valeur > new.limite_action then 'action'
    when new.limite_alerte is not null and new.valeur > new.limite_alerte then 'alerte'
    when new.limite_action is not null or new.limite_alerte is not null then 'conforme'
    else 'non_evalue'
  end;
  return new;
end
$$;
create trigger controler before insert or update on public.resultats for each row execute function app.controler_resultat();
create trigger site before insert or update on public.resultats for each row execute function app.deduire_site('salle_id', 'salles_propres');
create trigger parent_zone before insert or update on public.resultats for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_point before insert or update on public.resultats for each row execute function app.verifier_parent('point_id', 'points_prelevement');
create trigger parent_essai before insert or update on public.resultats for each row execute function app.verifier_parent('essai_id', 'essais');
create trigger parent_instrument before insert or update on public.resultats for each row execute function app.verifier_parent('instrument_id', 'instruments');
create trigger parent_document before insert or update on public.etalonnages for each row execute function app.verifier_parent('document_id', 'documents');
create trigger parent_instrument before insert or update on public.etalonnages for each row execute function app.verifier_parent('instrument_id', 'instruments');

-- ---------------------------------------------------------------------
-- Qualification : numérotation, signatures exigées, verrouillage après clôture
-- ---------------------------------------------------------------------

create trigger site before insert or update on public.campagnes_qualification for each row execute function app.deduire_site('salle_id', 'salles_propres');
create trigger numero before insert on public.campagnes_qualification for each row execute function app.numeroter('QUAL');
create trigger signature_protocole before insert or update on public.campagnes_qualification
  for each row execute function app.exiger_signature('campagne', 'protocole_approuve', 'approuve', 'protocole', 'version');
create trigger signature_rapport before insert or update on public.campagnes_qualification
  for each row execute function app.exiger_signature('campagne', 'cloturee', 'approuve', 'rapport', 'version');
insert into app.objets_signables values ('campagne', 'campagnes_qualification', 'version', 'qualification_protocoles');

-- Une campagne clôturée ou annulée est figée, ainsi que ses essais et leurs résultats.
create or replace function app.campagne_figee(p_campagne uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.campagnes_qualification c where c.id = p_campagne and c.statut in ('cloturee', 'annulee'))
$$;

create or replace function app.verrouiller_campagne()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op <> 'INSERT' and old.statut in ('cloturee', 'annulee') then
    raise exception 'Campagne clôturée : modification impossible (ouvrez une nouvelle campagne)';
  end if;
  return coalesce(new, old);
end
$$;
create trigger verrou before update or delete on public.campagnes_qualification for each row execute function app.verrouiller_campagne();

create or replace function app.verrouiller_essai()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_campagne uuid;
begin
  if tg_table_name = 'essais' then
    v_campagne := coalesce(new.campagne_id, old.campagne_id);
  else
    v_campagne := (select e.campagne_id from public.essais e where e.id = coalesce(new.essai_id, old.essai_id));
  end if;
  if v_campagne is not null and app.campagne_figee(v_campagne) then
    -- la suppression en cascade d'une campagne annulée reste possible pour l'administration de la base
    raise exception 'Campagne clôturée : essais et résultats figés';
  end if;
  return coalesce(new, old);
end
$$;
create trigger verrou before insert or update or delete on public.essais for each row execute function app.verrouiller_essai();
create trigger verrou before insert or update or delete on public.resultats for each row execute function app.verrouiller_essai();

create trigger site before insert or update on public.essais for each row execute function app.deduire_site('campagne_id', 'campagnes_qualification');
create trigger parent_instrument before insert or update on public.essais for each row execute function app.verifier_parent('instrument_id', 'instruments');

-- Un essai réalisé avec un instrument doit l'être pendant la validité de son étalonnage.
create or replace function app.controler_essai()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.statut = 'realise' and new.instrument_id is not null
     and not app.instrument_valide(new.instrument_id, coalesce(new.date_realisation, now())) then
    raise exception 'Instrument non étalonné (ou hors service) à la date de l''essai : validation refusée';
  end if;
  if new.statut = 'realise' and new.verdict is null then
    raise exception 'Un essai réalisé doit porter un verdict';
  end if;
  return new;
end
$$;
create trigger controler before insert or update on public.essais for each row execute function app.controler_essai();

do $$
declare t text;
begin
  foreach t in array array['instruments', 'etalonnages', 'campagnes_qualification', 'essais', 'resultats'] loop
    perform app.tracer(t);
  end loop;
end
$$;
select app.politiques('instruments', 'instruments', 'org');
select app.politiques('etalonnages', 'instruments', 'org');
select app.politiques('campagnes_qualification', 'qualification_protocoles', 'site');
select app.politiques('essais', 'qualification_execution', 'site');
select app.politiques('resultats', 'contamination_resultats', 'site');
