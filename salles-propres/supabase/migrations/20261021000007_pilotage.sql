-- =====================================================================
-- Phase 4 : écarts et CAPA, tâches (Kanban), discussions, notifications.
-- =====================================================================

create table public.ecarts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  numero text,
  titre text not null check (length(trim(titre)) > 0),
  description text not null default '',
  origine text not null default 'autre'
    check (origine in ('qualification', 'surveillance', 'nettoyage', 'audit', 'etalonnage', 'reclamation', 'maintenance', 'autre')),
  gravite text not null default 'mineure' check (gravite in ('mineure', 'majeure', 'critique')),
  salle_id uuid references public.salles_propres (id) on delete set null,
  objet_type text,
  objet_id uuid,
  lien text not null default '',
  date_detection date not null default current_date,
  detecte_par text not null default '',
  impact text not null default '',
  analyse_causes jsonb not null default '{}'::jsonb,
  statut text not null default 'ouvert'
    check (statut in ('ouvert', 'en_analyse', 'capa_en_cours', 'a_verifier', 'cloture', 'annule')),
  conclusion text not null default '',
  cloture_le date,
  automatique boolean not null default false,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (org_id, numero)
);

create table public.capa (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  numero text,
  ecart_id uuid references public.ecarts (id) on delete cascade,
  type text not null default 'corrective' check (type in ('corrective', 'preventive')),
  action text not null check (length(trim(action)) > 0),
  proprietaire uuid references public.profils (id) on delete set null,
  echeance date,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'realisee', 'efficace', 'non_efficace', 'annulee')),
  realisee_le date,
  preuve text not null default '',
  verification_prevue date,
  verification_resultat text not null default '',
  verifie_le date,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (org_id, numero)
);

