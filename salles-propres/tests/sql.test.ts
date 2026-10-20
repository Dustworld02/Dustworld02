/**
 * Tests du schéma Supabase sur un PostgreSQL embarqué (PGlite).
 * Le schéma « auth » et le stockage de Supabase sont simulés au minimum :
 * auth.uid() lit l'identifiant de l'utilisateur courant comme le fait Supabase.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { ROLES_SYSTEME, matriceParDefaut, MODULES } from "../src/domain/permissions";
import { META } from "../src/data/schema";
import type { NomTable } from "../src/data/types";

const db = new PGlite();
const ids = {
  a: "00000000-0000-0000-0000-00000000000a",
  b: "00000000-0000-0000-0000-00000000000b",
  c: "00000000-0000-0000-0000-00000000000c",
  d: "00000000-0000-0000-0000-00000000000d",
};

const SIMULATION_SUPABASE = `
  create role authenticated nologin;
  create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema auth, storage, public to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant select, insert on storage.objects to authenticated;
  alter default privileges in schema public grant all on tables to authenticated, anon;
  alter default privileges in schema public grant all on sequences to authenticated, anon;
`;

function rolesMatrice() {
  const m = matriceParDefaut();
  return ROLES_SYSTEME.map((r) => ({ ...r, droits: m[r.cle] }));
}

async function comme<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function un<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}

async function nb(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query(sql, params);
  return r.rows.length;
}

let orgA = "";
let entrepriseA = "";
let site1 = "";
let site2 = "";
let salle1 = "";
let salle2 = "";

beforeAll(async () => {
  await db.exec(SIMULATION_SUPABASE);
  const dossier = fileURLToPath(new URL("../supabase/migrations", import.meta.url));
  for (const fichier of readdirSync(dossier).sort()) {
    await db.exec(readFileSync(join(dossier, fichier), "utf8"));
  }
  for (const [cle, id] of Object.entries(ids)) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id, `${cle}@exemple.fr`, JSON.stringify({ nom_complet: `Utilisateur ${cle.toUpperCase()}` }),
    ]);
  }
});

describe("Organisation et droits", () => {
  it("crée le profil à l'inscription", async () => {
    const p = await un<{ nom_complet: string }>(`select nom_complet from profils where id = $1`, [ids.a]);
    expect(p.nom_complet).toBe("Utilisateur A");
  });

  it("crée une organisation avec ses rôles et rend le créateur administrateur", async () => {
    orgA = await comme(ids.a, async () =>
      (await un<{ id: string }>(`select creer_organisation('Org A', $1::jsonb) as id`, [JSON.stringify(rolesMatrice())])).id,
    );
    expect(orgA).toMatch(/[0-9a-f-]{36}/);
    await comme(ids.a, async () => {
      expect(await nb(`select * from organisations`)).toBe(1);
      expect(await nb(`select * from roles where org_id = $1`, [orgA])).toBe(ROLES_SYSTEME.length);
      expect(await nb(`select * from droits_roles where org_id = $1`, [orgA])).toBe(ROLES_SYSTEME.length * MODULES.length);
      const n = await un<{ n: number }>(`select app.niveau($1, 'configuration') as n`, [orgA]);
      expect(n.n).toBe(4);
    });
  });

  it("refuse une matrice sans administrateur", async () => {
    const sansAdmin = rolesMatrice().filter((r) => r.cle !== "admin");
    await expect(
      comme(ids.d, () => db.query(`select creer_organisation('X', $1::jsonb)`, [JSON.stringify(sansAdmin)])),
    ).rejects.toThrow(/rôle admin/);
  });

  it("enregistre entreprise, sites, salles et zones ; la zone hérite du site", async () => {
    await comme(ids.a, async () => {
      entrepriseA = (await un<{ id: string }>(`insert into entreprises (org_id, nom, secteur) values ($1, 'MedTech', 'dispositifs_medicaux') returning id`, [orgA])).id;
      site1 = (await un<{ id: string }>(`insert into sites (org_id, entreprise_id, nom) values ($1, $2, 'Site 1') returning id`, [orgA, entrepriseA])).id;
      site2 = (await un<{ id: string }>(`insert into sites (org_id, entreprise_id, nom) values ($1, $2, 'Site 2') returning id`, [orgA, entrepriseA])).id;
      salle1 = (await un<{ id: string }>(`insert into salles_propres (org_id, site_id, nom, secteur, gabarit_cle, gabarit_version) values ($1, $2, 'Salle 1', 'dispositifs_medicaux', 'dispositifs_medicaux', '1.0.0') returning id`, [orgA, site1])).id;
      salle2 = (await un<{ id: string }>(`insert into salles_propres (org_id, site_id, nom, secteur) values ($1, $2, 'Salle 2', 'dispositifs_medicaux') returning id`, [orgA, site2])).id;
      const z = await un<{ site_id: string }>(`insert into zones (org_id, salle_id, code, nom, iso_repos, iso_activite) values ($1, $2, 'Z01', 'Production', 7, 7) returning site_id`, [orgA, salle1]);
      expect(z.site_id).toBe(site1);
      await db.query(`insert into zones (org_id, salle_id, code, nom, iso_repos) values ($1, $2, 'Z01', 'SAS', 8)`, [orgA, salle2]);
    });
  });

  it("journalise chaque écriture avec son auteur", async () => {
    await comme(ids.a, async () => {
      await db.query(`update zones set pression_pa = 30 where salle_id = $1`, [salle1]);
      const j = await un<{ auteur: string; anciennes: { pression_pa: null }; nouvelles: { pression_pa: number } }>(
        `select * from journal_audit where table_nom = 'zones' and action = 'update' order by id desc limit 1`,
      );
      expect(j.auteur).toBe(ids.a);
      expect(j.anciennes.pression_pa).toBeNull();
      expect(Number(j.nouvelles.pression_pa)).toBe(30);
    });
  });

  it("rend le journal d'audit inviolable, même pour l'administrateur de la base", async () => {
    await expect(comme(ids.a, () => db.query(`update journal_audit set auteur = null`))).rejects.toThrow();
    await expect(db.query(`delete from journal_audit`)).rejects.toThrow(/ajout seul/);
  });

  it("isole un utilisateur sans adhésion", async () => {
    await comme(ids.b, async () => {
      expect(await nb(`select * from entreprises`)).toBe(0);
      expect(await nb(`select * from journal_audit`)).toBe(0);
      await expect(db.query(`insert into entreprises (org_id, nom) values ($1, 'Intrus')`, [orgA])).rejects.toThrow(/row-level security/);
    });
  });

  it("applique le rôle reçu par invitation (opérateur : lecture seule des installations)", async () => {
    await comme(ids.a, async () => {
      const role = await un<{ id: string }>(`select id from roles where org_id = $1 and cle = 'operateur'`, [orgA]);
      await db.query(`insert into invitations (org_id, email, role_id) values ($1, 'B@exemple.fr', $2)`, [orgA, role.id]);
    });
    await comme(ids.b, async () => {
      expect((await un<{ n: number }>(`select accepter_invitations() as n`)).n).toBe(1);
      expect(await nb(`select * from zones`)).toBe(2);
      await expect(db.query(`insert into zones (org_id, salle_id, nom) values ($1, $2, 'X')`, [orgA, salle1])).rejects.toThrow(/row-level security/);
      expect(await nb(`select * from journal_audit`)).toBe(0);
      const p = await nb(`select * from profils`);
      expect(p).toBeGreaterThanOrEqual(2);
    });
  });

  it("restreint un membre à ses sites", async () => {
    await comme(ids.a, async () => {
      const role = await un<{ id: string }>(`select id from roles where org_id = $1 and cle = 'technique'`, [orgA]);
      await db.query(`insert into invitations (org_id, email, role_id, sites) values ($1, 'c@exemple.fr', $2, $3)`, [orgA, role.id, [site2]]);
    });
    await comme(ids.c, async () => {
      await db.query(`select accepter_invitations()`);
      expect((await db.query<{ nom: string }>(`select nom from sites`)).rows.map((r) => r.nom)).toEqual(["Site 2"]);
      expect(await nb(`select * from salles_propres`)).toBe(1);
      expect(await nb(`select * from zones`)).toBe(1);
      await expect(db.query(`insert into salles_propres (org_id, site_id, nom, secteur) values ($1, $2, 'Hors périmètre', 'x')`, [orgA, site1])).rejects.toThrow(/row-level security/);
      await expect(db.query(`insert into zones (org_id, salle_id, nom) values ($1, $2, 'Hors périmètre')`, [orgA, salle1])).rejects.toThrow(/row-level security/);
      await db.query(`insert into zones (org_id, salle_id, nom) values ($1, $2, 'Autorisée')`, [orgA, salle2]);
    });
  });

  it("garde toujours un administrateur", async () => {
    await comme(ids.a, async () => {
      const lecteur = await un<{ id: string }>(`select id from roles where org_id = $1 and cle = 'lecteur'`, [orgA]);
      await expect(db.query(`update membres set role_id = $1 where user_id = $2`, [lecteur.id, ids.a])).rejects.toThrow(/administrateur/);
      await expect(db.query(`update droits_roles d set niveau = 1 from roles r where r.id = d.role_id and r.cle = 'admin' and d.module = 'configuration'`)).rejects.toThrow(/administrateur/);
    });
  });

  it("empêche les rattachements entre organisations et les changements d'organisation", async () => {
    const orgD = await comme(ids.d, async () =>
      (await un<{ id: string }>(`select creer_organisation('Org D', $1::jsonb) as id`, [JSON.stringify(rolesMatrice())])).id,
    );
    await comme(ids.d, async () => {
      await expect(db.query(`insert into zones (org_id, salle_id, nom) values ($1, $2, 'Pirate')`, [orgD, salle1])).rejects.toThrow(/n'appartient pas/);
      await expect(db.query(`insert into sites (org_id, entreprise_id, nom) values ($1, $2, 'Pirate')`, [orgD, entrepriseA])).rejects.toThrow(/n'appartient pas/);
      expect(await nb(`select * from entreprises`)).toBe(0);
    });
    await comme(ids.a, async () => {
      await expect(db.query(`update entreprises set org_id = $1 where id = $2`, [orgD, entrepriseA])).rejects.toThrow();
    });
  });
});

describe("Création d'une salle par l'assistant", () => {
  it("crée la salle et ses zones en une transaction", async () => {
    await comme(ids.a, async () => {
      const salle = { org_id: orgA, site_id: site1, nom: "Salle DM", secteur: "dispositifs_medicaux", gabarit_cle: "dispositifs_medicaux", gabarit_version: "1.0.0" };
      const zones = [
        { code: "Z01", nom: "SAS", type_zone: "sas_personnel", iso_repos: 8, iso_activite: 8, gabarit_ref: { gabarit: "dispositifs_medicaux", version: "1.0.0", type_zone_gabarit: "sas_personnel" } },
        { code: "Z02", nom: "Production", type_zone: "salle", iso_repos: 7, iso_activite: 7, pression_pa: 30 },
      ];
      const { id } = await un<{ id: string }>(`select creer_salle_propre($1::jsonb, $2::jsonb) as id`, [JSON.stringify(salle), JSON.stringify(zones)]);
      const lignes = (await db.query<{ nom: string; site_id: string; gabarit_ref: unknown }>(`select nom, site_id, gabarit_ref from zones where salle_id = $1 order by code`, [id])).rows;
      expect(lignes.map((z) => z.nom)).toEqual(["SAS", "Production"]);
      expect(lignes[0].site_id).toBe(site1);
      expect(lignes[0].gabarit_ref).toMatchObject({ gabarit: "dispositifs_medicaux" });
    });
  });

  it("n'enregistre rien si une zone est invalide", async () => {
    await comme(ids.a, async () => {
      const avant = await nb(`select * from salles_propres`);
      const salle = { org_id: orgA, site_id: site1, nom: "Salle KO", secteur: "x" };
      await expect(db.query(`select creer_salle_propre($1::jsonb, $2::jsonb)`, [JSON.stringify(salle), JSON.stringify([{ nom: "Zone", iso_repos: 12 }])])).rejects.toThrow();
      expect(await nb(`select * from salles_propres`)).toBe(avant);
    });
  });

  it("applique les droits de l'appelant", async () => {
    const salle = { org_id: orgA, site_id: site1, nom: "Salle opérateur", secteur: "x" };
    await expect(comme(ids.b, () => db.query(`select creer_salle_propre($1::jsonb, '[]'::jsonb)`, [JSON.stringify(salle)]))).rejects.toThrow(/row-level security/);
  });
});

describe("Documents et signatures", () => {
  let doc = "";

  it("numérote les versions", async () => {
    await comme(ids.a, async () => {
      doc = (await un<{ id: string }>(`insert into documents (org_id, titre, type_document, objet_type, objet_id) values ($1, 'Protocole QI', 'protocole', 'salle_propre', $2) returning id`, [orgA, salle1])).id;
      const v = await un<{ version: number }>(`insert into versions_documents (org_id, document_id, chemin_stockage, nom_fichier) values ($1, $2, 'x', 'p.pdf') returning version`, [orgA, doc]);
      expect(v.version).toBe(1);
      expect((await un<{ version_courante: number }>(`select version_courante from documents where id = $1`, [doc])).version_courante).toBe(1);
    });
  });

  it("refuse l'approbation sans signature", async () => {
    await expect(comme(ids.a, () => db.query(`update documents set statut = 'approuve' where id = $1`, [doc]))).rejects.toThrow(/signature/);
  });

  it("refuse la signature d'approbation sans le niveau validation", async () => {
    await expect(comme(ids.b, () => db.query(`select signer('document', $1, 'approuve')`, [doc]))).rejects.toThrow(/Droits insuffisants/);
    await expect(comme(ids.b, () => db.query(`insert into signatures (org_id, objet_type, objet_id, version_objet, signification, signataire, nom_signataire) values ($1, 'document', $2, 1, 'approuve', $3, 'faux')`, [orgA, doc, ids.b]))).rejects.toThrow();
  });

  it("approuve après signature, puis repasse en brouillon à la version suivante", async () => {
    await comme(ids.a, async () => {
      const s = await un<{ nom_signataire: string; version_objet: number }>(`select * from signer('document', $1, 'approuve', 'RAS')`, [doc]);
      expect(s).toMatchObject({ nom_signataire: "Utilisateur A", version_objet: 1 });
      await db.query(`update documents set statut = 'approuve' where id = $1`, [doc]);
      await db.query(`insert into versions_documents (org_id, document_id, chemin_stockage, nom_fichier) values ($1, $2, 'y', 'p2.pdf')`, [orgA, doc]);
      const d = await un<{ statut: string; version_courante: number }>(`select statut, version_courante from documents where id = $1`, [doc]);
      expect(d).toEqual({ statut: "brouillon", version_courante: 2 });
      await expect(db.query(`update documents set statut = 'approuve' where id = $1`, [doc])).rejects.toThrow(/version 2/);
    });
  });

  it("réserve le retrait d'approbation et la péremption au niveau validation", async () => {
    const documentAutre = await comme(ids.a, async () => {
      const d = (await un<{ id: string }>(`insert into documents (org_id, titre, type_document) values ($1, 'Procédure', 'procedure') returning id`, [orgA])).id;
      await db.query(`insert into versions_documents (org_id, document_id, chemin_stockage, nom_fichier) values ($1, $2, 'z', 'p.pdf')`, [orgA, d]);
      await db.query(`select signer('document', $1, 'approuve')`, [d]);
      await db.query(`update documents set statut = 'approuve' where id = $1`, [d]);
      const technique = await un<{ id: string }>(`select id from roles where org_id = $1 and cle = 'technique'`, [orgA]);
      await db.query(`update membres set role_id = $1, sites = null where user_id = $2`, [technique.id, ids.c]);
      return d;
    });
    await comme(ids.c, async () => {
      await expect(db.query(`update documents set statut = 'brouillon' where id = $1`, [documentAutre])).rejects.toThrow(/niveau validation/);
      await expect(db.query(`update documents set statut = 'perime' where id = $1`, [documentAutre])).rejects.toThrow(/niveau validation/);
    });
    await comme(ids.a, () => db.query(`update documents set statut = 'perime' where id = $1`, [documentAutre]));
  });

  it("interdit de supprimer un document signé", async () => {
    await expect(comme(ids.a, () => db.query(`delete from documents where id = $1`, [doc]))).rejects.toThrow(/signatures/);
  });

  it("rend les signatures inviolables", async () => {
    await expect(db.query(`update signatures set nom_signataire = 'autre'`)).rejects.toThrow(/ajout seul/);
  });

  it("cloisonne le stockage des fichiers par organisation", async () => {
    await comme(ids.a, async () => {
      await db.query(`insert into storage.objects (bucket_id, name) values ('documents', $1)`, [`${orgA}/${doc}/f.pdf`]);
    });
    await comme(ids.d, async () => {
      expect(await nb(`select * from storage.objects`)).toBe(0);
      await expect(db.query(`insert into storage.objects (bucket_id, name) values ('documents', $1)`, [`${orgA}/${doc}/g.pdf`])).rejects.toThrow(/row-level security/);
    });
  });
});

describe("Registre des tables ⇄ schéma SQL", () => {
  const tables = Object.keys(META) as NomTable[];

  it("chaque table existe avec la sécurité au niveau des lignes activée", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`);
    for (const t of tables) {
      const ligne = r.rows.find((x) => x.relname === t);
      expect(ligne, t).toBeDefined();
      expect(ligne!.relrowsecurity, t).toBe(true);
    }
  });

  it("les rattachements ont le même comportement à la suppression", async () => {
    const r = await db.query<{ table_nom: string; colonne: string; parent: string; regle: string }>(`
      select c.conrelid::regclass::text as table_nom, a.attname as colonne, c.confrelid::regclass::text as parent, c.confdeltype as regle
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace`);
    const attendu = { cascade: "c", restreint: ["a", "r"], null: "n" } as const;
    for (const t of tables) {
      for (const rat of META[t].rattachements ?? []) {
        const fk = r.rows.find((x) => x.table_nom === t && x.colonne === rat.colonne);
        expect(fk, `${t}.${rat.colonne}`).toBeDefined();
        expect(fk!.parent, `${t}.${rat.colonne}`).toBe(rat.table);
        const regle = attendu[rat.suppression];
        if (Array.isArray(regle)) expect(regle, `${t}.${rat.colonne}`).toContain(fk!.regle);
        else expect(fk!.regle, `${t}.${rat.colonne}`).toBe(regle);
      }
    }
  });

  it("les colonnes par défaut du registre ont un défaut en base", async () => {
    const r = await db.query<{ table_name: string; column_name: string; column_default: string | null; is_nullable: string }>(
      `select table_name, column_name, column_default, is_nullable from information_schema.columns where table_schema = 'public'`);
    for (const t of tables) {
      for (const cle of Object.keys(META[t].defauts ?? {})) {
        const col = r.rows.find((x) => x.table_name === t && x.column_name === cle);
        expect(col, `${t}.${cle}`).toBeDefined();
        const valeur = META[t].defauts![cle];
        if (valeur === null) expect(col!.is_nullable, `${t}.${cle}`).toBe("YES");
        else expect(col!.column_default, `${t}.${cle}`).not.toBeNull();
      }
    }
  });

  it("les politiques de lecture utilisent le module du registre", async () => {
    const r = await db.query<{ tablename: string; qual: string }>(`select tablename, qual from pg_policies where schemaname = 'public' and policyname = 'lecture'`);
    for (const t of tables) {
      const p = r.rows.find((x) => x.tablename === t);
      expect(p, t).toBeDefined();
      const meta = META[t];
      if (meta.portee === "membre") expect(p!.qual, t).toContain("est_membre");
      else if (meta.portee === "personnel") expect(p!.qual, t).toContain("destinataire");
      else expect(p!.qual, t).toContain(`'${meta.module}'`);
      if (meta.portee === "site" || meta.portee === "soi") expect(p!.qual, t).toContain("acces_site");
    }
  });
});

describe("Modélisation (phase 2)", () => {
  let zoneProd = "";
  let zoneSas = "";
  let cta = "";

  it("déduit le site des éléments du plan et contrôle les rattachements", async () => {
    await comme(ids.a, async () => {
      zoneProd = (await un<{ id: string }>(`insert into zones (org_id, salle_id, nom, pression_pa) values ($1, $2, 'Prod', 30) returning id`, [orgA, salle1])).id;
      zoneSas = (await un<{ id: string }>(`insert into zones (org_id, salle_id, nom, pression_pa) values ($1, $2, 'SAS', 15) returning id`, [orgA, salle1])).id;
      const p = await un<{ site_id: string }>(`insert into portes (org_id, salle_id, zone_a, zone_b, x, y) values ($1, $2, $3, $4, 1, 1) returning site_id`, [orgA, salle1, zoneProd, zoneSas]);
      expect(p.site_id).toBe(site1);
      cta = (await un<{ id: string }>(`insert into ctas (org_id, site_id, nom) values ($1, $2, 'CTA test') returning id`, [orgA, site1])).id;
      const b = await un<{ id: string; site_id: string }>(`insert into bouches (org_id, salle_id, zone_id, cta_id, type, debit_m3h) values ($1, $2, $3, $4, 'soufflage', 1000) returning id, site_id`, [orgA, salle1, zoneProd, cta]);
      expect(b.site_id).toBe(site1);
      const f = await un<{ site_id: string }>(`insert into filtres (org_id, bouche_id, emplacement, classe) values ($1, $2, 'terminal', 'H14') returning site_id`, [orgA, b.id]);
      expect(f.site_id).toBe(site1);
      await expect(db.query(`insert into filtres (org_id, classe) values ($1, 'F9')`, [orgA])).rejects.toThrow();
    });
  });

  it("refuse une zone d'une autre salle d'une autre organisation dans une porte", async () => {
    const orgD = await comme(ids.d, async () => (await un<{ id: string }>(`select id from organisations`)).id);
    await comme(ids.d, async () => {
      const e = (await un<{ id: string }>(`insert into entreprises (org_id, nom) values ($1, 'D') returning id`, [orgD])).id;
      const site = (await un<{ id: string }>(`insert into sites (org_id, entreprise_id, nom) values ($1, $2, 'S') returning id`, [orgD, e])).id;
      const salle = (await un<{ id: string }>(`insert into salles_propres (org_id, site_id, nom, secteur) values ($1, $2, 'S', 'x') returning id`, [orgD, site])).id;
      await expect(db.query(`insert into portes (org_id, salle_id, zone_a) values ($1, $2, $3)`, [orgD, salle, zoneProd])).rejects.toThrow(/n'appartient pas/);
      await expect(db.query(`insert into bouches (org_id, salle_id, cta_id) values ($1, $2, $3)`, [orgD, salle, cta])).rejects.toThrow(/n'appartient pas/);
    });
  });

  it("applique le module traitement d'air : le rôle nettoyage ne voit pas les CTA", async () => {
    await comme(ids.a, async () => {
      const role = await un<{ id: string }>(`select id from roles where org_id = $1 and cle = 'nettoyage'`, [orgA]);
      await db.query(`update membres set role_id = $1 where user_id = $2 and org_id = $3`, [role.id, ids.b, orgA]);
    });
    await comme(ids.b, async () => {
      expect(await nb(`select * from ctas`)).toBe(0);
      expect(await nb(`select * from portes`)).toBeGreaterThan(0);
      await expect(db.query(`insert into ctas (org_id, site_id, nom) values ($1, $2, 'X')`, [orgA, site1])).rejects.toThrow(/row-level security/);
    });
  });

  it("met les portes à l'extérieur quand une zone est supprimée, et supprime le plan avec la salle", async () => {
    await comme(ids.a, async () => {
      await db.query(`delete from zones where id = $1`, [zoneSas]);
      const p = await un<{ zone_b: string | null }>(`select zone_b from portes where zone_a = $1`, [zoneProd]);
      expect(p.zone_b).toBeNull();
      await expect(db.query(`update salles_propres set site_id = $1 where id = $2`, [site2, salle1])).rejects.toThrow(/changer de site/);
    });
  });

  it("numérote et exige les signatures via les fonctions génériques", async () => {
    await db.exec(`
      create table public.essai_generique (id uuid primary key default gen_random_uuid(), org_id uuid not null, numero text, statut text not null default 'brouillon', version integer not null default 1);
      create trigger numero before insert on public.essai_generique for each row execute function app.numeroter('TST');
      create trigger signature before insert or update on public.essai_generique for each row execute function app.exiger_signature('essai', 'approuve', 'approuve', 'rapport', 'version');
      insert into app.objets_signables values ('essai', 'essai_generique', 'version', 'documents');
    `);
    const a = await un<{ id: string; numero: string }>(`insert into public.essai_generique (org_id) values ($1) returning id, numero`, [orgA]);
    const b = await un<{ numero: string }>(`insert into public.essai_generique (org_id) values ($1) returning numero`, [orgA]);
    const annee = new Date().getFullYear();
    expect(a.numero).toBe(`TST-${annee}-001`);
    expect(b.numero).toBe(`TST-${annee}-002`);
    await expect(db.query(`update public.essai_generique set statut = 'approuve' where id = $1`, [a.id])).rejects.toThrow(/Signature « approuve » requise/);
    await comme(ids.a, () => db.query(`select signer('essai', $1, 'approuve', '', 'rapport')`, [a.id]));
    await db.query(`update public.essai_generique set statut = 'approuve' where id = $1`, [a.id]);
    await db.exec(`delete from app.objets_signables where objet_type = 'essai'; drop table public.essai_generique;`);
  });
});

describe("Qualification et résultats (phase 3)", () => {
  let instrument = "";
  let campagne = "";
  let essai = "";

  it("calcule l'échéance d'étalonnage et refuse un résultat mesuré avec un instrument non étalonné", async () => {
    await comme(ids.a, async () => {
      instrument = (await un<{ id: string }>(`insert into instruments (org_id, libelle, periodicite_etalonnage_mois) values ($1, 'Compteur', 12) returning id`, [orgA])).id;
      const e = await un<{ prochaine_echeance: string }>(`insert into etalonnages (org_id, instrument_id, date_etalonnage) values ($1, $2, '2026-01-15') returning prochaine_echeance::text`, [orgA, instrument]);
      expect(e.prochaine_echeance).toBe("2027-01-15");
      await expect(db.query(`insert into resultats (org_id, salle_id, milieu, nature, valeur, instrument_id, date_prelevement) values ($1, $2, 'air', 'particulaire', 10, $3, '2025-06-01')`, [orgA, salle1, instrument])).rejects.toThrow(/non étalonné/);
      const r = await un<{ verdict: string; site_id: string }>(`insert into resultats (org_id, salle_id, milieu, nature, valeur, limite_alerte, limite_action, instrument_id, date_prelevement) values ($1, $2, 'air', 'particulaire', 250000, 200000, 352000, $3, '2026-06-01') returning verdict, site_id`, [orgA, salle1, instrument]);
      expect(r).toEqual({ verdict: "alerte", site_id: site1 });
      await db.query(`update instruments set statut = 'hors_service' where id = $1`, [instrument]);
      await expect(db.query(`insert into resultats (org_id, salle_id, milieu, nature, valeur, instrument_id, date_prelevement) values ($1, $2, 'air', 'particulaire', 10, $3, '2026-06-02')`, [orgA, salle1, instrument])).rejects.toThrow(/non étalonné/);
      await db.query(`update instruments set statut = 'en_service' where id = $1`, [instrument]);
    });
  });

  it("numérote la campagne et exige la signature du protocole", async () => {
    await comme(ids.a, async () => {
      const c = await un<{ id: string; numero: string }>(`insert into campagnes_qualification (org_id, salle_id, titre) values ($1, $2, 'Q') returning id, numero`, [orgA, salle1]);
      campagne = c.id;
      expect(c.numero).toMatch(/^QUAL-\d{4}-001$/);
      essai = (await un<{ id: string }>(`insert into essais (org_id, campagne_id, cle_essai, libelle) values ($1, $2, 'pression_differentielle', 'Pression') returning id`, [orgA, campagne])).id;
      await expect(db.query(`update campagnes_qualification set statut = 'protocole_approuve' where id = $1`, [campagne])).rejects.toThrow(/Signature « approuve » requise/);
      await db.query(`select signer('campagne', $1, 'approuve', '', 'rapport')`, [campagne]);
      await expect(db.query(`update campagnes_qualification set statut = 'protocole_approuve' where id = $1`, [campagne])).rejects.toThrow(/requise/);
      await db.query(`select signer('campagne', $1, 'approuve', '', 'protocole')`, [campagne]);
      await db.query(`update campagnes_qualification set statut = 'protocole_approuve' where id = $1`, [campagne]);
    });
  });

  it("refuse un essai réalisé sans verdict ou avec un instrument périmé", async () => {
    await comme(ids.a, async () => {
      await expect(db.query(`update essais set statut = 'realise' where id = $1`, [essai])).rejects.toThrow(/verdict/);
      await expect(db.query(`update essais set statut = 'realise', verdict = 'conforme', instrument_id = $2, date_realisation = '2028-01-01' where id = $1`, [essai, instrument])).rejects.toThrow(/non étalonné/);
      await db.query(`update essais set statut = 'realise', verdict = 'conforme', instrument_id = $2, date_realisation = '2026-06-01' where id = $1`, [essai, instrument]);
    });
  });

  it("réserve l'exécution au module correspondant", async () => {
    await comme(ids.c, async () => {
      expect(await nb(`select * from essais`)).toBeGreaterThan(0);
      await expect(db.query(`insert into essais (org_id, campagne_id, cle_essai, libelle) values ($1, $2, 'x', 'x')`, [orgA, campagne])).rejects.toThrow(/row-level security/);
    });
  });

  it("fige la campagne, ses essais et ses résultats une fois clôturée", async () => {
    await comme(ids.a, async () => {
      await db.query(`insert into resultats (org_id, salle_id, essai_id, milieu, nature, valeur) values ($1, $2, $3, 'air', 'particulaire', 5)`, [orgA, salle1, essai]);
      await db.query(`update campagnes_qualification set statut = 'en_execution' where id = $1`, [campagne]);
      await db.query(`update campagnes_qualification set statut = 'rapport_redige', verdict = 'qualifie' where id = $1`, [campagne]);
      // la signature « rapport » posée au test précédent (version 1) satisfait la clôture
      await db.query(`update campagnes_qualification set statut = 'cloturee' where id = $1`, [campagne]);
      await expect(db.query(`update campagnes_qualification set titre = 'X' where id = $1`, [campagne])).rejects.toThrow(/clôturée/);
      await expect(db.query(`update essais set commentaire = 'X' where id = $1`, [essai])).rejects.toThrow(/figés/);
      await expect(db.query(`update resultats set valeur = 1 where essai_id = $1`, [essai])).rejects.toThrow(/figés/);
      await expect(db.query(`insert into essais (org_id, campagne_id, cle_essai, libelle) values ($1, $2, 'x', 'x')`, [orgA, campagne])).rejects.toThrow(/figés/);
      await expect(db.query(`delete from salles_propres where id = $1`, [salle1])).rejects.toThrow();
    });
  });
});
