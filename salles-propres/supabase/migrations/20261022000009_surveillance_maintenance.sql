-- =====================================================================
-- Phase 6 : plans d'échantillonnage, règle de dérive, relevés d'ambiance
-- (GTC / sondes), maintenance préventive et corrective, change control.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Plan d'échantillonnage de routine
-- ---------------------------------------------------------------------

create table public.plans_echantillonnage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  site_id uuid,
  zone_id uuid references public.zones (id) on delete cascade,
  point_id uuid references public.points_prelevement (id) on delete cascade,
  parametre text not null check (length(trim(parametre)) > 0),
  milieu text not null check (milieu in ('air', 'surface', 'gants', 'liquide')),
  nature text not null check (nature in ('particulaire', 'microbiologique', 'chimique')),
  methode text not null default '',
  unite text not null default '',
  taille_um numeric,
  etat_occupation text check (etat_occupation in ('construction', 'repos', 'activite')),
  frequence text not null default 'hebdomadaire'
    check (frequence in ('quotidien', 'hebdomadaire', 'bimensuel', 'mensuel', 'trimestriel', 'semestriel', 'annuel')),
  limite_alerte numeric,
  limite_action numeric,
  date_debut date not null default current_date,
  actif boolean not null default true,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  check (limite_alerte is null or limite_action is null or limite_alerte <= limite_action)
);
create index on public.plans_echantillonnage (salle_id);
create index on public.plans_echantillonnage (point_id);
create trigger site before insert or update on public.plans_echantillonnage for each row execute function app.deduire_site('salle_id', 'salles_propres');
create trigger parent_zone before insert or update on public.plans_echantillonnage for each row execute function app.verifier_parent('zone_id', 'zones');
create trigger parent_point before insert or update on public.plans_echantillonnage for each row execute function app.verifier_parent('point_id', 'points_prelevement');

alter table public.resultats add column plan_id uuid references public.plans_echantillonnage (id) on delete set null;
create index on public.resultats (plan_id, date_prelevement);
create trigger parent_plan before insert or update on public.resultats for each row execute function app.verifier_parent('plan_id', 'plans_echantillonnage');

-- Règle de dérive : trois résultats de surveillance consécutifs au-delà de
-- la limite d'alerte au même point et pour le même paramètre ouvrent un
-- écart (une seule fois tant qu'il n'est pas clôturé). Le dépassement de la
-- limite d'action est déjà traité par app.ecart_automatique.
create or replace function app.derive_surveillance()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_n int;
  v_hors int;
  v_titre text;
  v_point text;
begin
  if new.point_id is null or new.origine <> 'surveillance' or new.verdict not in ('alerte', 'action') then
    return null;
  end if;
  select count(*), count(*) filter (where verdict in ('alerte', 'action')) into v_n, v_hors
  from (
    select verdict from public.resultats
    where point_id = new.point_id and parametre = new.parametre and origine = 'surveillance'
    order by date_prelevement desc, cree_le desc
    limit 3
  ) t;
  if v_n < 3 or v_hors < 3 then return null; end if;
  select code into v_point from public.points_prelevement where id = new.point_id;
  v_titre := format('Dérive : 3 résultats consécutifs hors limite d''alerte — %s (%s)', v_point, coalesce(nullif(new.parametre, ''), new.nature));
  if exists (select 1 from public.ecarts e where e.org_id = new.org_id and e.objet_type = 'point' and e.objet_id = new.point_id
             and e.titre = v_titre and e.statut not in ('cloture', 'annule')) then
    return null;
  end if;
  insert into public.ecarts (org_id, titre, description, origine, gravite, salle_id, objet_type, objet_id, lien, date_detection, detecte_par, automatique)
  values (new.org_id, v_titre,
    format('Les trois derniers résultats au point %s dépassent la limite d''alerte (dernier : %s %s). Rechercher une cause commune (nettoyage, flux, comportement, équipement).', v_point, new.valeur, new.unite),
    'surveillance', 'mineure', new.salle_id, 'point', new.point_id, '/contaminations?onglet=tendances', new.date_prelevement::date, new.operateur, true);
  return null;
end
$$;
create trigger derive_surveillance after insert on public.resultats for each row execute function app.derive_surveillance();

