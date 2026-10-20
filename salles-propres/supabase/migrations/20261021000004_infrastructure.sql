-- =====================================================================
-- Infrastructure générique pour les modules des phases 2 à 7.
-- Chaque nouvelle table appelle app.tracer() (horodatage, journal, RLS)
-- puis app.politiques() (droits selon le module et la portée).
-- =====================================================================

-- Horodatage + journal d'audit + activation RLS.
create or replace function app.tracer(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('create trigger horodater before update on public.%I for each row execute function app.horodater()', p_table);
  execute format('create trigger journaliser after insert or update or delete on public.%I for each row execute function app.journaliser()', p_table);
  execute format('alter table public.%I enable row level security', p_table);
end
$$;

-- Politiques standard.
--   portee 'org'    : niveau du module dans l'organisation
--   portee 'site'   : niveau du module + accès au site de l'enregistrement (colonne site_id)
--   portee 'membre' : lecture par tout membre, écriture selon le module
create or replace function app.politiques(
  p_table text, p_module text, p_portee text default 'org', p_ecriture int default 2, p_suppression int default 3
)
returns void
language plpgsql
as $$
declare
  v_lecture text;
  v_site text := '';
begin
  if p_portee = 'site' then v_site := ' and app.acces_site(org_id, site_id)'; end if;
  v_lecture := case p_portee
    when 'membre' then 'app.est_membre(org_id)'
    else format('app.niveau(org_id, %L) >= 1', p_module) || v_site
  end;
  execute format('create policy lecture on public.%I for select to authenticated using (%s)', p_table, v_lecture);
  execute format('create policy ajout on public.%I for insert to authenticated with check (app.niveau(org_id, %L) >= %s%s)', p_table, p_module, p_ecriture, v_site);
  execute format('create policy modification on public.%I for update to authenticated using (app.niveau(org_id, %L) >= %s%s) with check (app.niveau(org_id, %L) >= %s%s)',
    p_table, p_module, p_ecriture, v_site, p_module, p_ecriture, v_site);
  execute format('create policy suppression on public.%I for delete to authenticated using (app.niveau(org_id, %L) >= %s%s)', p_table, p_module, p_suppression, v_site);
end
$$;

-- Déduit site_id du parent (arguments : colonne de rattachement, table parente).
create or replace function app.deduire_site()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_parent uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_site uuid;
  v_org uuid;
begin
  if v_parent is null then
    raise exception 'Rattachement obligatoire : %', tg_argv[0];
  end if;
  execute format('select site_id, org_id from public.%I where id = $1', tg_argv[1]) into v_site, v_org using v_parent;
  if v_org is distinct from new.org_id then
    raise exception 'Rattachement invalide : % n''appartient pas à cette organisation', tg_argv[1];
  end if;
  new := jsonb_populate_record(new, jsonb_build_object('site_id', v_site));
  return new;
end
$$;

-- Vérifie qu'une référence facultative pointe dans la même organisation (arguments : colonne, table).
create or replace function app.verifier_parent()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_parent uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_ok boolean;
begin
  if v_parent is null then return new; end if;
  execute format('select exists (select 1 from public.%I where id = $1 and org_id = $2)', tg_argv[1]) into v_ok using v_parent, new.org_id;
  if not v_ok then
    raise exception 'Rattachement invalide : % n''appartient pas à cette organisation', tg_argv[1];
  end if;
  return new;
end
$$;

-- Numérotation lisible PREFIXE-AAAA-NNN dans la colonne numero (argument : préfixe).
create or replace function app.numeroter()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_annee text := to_char(now(), 'YYYY');
  v_n integer;
begin
  if coalesce(to_jsonb(new) ->> 'numero', '') <> '' then return new; end if;
  execute format('select count(*) from public.%I where org_id = $1 and numero like $2', tg_table_name)
    into v_n using new.org_id, tg_argv[0] || '-' || v_annee || '-%';
  new := jsonb_populate_record(new, jsonb_build_object('numero', tg_argv[0] || '-' || v_annee || '-' || lpad((v_n + 1)::text, 3, '0')));
  return new;
end
$$;

-- Une salle propre ne change pas de site (ses objets rattachés héritent de ce site).
create or replace function app.coherence_salle()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.sites s where s.id = new.site_id and s.org_id = new.org_id) then
    raise exception 'Le site n''appartient pas à cette organisation';
  end if;
  if tg_op = 'UPDATE' and new.site_id is distinct from old.site_id then
    raise exception 'Une salle propre ne peut pas changer de site';
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Signatures génériques
-- ---------------------------------------------------------------------

