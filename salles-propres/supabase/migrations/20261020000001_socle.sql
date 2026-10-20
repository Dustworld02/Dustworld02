-- =====================================================================
-- Salles Propres — Phase 1 : socle
-- Organisations, utilisateurs, rôles et droits, référentiels, gabarits,
-- entreprises → sites → salles propres → zones, documents (GED),
-- signatures électroniques, journal d'audit en ajout seul.
--
-- Niveaux de droits : 0 aucun, 1 lecture, 2 écriture, 3 validation,
-- 4 administration. Les droits sont vérifiés ici (RLS), l'interface ne
-- fait que les refléter.
-- =====================================================================

create schema if not exists app;
grant usage on schema app to authenticated, anon;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) > 0),
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);

create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nom_complet text not null default ''
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  cle text not null,
  libelle text not null,
  description text not null default '',
  systeme boolean not null default false,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (org_id, cle)
);

create table public.droits_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  module text not null,
  niveau smallint not null check (niveau between 0 and 4),
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (role_id, module)
);

create table public.membres (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profils (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  -- null = tous les sites de l'organisation
  sites uuid[],
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (org_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  email text not null,
  nom_complet text not null default '',
  role_id uuid not null references public.roles (id) on delete cascade,
  sites uuid[],
  acceptee_le timestamptz,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (org_id, email)
);

create table public.referentiels_org (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  cle text not null,
  donnees jsonb not null,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (org_id, cle)
);

create table public.gabarits_org (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  cle text not null,
  version text not null,
  libelle text not null,
  donnees jsonb not null,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (org_id, cle)
);

create table public.entreprises (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  secteur text,
  adresse text not null default '',
  contact text not null default '',
  notes text not null default '',
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  entreprise_id uuid not null references public.entreprises (id) on delete restrict,
  nom text not null check (length(trim(nom)) > 0),
  adresse text not null default '',
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);

create table public.salles_propres (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  nom text not null check (length(trim(nom)) > 0),
  batiment text not null default '',
  etage text not null default '',
  secteur text not null,
  gabarit_cle text,
  gabarit_version text,
  description text not null default '',
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  salle_id uuid not null references public.salles_propres (id) on delete cascade,
  -- recopié depuis la salle par déclencheur (restriction d'accès par site)
  site_id uuid,
  code text not null default '',
  nom text not null check (length(trim(nom)) > 0),
  type_zone text not null default 'salle',
  iso_repos numeric(3, 1) check (iso_repos between 1 and 9),
  iso_activite numeric(3, 1) check (iso_activite between 1 and 9),
  grade_bpf text check (grade_bpf in ('A', 'B', 'C', 'D')),
  zone_risque smallint check (zone_risque between 1 and 4),
  surface_m2 numeric check (surface_m2 > 0),
  hauteur_m numeric check (hauteur_m > 0),
  pression_pa numeric,
  tolerance_pression_pa numeric check (tolerance_pression_pa >= 0),
  renouvellement_vol_h numeric check (renouvellement_vol_h >= 0),
  temperature_min numeric,
  temperature_max numeric,
  hr_min numeric check (hr_min between 0 and 100),
  hr_max numeric check (hr_max between 0 and 100),
  gabarit_ref jsonb,
  notes text not null default '',
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  titre text not null check (length(trim(titre)) > 0),
  type_document text not null,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'en_revue', 'approuve', 'perime')),
  objet_type text,
  objet_id uuid,
  valide_jusqu_au date,
  version_courante integer not null default 0,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);

create table public.versions_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  version integer not null,
  chemin_stockage text not null,
  nom_fichier text not null,
  taille_octets bigint not null default 0,
  type_mime text not null default '',
  commentaire text not null default '',
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid(),
  unique (document_id, version)
);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  objet_type text not null,
  objet_id uuid not null,
  version_objet integer not null,
  signification text not null check (signification in ('redige', 'verifie', 'approuve')),
  signataire uuid not null,
  nom_signataire text not null,
  commentaire text not null default '',
  signe_le timestamptz not null default now()
);

create table public.journal_audit (
  id bigint generated always as identity primary key,
  org_id uuid,
  table_nom text not null,
  enregistrement_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  anciennes jsonb,
  nouvelles jsonb,
  auteur uuid,
  horodatage timestamptz not null default now()
);