create table public.colonnes_kanban (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  libelle text not null check (length(trim(libelle)) > 0),
  ordre integer not null default 0,
  terminale boolean not null default false,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create table public.taches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  colonne_id uuid not null references public.colonnes_kanban (id) on delete restrict,
  titre text not null check (length(trim(titre)) > 0),
  description text not null default '',
  ordre numeric not null default 0,
  proprietaire uuid references public.profils (id) on delete set null,
  echeance date,
  priorite text not null default 'normale' check (priorite in ('basse', 'normale', 'haute', 'urgente')),
  etiquettes text[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb,
  salle_id uuid references public.salles_propres (id) on delete set null,
  objet_type text,
  objet_id uuid,
  lien text not null default '',
  source_cle text,
  termine_le timestamptz,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid(),
  unique (org_id, source_cle)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- 'general' pour l'espace commun, sinon le type d'objet commenté
  objet_type text not null default 'general',
  objet_id uuid,
  objet_libelle text not null default '',
  lien text not null default '',
  auteur uuid not null default auth.uid(),
  contenu text not null check (length(trim(contenu)) > 0),
  mentions uuid[] not null default '{}',
  reponse_a uuid references public.messages (id) on delete set null,
  archive boolean not null default false,
  cree_le timestamptz not null default now(), cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(), modifie_par uuid default auth.uid()
);

create index on public.ecarts (statut);
create index on public.ecarts (objet_type, objet_id);
create index on public.capa (ecart_id);
create index on public.capa (proprietaire, statut);
create index on public.taches (colonne_id, ordre);
create index on public.taches (proprietaire);
create index on public.messages (objet_type, objet_id, cree_le);

create trigger numero before insert on public.ecarts for each row execute function app.numeroter('EC');
create trigger numero before insert on public.capa for each row execute function app.numeroter('CAPA');
create trigger parent_salle before insert or update on public.ecarts for each row execute function app.verifier_parent('salle_id', 'salles_propres');
create trigger parent_ecart before insert or update on public.capa for each row execute function app.verifier_parent('ecart_id', 'ecarts');
create trigger parent_colonne before insert or update on public.taches for each row execute function app.verifier_parent('colonne_id', 'colonnes_kanban');
create trigger parent_salle before insert or update on public.taches for each row execute function app.verifier_parent('salle_id', 'salles_propres');
create trigger parent_message before insert or update on public.messages for each row execute function app.verifier_parent('reponse_a', 'messages');

-- Clôture d'un écart : signature d'approbation, CAPA soldées.
create trigger signature_cloture before insert or update on public.ecarts
  for each row execute function app.exiger_signature('ecart', 'cloture', 'approuve', 'cloture', '');
insert into app.objets_signables values ('ecart', 'ecarts', null, 'ecarts_capa');

create or replace function app.controler_ecart()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.statut = 'cloture' then raise exception 'Un écart clôturé ne peut pas être supprimé'; end if;
    return old;
  end if;
  if new.statut = 'cloture' and (tg_op = 'INSERT' or old.statut is distinct from 'cloture') then
    if exists (select 1 from public.capa c where c.ecart_id = new.id and c.statut not in ('efficace', 'annulee')) then
      raise exception 'Clôture impossible : des CAPA ne sont ni vérifiées efficaces ni annulées';
    end if;
    if coalesce(trim(new.conclusion), '') = '' then
      raise exception 'Clôture impossible : conclusion obligatoire';
    end if;
    new.cloture_le := coalesce(new.cloture_le, current_date);
  end if;
  if tg_op = 'UPDATE' and old.statut in ('cloture', 'annule') then
    raise exception 'Écart clôturé : modification impossible';
  end if;
  return new;
end
$$;
create trigger controler before insert or update or delete on public.ecarts for each row execute function app.controler_ecart();

-- CAPA : figées avec leur écart clôturé ; vérification d'efficacité réservée au niveau validation.
create or replace function app.controler_capa()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_ecart uuid := coalesce(new.ecart_id, old.ecart_id);
begin
  if v_ecart is not null and exists (select 1 from public.ecarts e where e.id = v_ecart and e.statut in ('cloture', 'annule')) then
    raise exception 'Écart clôturé : ses CAPA ne peuvent plus être modifiées';
  end if;
  if tg_op <> 'DELETE' and new.statut in ('efficace', 'non_efficace')
     and (tg_op = 'INSERT' or old.statut is distinct from new.statut)
     and auth.uid() is not null and app.niveau(new.org_id, 'ecarts_capa') < 3 then
    raise exception 'La vérification d''efficacité d''une CAPA relève du niveau validation';
  end if;
  if tg_op <> 'DELETE' and new.statut = 'realisee' and (tg_op = 'INSERT' or old.statut is distinct from 'realisee') then
    new.realisee_le := coalesce(new.realisee_le, current_date);
  end if;
  if tg_op <> 'DELETE' and new.statut in ('efficace', 'non_efficace') and (tg_op = 'INSERT' or old.statut is distinct from new.statut) then
    new.verifie_le := coalesce(new.verifie_le, current_date);
  end if;
  return coalesce(new, old);
end
$$;
create trigger controler before insert or update or delete on public.capa for each row execute function app.controler_capa();

-- Messages : jamais supprimés ni réécrits ; seul l'archivage est possible.
create or replace function app.controler_message()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Les messages ne sont jamais supprimés : archivez-les';
  end if;
  if new.contenu is distinct from old.contenu or new.auteur is distinct from old.auteur
     or new.objet_id is distinct from old.objet_id or new.mentions is distinct from old.mentions then
    raise exception 'Un message publié ne peut pas être modifié (seul l''archivage est possible)';
  end if;
  return coalesce(new, old);
end
$$;
create trigger controler before update or delete on public.messages for each row execute function app.controler_message();

create or replace function app.auteur_message()
returns trigger
language plpgsql
as $$
begin
  new.auteur := coalesce(auth.uid(), new.auteur);
  return new;
end
$$;
create trigger auteur before insert on public.messages for each row execute function app.auteur_message();

-- Tâche terminée : horodatage à l'entrée dans une colonne terminale.
create or replace function app.terminer_tache()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_terminale boolean;
begin
  select terminale into v_terminale from public.colonnes_kanban where id = new.colonne_id;
  if v_terminale and (tg_op = 'INSERT' or old.colonne_id is distinct from new.colonne_id) then
    new.termine_le := now();
  elsif not coalesce(v_terminale, false) then
    new.termine_le := null;
  end if;
  return new;
end
$$;
create trigger terminer before insert or update on public.taches for each row execute function app.terminer_tache();

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------

create or replace function app.notifier_attribution()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.proprietaire is not null and (tg_op = 'INSERT' or new.proprietaire is distinct from old.proprietaire) then
    if tg_table_name = 'taches' then
      perform app.notifier(new.org_id, new.proprietaire, 'tache', 'Tâche assignée : ' || new.titre, '/taches?carte=' || new.id);
    else
      perform app.notifier(new.org_id, new.proprietaire, 'capa', 'Action CAPA assignée : ' || left(new.action, 120),
        case when new.ecart_id is null then '/ecarts' else '/ecarts/' || new.ecart_id end);
    end if;
  end if;
  return null;
end
$$;
create trigger notifier after insert or update on public.taches for each row execute function app.notifier_attribution();
create trigger notifier after insert or update on public.capa for each row execute function app.notifier_attribution();

create or replace function app.notifier_mentions()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_dest uuid;
  v_auteur text;
begin
  select coalesce(nullif(nom_complet, ''), email) into v_auteur from public.profils where id = new.auteur;
  foreach v_dest in array new.mentions loop
    perform app.notifier(new.org_id, v_dest, 'mention',
      coalesce(v_auteur, 'Quelqu''un') || ' vous mentionne' || case when new.objet_libelle <> '' then ' (' || new.objet_libelle || ')' else '' end || ' : ' || left(new.contenu, 120),
      coalesce(nullif(new.lien, ''), '/discussions'));
  end loop;
  return null;
end
$$;
create trigger notifier after insert on public.messages for each row execute function app.notifier_mentions();

-- ---------------------------------------------------------------------
-- Écarts automatiques
-- ---------------------------------------------------------------------

create or replace function app.ecart_automatique()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'resultats' then
    if new.verdict = 'action' and new.origine <> 'qualification' and (tg_op = 'INSERT' or old.verdict is distinct from 'action') then
      insert into public.ecarts (org_id, titre, description, origine, gravite, salle_id, objet_type, objet_id, lien, date_detection, detecte_par, automatique)
      values (new.org_id,
        'Dépassement de la limite d''action : ' || coalesce(nullif(new.parametre, ''), new.nature),
        format('Valeur %s %s pour une limite d''action de %s (%s, %s).', new.valeur, new.unite, new.limite_action, new.milieu, new.nature),
        case when new.origine = 'nettoyage' then 'nettoyage' else 'surveillance' end,
        'majeure', new.salle_id, 'resultat', new.id, '/contaminations', new.date_prelevement::date, new.operateur, true);
    end if;
  elsif tg_table_name = 'essais' then
    if new.statut = 'realise' and new.verdict = 'non_conforme' and (tg_op = 'INSERT' or old.verdict is distinct from 'non_conforme' or old.statut is distinct from 'realise') then
      insert into public.ecarts (org_id, titre, description, origine, gravite, salle_id, objet_type, objet_id, lien, date_detection, detecte_par, automatique)
      select new.org_id, 'Essai non conforme : ' || new.libelle || ' — ' || new.cible_libelle,
        'Critère : ' || new.critere || case when new.commentaire <> '' then E'\n' || new.commentaire else '' end,
        'qualification', 'majeure', c.salle_id, 'essai', new.id, '/qualification/' || c.id, coalesce(new.date_realisation, now())::date, new.realise_par, true
      from public.campagnes_qualification c where c.id = new.campagne_id;
    end if;
  elsif tg_table_name = 'etalonnages' then
    if not new.conforme and (tg_op = 'INSERT' or old.conforme) then
      insert into public.ecarts (org_id, titre, description, origine, gravite, objet_type, objet_id, lien, date_detection, automatique)
      select new.org_id, 'Étalonnage non conforme : ' || i.libelle,
        'Évaluer l''impact sur les mesures réalisées depuis le dernier étalonnage conforme. ' || new.commentaire,
        'etalonnage', 'majeure', 'instrument', i.id, '/instruments', new.date_etalonnage, true
      from public.instruments i where i.id = new.instrument_id;
    end if;
  end if;
  return null;
end
$$;
create trigger ecart_automatique after insert or update on public.resultats for each row execute function app.ecart_automatique();
create trigger ecart_automatique after insert or update on public.essais for each row execute function app.ecart_automatique();
create trigger ecart_automatique after insert or update on public.etalonnages for each row execute function app.ecart_automatique();

do $$
declare t text;
begin
  foreach t in array array['ecarts', 'capa', 'colonnes_kanban', 'taches', 'messages'] loop
    perform app.tracer(t);
  end loop;
end
$$;
select app.politiques('ecarts', 'ecarts_capa', 'org');
select app.politiques('capa', 'ecarts_capa', 'org');
select app.politiques('colonnes_kanban', 'kanban', 'membre', 3, 3);
select app.politiques('taches', 'kanban', 'org');
select app.politiques('messages', 'discussions', 'org', 2, 4);
