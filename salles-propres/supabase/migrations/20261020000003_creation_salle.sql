-- Création d'une salle propre et de ses zones en une seule transaction.
-- security invoker : les politiques RLS de l'appelant s'appliquent.

create or replace function public.creer_salle_propre(p_salle jsonb, p_zones jsonb)
returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid;
  v_org uuid := (p_salle ->> 'org_id')::uuid;
begin
  insert into public.salles_propres (org_id, site_id, nom, batiment, etage, secteur, gabarit_cle, gabarit_version, description)
  select v_org, s.site_id, s.nom, coalesce(s.batiment, ''), coalesce(s.etage, ''), s.secteur,
         s.gabarit_cle, s.gabarit_version, coalesce(s.description, '')
  from jsonb_populate_record(null::public.salles_propres, p_salle) s
  returning id into v_id;

  insert into public.zones (org_id, salle_id, code, nom, type_zone, iso_repos, iso_activite, grade_bpf, zone_risque,
    surface_m2, hauteur_m, pression_pa, tolerance_pression_pa, renouvellement_vol_h, temperature_min, temperature_max,
    hr_min, hr_max, gabarit_ref, notes)
  select v_org, v_id, coalesce(z.code, ''), z.nom, coalesce(z.type_zone, 'salle'), z.iso_repos, z.iso_activite, z.grade_bpf,
         z.zone_risque, z.surface_m2, z.hauteur_m, z.pression_pa, z.tolerance_pression_pa, z.renouvellement_vol_h,
         z.temperature_min, z.temperature_max, z.hr_min, z.hr_max, z.gabarit_ref, coalesce(z.notes, '')
  from jsonb_populate_recordset(null::public.zones, coalesce(p_zones, '[]'::jsonb)) z;

  return v_id;
end
$$;

revoke all on function public.creer_salle_propre(jsonb, jsonb) from public, anon;
grant execute on function public.creer_salle_propre(jsonb, jsonb) to authenticated;