create index on public.droits_roles (role_id);
create index on public.membres (user_id);
create index on public.sites (entreprise_id);
create index on public.salles_propres (site_id);
create index on public.zones (salle_id);
create index on public.documents (objet_type, objet_id);
create index on public.versions_documents (document_id);
create index on public.signatures (objet_type, objet_id);
create index on public.journal_audit (org_id, horodatage desc);
create index on public.journal_audit (table_nom, enregistrement_id);

-- ---------------------------------------------------------------------
-- Fonctions d'autorisation
-- ---------------------------------------------------------------------

create or replace function app.niveau(p_org uuid, p_module text)
returns smallint
language sql stable security definer set search_path = public
as $$
  select coalesce(max(d.niveau), 0)::smallint
  from public.membres m
  join public.droits_roles d on d.role_id = m.role_id and d.module = p_module
  where m.org_id = p_org and m.user_id = auth.uid() and m.actif
$$;

create or replace function app.est_membre(p_org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.membres m
    where m.org_id = p_org and m.user_id = auth.uid() and m.actif
  )
$$;

create or replace function app.acces_site(p_org uuid, p_site uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.membres m
    where m.org_id = p_org and m.user_id = auth.uid() and m.actif
      and (m.sites is null or p_site = any (m.sites))
  )
$$;

create or replace function app.uuid_ou_null(p text)
returns uuid
language plpgsql immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end
$$;

grant execute on function app.niveau(uuid, text), app.est_membre(uuid),
  app.acces_site(uuid, uuid), app.uuid_ou_null(text) to authenticated, anon;

-- ---------------------------------------------------------------------
-- Déclencheurs : horodatage, cohérence, audit
-- ---------------------------------------------------------------------

-- Horodate les modifications et empêche de réécrire l'origine d'un enregistrement.
create or replace function app.horodater()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le := now();
  new.modifie_par := auth.uid();
  new.cree_le := old.cree_le;
  new.cree_par := old.cree_par;
  if tg_table_name <> 'organisations' then
    if new.org_id is distinct from old.org_id then
      raise exception 'Un enregistrement ne peut pas changer d''organisation';
    end if;
  end if;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['organisations', 'roles', 'droits_roles', 'membres', 'invitations',
    'referentiels_org', 'gabarits_org', 'entreprises', 'sites', 'salles_propres', 'zones',
    'documents', 'versions_documents']
  loop
    execute format('create trigger horodater before update on public.%I for each row execute function app.horodater()', t);
  end loop;
end
$$;

-- Journal d'audit : qui, quand, quoi, valeurs avant et après.
create or replace function app.journaliser()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_anciennes jsonb;
  v_nouvelles jsonb;
  v_org uuid;
begin
  if tg_op <> 'INSERT' then v_anciennes := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_nouvelles := to_jsonb(new); end if;
  if tg_table_name = 'organisations' then
    v_org := coalesce(v_nouvelles ->> 'id', v_anciennes ->> 'id')::uuid;
  else
    v_org := coalesce(v_nouvelles ->> 'org_id', v_anciennes ->> 'org_id')::uuid;
  end if;
  insert into public.journal_audit (org_id, table_nom, enregistrement_id, action, anciennes, nouvelles, auteur)
  values (v_org, tg_table_name, coalesce(v_nouvelles ->> 'id', v_anciennes ->> 'id')::uuid,
          lower(tg_op), v_anciennes, v_nouvelles, auth.uid());
  return null;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['organisations', 'roles', 'droits_roles', 'membres', 'invitations',
    'referentiels_org', 'gabarits_org', 'entreprises', 'sites', 'salles_propres', 'zones',
    'documents', 'versions_documents', 'signatures']
  loop
    execute format('create trigger journaliser after insert or update or delete on public.%I for each row execute function app.journaliser()', t);
  end loop;
end
$$;

-- Le journal et les signatures sont en ajout seul, y compris pour un administrateur de la base.
create or replace function app.ajout_seul()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La table % est en ajout seul : modification et suppression interdites', tg_table_name;
end
$$;

create trigger ajout_seul before update or delete on public.journal_audit
  for each row execute function app.ajout_seul();
create trigger ajout_seul before update or delete on public.signatures
  for each row execute function app.ajout_seul();