-- ---------------------------------------------------------------------
-- Relevés d'ambiance (pression différentielle, température, humidité)
-- saisis ou importés de la GTC.
-- ---------------------------------------------------------------------

create table public.releves_ambiance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  zone_id uuid not null references public.zones (id) on delete cascade,
  site_id uuid,
  grandeur text not null check (grandeur in ('pression', 'temperature', 'hr')),
  valeur numeric not null,
  date_mesure timestamptz not null,
  source text not null default 'manuel' check (source in ('manuel', 'gtc', 'import')),
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);
create index on public.releves_ambiance (zone_id, grandeur, date_mesure);
create trigger site before insert or update on public.releves_ambiance for each row execute function app.deduire_site('zone_id', 'zones');

-- ---------------------------------------------------------------------
-- Maintenance : gammes préventives et interventions
-- ---------------------------------------------------------------------

create table public.gammes_maintenance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid,
  cta_id uuid references public.ctas (id) on delete cascade,
  salle_id uuid references public.salles_propres (id) on delete cascade,
  equipement_id uuid references public.equipements (id) on delete cascade,
  libelle text not null check (length(trim(libelle)) > 0),
  periodicite_mois numeric not null default 12 check (periodicite_mois > 0),
  operations text[] not null default '{}',
  prestataire text not null default '',
  duree_h numeric check (duree_h >= 0),
  impact_requalification boolean not null default false,
  date_debut date not null default current_date,
  actif boolean not null default true,
  notes text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.changements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  numero text,
  titre text not null check (length(trim(titre)) > 0),
  description text not null default '',
  justification text not null default '',
  categorie text not null default 'autre'
    check (categorie in ('installation', 'traitement_air', 'procede', 'nettoyage', 'implantation', 'documentation', 'fournisseur', 'autre')),
  type text not null default 'mineur' check (type in ('mineur', 'majeur')),
  salle_id uuid references public.salles_propres (id) on delete set null,
  demandeur text not null default '',
  evaluation jsonb not null default '{}'::jsonb,
  requalification_requise boolean not null default false,
  campagne_id uuid references public.campagnes_qualification (id) on delete set null,
  plan_actions text not null default '',
  date_cible date,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'en_evaluation', 'approuve', 'realise', 'cloture', 'refuse')),
  realise_le date,
  cloture_le date,
  conclusion text not null default '',
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (org_id, numero)
);

create table public.interventions_maintenance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid,
  gamme_id uuid references public.gammes_maintenance (id) on delete set null,
  cta_id uuid references public.ctas (id) on delete cascade,
  salle_id uuid references public.salles_propres (id) on delete cascade,
  equipement_id uuid references public.equipements (id) on delete cascade,
  type text not null default 'preventive' check (type in ('preventive', 'corrective')),
  titre text not null check (length(trim(titre)) > 0),
  date_prevue date not null default current_date,
  date_realisation date,
  intervenant text not null default '',
  statut text not null default 'planifiee' check (statut in ('planifiee', 'realisee', 'annulee')),
  compte_rendu text not null default '',
  remise_en_service text not null default '',
  changement_id uuid references public.changements (id) on delete set null,
  ecart_id uuid references public.ecarts (id) on delete set null,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);
create index on public.gammes_maintenance (cta_id);
create index on public.gammes_maintenance (salle_id);
create index on public.interventions_maintenance (gamme_id, date_prevue);
create index on public.changements (statut);

-- Une gamme ou une intervention porte sur une CTA ou sur une salle (et
-- éventuellement un équipement de cette salle) ; elle hérite de son site.
create or replace function app.site_maintenance()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_site uuid; v_org uuid; v_salle uuid;
begin
  if new.cta_id is not null then
    select site_id, org_id into v_site, v_org from public.ctas where id = new.cta_id;
  elsif new.salle_id is not null then
    select site_id, org_id into v_site, v_org from public.salles_propres where id = new.salle_id;
  else
    raise exception 'Rattachement obligatoire : CTA ou salle propre';
  end if;
  if v_org is distinct from new.org_id then
    raise exception 'Rattachement invalide : la CTA ou la salle n''appartient pas à cette organisation';
  end if;
  if new.equipement_id is not null then
    select salle_id into v_salle from public.equipements where id = new.equipement_id and org_id = new.org_id;
    if v_salle is null or v_salle is distinct from new.salle_id then
      raise exception 'Rattachement invalide : l''équipement doit appartenir à la salle choisie';
    end if;
  end if;
  new.site_id := v_site;
  return new;