alter table public.signatures add column portee text not null default '';

create table app.objets_signables (
  objet_type text primary key,
  table_nom text not null,
  colonne_version text,
  module text not null
);
insert into app.objets_signables values ('document', 'documents', 'version_courante', 'documents');

drop function public.signer(text, uuid, text, text);

-- p_portee distingue plusieurs circuits sur un même objet (ex. protocole / rapport).
create or replace function public.signer(
  p_objet_type text, p_objet_id uuid, p_signification text, p_commentaire text default '', p_portee text default ''
)
returns public.signatures
language plpgsql security definer set search_path = public
as $$
declare
  v_def app.objets_signables;
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
  select * into v_def from app.objets_signables where objet_type = p_objet_type;
  if v_def is null then raise exception 'Type d''objet non signable : %', p_objet_type; end if;

  execute format('select org_id, %s from public.%I where id = $1',
    coalesce(quote_ident(v_def.colonne_version), '1'), v_def.table_nom)
    into v_org, v_version using p_objet_id;
  if v_org is null then raise exception 'Objet introuvable'; end if;
  if v_version < 1 then raise exception 'L''objet n''a aucune version à signer'; end if;

  v_requis := case when p_signification = 'approuve' then 3 else 2 end;
  if app.niveau(v_org, v_def.module) < v_requis then
    raise exception 'Droits insuffisants pour signer « % »', p_signification;
  end if;

  select coalesce(nullif(p.nom_complet, ''), p.email) into v_nom from public.profils p where p.id = auth.uid();

  insert into public.signatures (org_id, objet_type, objet_id, version_objet, signification, signataire, nom_signataire, commentaire, portee)
  values (v_org, p_objet_type, p_objet_id, v_version, p_signification, auth.uid(), coalesce(v_nom, ''), coalesce(p_commentaire, ''), coalesce(p_portee, ''))
  returning * into v_signature;
  return v_signature;
end
$$;
revoke all on function public.signer(text, uuid, text, text, text) from public, anon;
grant execute on function public.signer(text, uuid, text, text, text) to authenticated;

-- Exige une signature pour atteindre un statut.
-- Arguments : objet_type, statut cible, signification, portée, colonne de version ('' = 1).
create or replace function app.exiger_signature()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_version integer := 1;
begin
  if (to_jsonb(new) ->> 'statut') = tg_argv[1]
     and (tg_op = 'INSERT' or (to_jsonb(old) ->> 'statut') is distinct from tg_argv[1]) then
    if tg_argv[4] <> '' then v_version := (to_jsonb(new) ->> tg_argv[4])::integer; end if;
    if not exists (
      select 1 from public.signatures s
      where s.objet_type = tg_argv[0] and s.objet_id = new.id and s.signification = tg_argv[2]
        and s.portee = tg_argv[3] and s.version_objet = v_version
    ) then
      raise exception 'Signature « % » requise pour passer au statut « % »', tg_argv[2], tg_argv[1];
    end if;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Notifications internes (créées par déclencheurs, lues par leur destinataire)
-- ---------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  destinataire uuid not null references public.profils (id) on delete cascade,
  type text not null,
  texte text not null,
  lien text not null default '',
  lue boolean not null default false,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid(),
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);
create index on public.notifications (destinataire, lue);
create trigger horodater before update on public.notifications for each row execute function app.horodater();
alter table public.notifications enable row level security;
create policy lecture on public.notifications for select to authenticated using (destinataire = auth.uid());
create policy modification on public.notifications for update to authenticated
  using (destinataire = auth.uid()) with check (destinataire = auth.uid());
create policy suppression on public.notifications for delete to authenticated using (destinataire = auth.uid());

create or replace function app.notifier(p_org uuid, p_destinataire uuid, p_type text, p_texte text, p_lien text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_destinataire is null or p_destinataire = auth.uid() then return; end if;
  if not exists (select 1 from public.membres m where m.org_id = p_org and m.user_id = p_destinataire and m.actif) then return; end if;
  insert into public.notifications (org_id, destinataire, type, texte, lien) values (p_org, p_destinataire, p_type, p_texte, p_lien);
end
$$;