-- Cohérence des rattachements entre organisations.
create or replace function app.coherence_site()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.entreprises e where e.id = new.entreprise_id and e.org_id = new.org_id) then
    raise exception 'L''entreprise n''appartient pas à cette organisation';
  end if;
  return new;
end
$$;
create trigger coherence before insert or update of entreprise_id, org_id on public.sites
  for each row execute function app.coherence_site();

create or replace function app.coherence_salle()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.sites s where s.id = new.site_id and s.org_id = new.org_id) then
    raise exception 'Le site n''appartient pas à cette organisation';
  end if;
  -- les zones suivent le site de leur salle
  if tg_op = 'UPDATE' and new.site_id is distinct from old.site_id then
    update public.zones set site_id = new.site_id where salle_id = new.id;
  end if;
  return new;
end
$$;
create trigger coherence before insert or update of site_id, org_id on public.salles_propres
  for each row execute function app.coherence_salle();

create or replace function app.coherence_zone()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_site uuid;
begin
  select s.site_id into v_site from public.salles_propres s
  where s.id = new.salle_id and s.org_id = new.org_id;
  if v_site is null then
    raise exception 'La salle propre n''appartient pas à cette organisation';
  end if;
  new.site_id := v_site;
  return new;
end
$$;
create trigger coherence before insert or update of salle_id, org_id, site_id on public.zones
  for each row execute function app.coherence_zone();

create or replace function app.coherence_membre()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.roles r where r.id = new.role_id and r.org_id = new.org_id) then
    raise exception 'Le rôle n''appartient pas à cette organisation';
  end if;
  return new;
end
$$;
create trigger coherence before insert or update of role_id, org_id on public.membres
  for each row execute function app.coherence_membre();
create trigger coherence before insert or update of role_id, org_id on public.invitations
  for each row execute function app.coherence_membre();

create or replace function app.coherence_droit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.roles r where r.id = new.role_id and r.org_id = new.org_id) then
    raise exception 'Le rôle n''appartient pas à cette organisation';
  end if;
  return new;
end
$$;
create trigger coherence before insert or update of role_id, org_id on public.droits_roles
  for each row execute function app.coherence_droit();

-- Une organisation garde toujours au moins un administrateur actif.
create or replace function app.verifier_admin_restant()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_org uuid := coalesce(old.org_id, new.org_id);
begin
  if not exists (select 1 from public.organisations o where o.id = v_org) then
    return null; -- suppression de l'organisation entière
  end if;
  if not exists (
    select 1 from public.membres m
    join public.droits_roles d on d.role_id = m.role_id and d.module = 'configuration' and d.niveau = 4
    where m.org_id = v_org and m.actif
  ) then
    raise exception 'Opération refusée : l''organisation doit garder au moins un administrateur actif';
  end if;
  return null;
end
$$;
create trigger admin_restant after update or delete on public.membres
  for each row execute function app.verifier_admin_restant();
create trigger admin_restant after update or delete on public.droits_roles
  for each row execute function app.verifier_admin_restant();

-- Documents : numérotation des versions, retour en brouillon, approbation signée.
create or replace function app.numeroter_version()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.documents d where d.id = new.document_id and d.org_id = new.org_id) then
    raise exception 'Le document n''appartient pas à cette organisation';
  end if;
  select coalesce(max(v.version), 0) + 1 into new.version
  from public.versions_documents v where v.document_id = new.document_id;
  return new;
end
$$;
create trigger numeroter before insert on public.versions_documents
  for each row execute function app.numeroter_version();

create or replace function app.version_ajoutee()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.documents set version_courante = new.version where id = new.document_id;
  return null;
end
$$;
create trigger version_ajoutee after insert on public.versions_documents
  for each row execute function app.version_ajoutee();