end
$$;
create trigger site before insert or update on public.gammes_maintenance for each row execute function app.site_maintenance();
create trigger site before insert or update on public.interventions_maintenance for each row execute function app.site_maintenance();
create trigger parent_gamme before insert or update on public.interventions_maintenance for each row execute function app.verifier_parent('gamme_id', 'gammes_maintenance');
create trigger parent_changement before insert or update on public.interventions_maintenance for each row execute function app.verifier_parent('changement_id', 'changements');
create trigger parent_ecart before insert or update on public.interventions_maintenance for each row execute function app.verifier_parent('ecart_id', 'ecarts');

-- Intervention réalisée : date et compte rendu obligatoires.
create or replace function app.controler_intervention_maintenance()
returns trigger
language plpgsql
as $$
begin
  if new.statut = 'realisee' then
    new.date_realisation := coalesce(new.date_realisation, current_date);
    if coalesce(trim(new.compte_rendu), '') = '' then
      raise exception 'Compte rendu obligatoire pour une intervention réalisée';
    end if;
  end if;
  return new;
end
$$;
create trigger controler before insert or update on public.interventions_maintenance for each row execute function app.controler_intervention_maintenance();

-- Change control : approbation et clôture signées, requalification exigée
-- avant clôture quand l'évaluation le demande, figé une fois clôturé.
create trigger numero before insert on public.changements for each row execute function app.numeroter('CC');
create trigger parent_salle before insert or update on public.changements for each row execute function app.verifier_parent('salle_id', 'salles_propres');
create trigger parent_campagne before insert or update on public.changements for each row execute function app.verifier_parent('campagne_id', 'campagnes_qualification');
create trigger signature_approbation before insert or update on public.changements
  for each row execute function app.exiger_signature('changement', 'approuve', 'approuve', 'approbation', '');
create trigger signature_cloture before insert or update on public.changements
  for each row execute function app.exiger_signature('changement', 'cloture', 'approuve', 'cloture', '');
insert into app.objets_signables values ('changement', 'changements', null, 'maintenance');

create or replace function app.controler_changement()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.statut in ('approuve', 'realise', 'cloture') then raise exception 'Un changement approuvé ne peut pas être supprimé'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.statut in ('cloture', 'refuse') then
    raise exception 'Changement clôturé : modification impossible';
  end if;
  if new.statut = 'realise' and (tg_op = 'INSERT' or old.statut is distinct from 'realise') then
    new.realise_le := coalesce(new.realise_le, current_date);
  end if;
  if new.statut = 'cloture' and (tg_op = 'INSERT' or old.statut is distinct from 'cloture') then
    if coalesce(trim(new.conclusion), '') = '' then
      raise exception 'Clôture impossible : conclusion obligatoire';
    end if;
    if new.requalification_requise and not exists (
      select 1 from public.campagnes_qualification c where c.id = new.campagne_id and c.statut = 'cloturee'
    ) then
      raise exception 'Clôture impossible : la requalification demandée n''est pas clôturée';
    end if;
    new.cloture_le := coalesce(new.cloture_le, current_date);
  end if;
  return new;
end
$$;
create trigger controler before insert or update or delete on public.changements for each row execute function app.controler_changement();

do $$
declare t text;
begin
  foreach t in array array['plans_echantillonnage', 'releves_ambiance', 'gammes_maintenance', 'changements', 'interventions_maintenance'] loop
    perform app.tracer(t);
  end loop;
end
$$;
select app.politiques('plans_echantillonnage', 'contamination_resultats', 'site', 3, 3);
select app.politiques('releves_ambiance', 'cta', 'site');
select app.politiques('gammes_maintenance', 'maintenance', 'site');
select app.politiques('interventions_maintenance', 'maintenance', 'site');
select app.politiques('changements', 'maintenance', 'org');