create or replace function app.controler_document()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- une nouvelle version d'un document approuvé repart en brouillon
  if tg_op = 'UPDATE' and new.version_courante <> old.version_courante and old.statut = 'approuve' then
    new.statut := 'brouillon';
  -- retirer une approbation ou déclarer périmé relève du niveau validation
  elsif tg_op = 'UPDATE' and new.statut is distinct from old.statut
        and (old.statut = 'approuve' or new.statut = 'perime' or old.statut = 'perime')
        and app.niveau(new.org_id, 'documents') < 3 then
    raise exception 'Droits insuffisants : retirer une approbation ou gérer la péremption demande le niveau validation';
  end if;
  if new.statut = 'approuve' and (tg_op = 'INSERT' or old.statut is distinct from 'approuve') then
    if not exists (
      select 1 from public.signatures s
      where s.objet_type = 'document' and s.objet_id = new.id
        and s.signification = 'approuve' and s.version_objet = new.version_courante
    ) then
      raise exception 'Approbation impossible : signature « approuvé » manquante pour la version %', new.version_courante;
    end if;
  end if;
  return new;
end
$$;
create trigger controler before insert or update on public.documents
  for each row execute function app.controler_document();

-- Un document signé ne se supprime pas : on le déclare périmé.
create or replace function app.proteger_document_signe()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.signatures s where s.objet_type = 'document' and s.objet_id = old.id) then
    raise exception 'Suppression impossible : ce document porte des signatures (déclarez-le périmé)';
  end if;
  return old;
end
$$;
create trigger proteger_signe before delete on public.documents
  for each row execute function app.proteger_document_signe();

-- Profil créé à l'inscription.
create or replace function app.creer_profil()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profils (id, email, nom_complet)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'nom_complet', ''))
  on conflict (id) do nothing;
  return new;
end
$$;
create trigger creer_profil after insert on auth.users
  for each row execute function app.creer_profil();

-- ---------------------------------------------------------------------
-- Fonctions appelables par l'application (RPC)
-- ---------------------------------------------------------------------

-- Crée une organisation, ses rôles système et rend l'appelant administrateur.
-- p_roles : [{cle, libelle, description, droits: {module: niveau}}] (matrice
-- par défaut fournie par l'application, src/domain/permissions.ts).
create or replace function public.creer_organisation(p_nom text, p_roles jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid;
  v_role jsonb;
  v_role_id uuid;
  v_admin uuid;
  v_module text;
  v_niveau text;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if not exists (
    select 1 from jsonb_array_elements(p_roles) r
    where r ->> 'cle' = 'admin' and (r -> 'droits' ->> 'configuration')::int = 4
  ) then
    raise exception 'La matrice doit contenir un rôle admin avec l''administration de la configuration';
  end if;

  insert into public.organisations (nom) values (p_nom) returning id into v_org;

  for v_role in select * from jsonb_array_elements(p_roles) loop
    insert into public.roles (org_id, cle, libelle, description, systeme)
    values (v_org, v_role ->> 'cle', v_role ->> 'libelle', coalesce(v_role ->> 'description', ''), true)
    returning id into v_role_id;
    if v_role ->> 'cle' = 'admin' then v_admin := v_role_id; end if;
    for v_module, v_niveau in select * from jsonb_each_text(v_role -> 'droits') loop
      insert into public.droits_roles (org_id, role_id, module, niveau)
      values (v_org, v_role_id, v_module, v_niveau::smallint);
    end loop;
  end loop;

  insert into public.membres (org_id, user_id, role_id) values (v_org, auth.uid(), v_admin);
  return v_org;
end
$$;

-- Rattache l'utilisateur connecté aux organisations qui l'ont invité.
create or replace function public.accepter_invitations()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_inv record;
  v_nb integer := 0;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  for v_inv in
    select * from public.invitations where lower(email) = v_email and acceptee_le is null
  loop
    insert into public.membres (org_id, user_id, role_id, sites)
    values (v_inv.org_id, auth.uid(), v_inv.role_id, v_inv.sites)
    on conflict (org_id, user_id) do nothing;
    update public.invitations set acceptee_le = now() where id = v_inv.id;
    if v_inv.nom_complet <> '' then
      update public.profils set nom_complet = v_inv.nom_complet where id = auth.uid() and nom_complet = '';
    end if;
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end
$$;

-- Signature électronique : l'application ré-authentifie l'utilisateur
-- (mot de passe) juste avant l'appel ; l'horodatage est celui du serveur.
create or replace function public.signer(
  p_objet_type text, p_objet_id uuid, p_signification text, p_commentaire text default ''
)
returns public.signatures
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid;
  v_version integer;
  v_nom text;
  v_requis smallint;
  v_signature public.signatures;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  if p_signification not in ('redige', 'verifie', 'approuve') then
    raise exception 'Signification inconnue : %', p_signification;
  end if;
  if p_objet_type = 'document' then
    select d.org_id, d.version_courante into v_org, v_version from public.documents d where d.id = p_objet_id;
    if v_org is null then raise exception 'Document introuvable'; end if;
    if v_version < 1 then raise exception 'Le document n''a aucune version à signer'; end if;
  else
    raise exception 'Type d''objet non signable : %', p_objet_type;
  end if;

  v_requis := case when p_signification = 'approuve' then 3 else 2 end;
  if app.niveau(v_org, 'documents') < v_requis then
    raise exception 'Droits insuffisants pour signer « % »', p_signification;
  end if;

  select coalesce(nullif(p.nom_complet, ''), p.email) into v_nom from public.profils p where p.id = auth.uid();

  insert into public.signatures (org_id, objet_type, objet_id, version_objet, signification, signataire, nom_signataire, commentaire)
  values (v_org, p_objet_type, p_objet_id, v_version, p_signification, auth.uid(), coalesce(v_nom, ''), coalesce(p_commentaire, ''))
  returning * into v_signature;
  return v_signature;
end
$$;

revoke all on function public.creer_organisation(text, jsonb), public.accepter_invitations(),
  public.signer(text, uuid, text, text) from public, anon;
grant execute on function public.creer_organisation(text, jsonb), public.accepter_invitations(),
  public.signer(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Politiques d'accès (RLS)
-- ---------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.profils enable row level security;
alter table public.roles enable row level security;
alter table public.droits_roles enable row level security;
alter table public.membres enable row level security;
alter table public.invitations enable row level security;
alter table public.referentiels_org enable row level security;
alter table public.gabarits_org enable row level security;
alter table public.entreprises enable row level security;
alter table public.sites enable row level security;
alter table public.salles_propres enable row level security;
alter table public.zones enable row level security;
alter table public.documents enable row level security;
alter table public.versions_documents enable row level security;
alter table public.signatures enable row level security;
alter table public.journal_audit enable row level security;

-- Organisations : création par la RPC uniquement, pas de suppression depuis l'application.
create policy lecture on public.organisations for select to authenticated using (app.est_membre(id));
create policy modification on public.organisations for update to authenticated
  using (app.niveau(id, 'configuration') >= 4) with check (app.niveau(id, 'configuration') >= 4);

-- Profils : le sien, et ceux des membres des mêmes organisations.
create policy lecture on public.profils for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.membres a join public.membres b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = profils.id
  )
);
create policy modification on public.profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Tables de configuration : lisibles par les membres (l'application calcule
-- les droits de l'utilisateur), modifiables par l'administration.
do $$
declare t text;
begin
  foreach t in array array['roles', 'droits_roles', 'membres', 'invitations'] loop
    execute format('create policy lecture on public.%I for select to authenticated using (app.est_membre(org_id))', t);
    execute format('create policy ajout on public.%I for insert to authenticated with check (app.niveau(org_id, ''configuration'') >= 4)', t);
    execute format('create policy modification on public.%I for update to authenticated using (app.niveau(org_id, ''configuration'') >= 4) with check (app.niveau(org_id, ''configuration'') >= 4)', t);
    execute format('create policy suppression on public.%I for delete to authenticated using (app.niveau(org_id, ''configuration'') >= 4)', t);
  end loop;
end
$$;

-- Référentiels : lisibles par les membres, modifiables en validation.
create policy lecture on public.referentiels_org for select to authenticated using (app.est_membre(org_id));
create policy ajout on public.referentiels_org for insert to authenticated with check (app.niveau(org_id, 'referentiels') >= 3);
create policy modification on public.referentiels_org for update to authenticated
  using (app.niveau(org_id, 'referentiels') >= 3) with check (app.niveau(org_id, 'referentiels') >= 3);
create policy suppression on public.referentiels_org for delete to authenticated using (app.niveau(org_id, 'referentiels') >= 3);

-- Gabarits d'entreprise : lisibles par les membres (assistant de création).
create policy lecture on public.gabarits_org for select to authenticated using (app.est_membre(org_id));
create policy ajout on public.gabarits_org for insert to authenticated with check (app.niveau(org_id, 'gabarits') >= 2);
create policy modification on public.gabarits_org for update to authenticated
  using (app.niveau(org_id, 'gabarits') >= 2) with check (app.niveau(org_id, 'gabarits') >= 2);
create policy suppression on public.gabarits_org for delete to authenticated using (app.niveau(org_id, 'gabarits') >= 3);

-- Entreprises.
create policy lecture on public.entreprises for select to authenticated using (app.niveau(org_id, 'installations') >= 1);
create policy ajout on public.entreprises for insert to authenticated with check (app.niveau(org_id, 'installations') >= 2);
create policy modification on public.entreprises for update to authenticated
  using (app.niveau(org_id, 'installations') >= 2) with check (app.niveau(org_id, 'installations') >= 2);
create policy suppression on public.entreprises for delete to authenticated using (app.niveau(org_id, 'installations') >= 3);

-- Sites, salles et zones : en plus du niveau, restriction éventuelle aux sites du membre.
create policy lecture on public.sites for select to authenticated
  using (app.niveau(org_id, 'installations') >= 1 and app.acces_site(org_id, id));
create policy ajout on public.sites for insert to authenticated
  with check (app.niveau(org_id, 'installations') >= 2 and app.acces_site(org_id, id));
create policy modification on public.sites for update to authenticated
  using (app.niveau(org_id, 'installations') >= 2 and app.acces_site(org_id, id))
  with check (app.niveau(org_id, 'installations') >= 2 and app.acces_site(org_id, id));
create policy suppression on public.sites for delete to authenticated
  using (app.niveau(org_id, 'installations') >= 3 and app.acces_site(org_id, id));

do $$
declare t text;
begin
  foreach t in array array['salles_propres', 'zones'] loop
    execute format('create policy lecture on public.%I for select to authenticated using (app.niveau(org_id, ''installations'') >= 1 and app.acces_site(org_id, site_id))', t);
    execute format('create policy ajout on public.%I for insert to authenticated with check (app.niveau(org_id, ''installations'') >= 2)', t);
    execute format('create policy modification on public.%I for update to authenticated using (app.niveau(org_id, ''installations'') >= 2 and app.acces_site(org_id, site_id)) with check (app.niveau(org_id, ''installations'') >= 2 and app.acces_site(org_id, site_id))', t);
    execute format('create policy suppression on public.%I for delete to authenticated using (app.niveau(org_id, ''installations'') >= 3 and app.acces_site(org_id, site_id))', t);
  end loop;
end
$$;
-- Ajout d'une salle : vérifie l'accès au site visé (la zone hérite du site de sa salle par déclencheur).
drop policy ajout on public.salles_propres;
create policy ajout on public.salles_propres for insert to authenticated
  with check (app.niveau(org_id, 'installations') >= 2 and app.acces_site(org_id, site_id));
drop policy ajout on public.zones;
create policy ajout on public.zones for insert to authenticated with check (
  app.niveau(org_id, 'installations') >= 2
  and exists (select 1 from public.salles_propres s where s.id = salle_id and app.acces_site(s.org_id, s.site_id))
);

-- Documents et versions (les versions sont immuables).
create policy lecture on public.documents for select to authenticated using (app.niveau(org_id, 'documents') >= 1);
create policy ajout on public.documents for insert to authenticated with check (app.niveau(org_id, 'documents') >= 2);
create policy modification on public.documents for update to authenticated
  using (app.niveau(org_id, 'documents') >= 2) with check (app.niveau(org_id, 'documents') >= 2);
create policy suppression on public.documents for delete to authenticated using (app.niveau(org_id, 'documents') >= 3);

create policy lecture on public.versions_documents for select to authenticated using (app.niveau(org_id, 'documents') >= 1);
create policy ajout on public.versions_documents for insert to authenticated with check (app.niveau(org_id, 'documents') >= 2);

-- Signatures : lecture par les membres, écriture par la RPC signer() uniquement.
create policy lecture on public.signatures for select to authenticated using (app.est_membre(org_id));

-- Journal : lecture selon le droit « audit », écriture par déclencheur uniquement.
create policy lecture on public.journal_audit for select to authenticated using (app.niveau(org_id, 'audit') >= 1);

revoke insert, update, delete, truncate on public.journal_audit, public.signatures from authenticated, anon;
revoke truncate on all tables in schema public from authenticated, anon;
