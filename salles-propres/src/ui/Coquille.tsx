import { NavLink, Outlet } from "react-router";
import { useSession } from "../session";
import { Badge, Liste } from "./composants";
import { reinitialiserDemo } from "../data/initialisation";
import { Cloche } from "./Cloche";

interface Lien {
  vers: string;
  libelle: string;
  icone: string;
  visible: boolean;
}

export const A_VENIR = [
  { phase: 6, cle: "maintenance", libelle: "Maintenance, change control", icone: "🛠️" },
];

export function Coquille() {
  const s = useSession();
  const liens: Lien[] = [
    { vers: "/", libelle: "Accueil", icone: "🏠", visible: true },
    { vers: "/entreprises", libelle: "Entreprises et sites", icone: "🏢", visible: s.peut("installations", 1) },
    { vers: "/salles", libelle: "Salles propres", icone: "🧪", visible: s.peut("installations", 1) },
    { vers: "/traitement-air", libelle: "Traitement d'air", icone: "🌀", visible: s.peut("cta", 1) },
    { vers: "/equipements", libelle: "Équipements", icone: "🔧", visible: s.peut("installations", 1) },
    { vers: "/qualification", libelle: "Qualification", icone: "✅", visible: s.peut("qualification_protocoles", 1) || s.peut("qualification_execution", 1) },
    { vers: "/contaminations", libelle: "Contaminations", icone: "🔬", visible: s.peut("contamination_resultats", 1) || s.peut("contamination_tendances", 1) },
    { vers: "/instruments", libelle: "Instruments", icone: "📏", visible: s.peut("instruments", 1) },
    { vers: "/nettoyage", libelle: "Nettoyage", icone: "🧽", visible: s.peut("nettoyage_procedures", 1) || s.peut("nettoyage_execution", 1) },
    { vers: "/personnel", libelle: "Personnel", icone: "👥", visible: s.peut("personnel", 1) },
    { vers: "/ecarts", libelle: "Écarts et CAPA", icone: "⚠️", visible: s.peut("ecarts_capa", 1) },
    { vers: "/taches", libelle: "Tâches", icone: "📌", visible: s.peut("kanban", 1) },
    { vers: "/discussions", libelle: "Discussions", icone: "💬", visible: s.peut("discussions", 1) },
    { vers: "/documents", libelle: "Documents", icone: "📄", visible: s.peut("documents", 1) },
    { vers: "/referentiels", libelle: "Référentiels", icone: "📚", visible: s.peut("referentiels", 1) },
    { vers: "/configuration", libelle: "Configuration", icone: "⚙️", visible: s.peut("configuration", 1) || s.peut("gabarits", 1) },
    { vers: "/journal", libelle: "Journal d'audit", icone: "🕑", visible: s.peut("audit", 1) },
  ];
  const nomUtilisateur = s.utilisateur?.nom_complet || s.utilisateur?.email;

  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-navy-900 to-navy-800 text-navy-100 max-md:hidden">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cuivre-500 to-cuivre-400 text-sm font-extrabold text-white">SP</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">Salles Propres</div>
            <div className="truncate text-[11px] text-navy-100/70">{s.org?.nom}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {liens.filter((l) => l.visible).map((l) => (
            <NavLink
              key={l.vers}
              to={l.vers}
              end={l.vers === "/"}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5"}`}
            >
              <span aria-hidden>{l.icone}</span>{l.libelle}
            </NavLink>
          ))}
        </nav>
        <div className="mt-2 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-100/50">À venir</div>
        <nav className="flex flex-col gap-0.5 p-2 pt-0">
          {A_VENIR.map((m) => (
            <NavLink
              key={m.cle}
              to={`/a-venir/${m.cle}`}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] ${isActive ? "bg-white/10 text-white" : "text-navy-100/60 hover:bg-white/5"}`}
            >
              <span aria-hidden className="opacity-70">{m.icone}</span>
              <span className="flex-1">{m.libelle}</span>
              <span className="text-[10px]">P{m.phase}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {s.depot.mode === "demo" && (
          <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
            <strong>Mode démonstration</strong>
            <span>Données enregistrées dans ce navigateur uniquement, sans valeur de preuve.</span>
            <button type="button" className="underline" onClick={() => void s.deconnecter()}>Changer d'utilisateur</button>
            <button
              type="button"
              className="underline"
              onClick={async () => {
                if (!window.confirm("Effacer toutes les données de démonstration et recréer le jeu d'exemple ?")) return;
                await reinitialiserDemo();
                window.location.reload();
              }}
            >
              Réinitialiser la démo
            </button>
          </div>
        )}
        <header className="no-print flex flex-wrap items-center justify-end gap-3 border-b border-bord bg-white px-4 py-2">
          <nav className="mr-auto flex flex-wrap gap-1 md:hidden">
            {liens.filter((l) => l.visible).map((l) => (
              <NavLink key={l.vers} to={l.vers} end={l.vers === "/"} className="rounded px-2 py-1 text-xs hover:bg-fond">{l.icone} {l.libelle}</NavLink>
            ))}
          </nav>
          {s.organisations.length > 1 && (
            <Liste aria-label="Organisation" className="!w-auto" value={s.org?.id} onChange={(e) => s.choisirOrg(e.target.value)}>
              {s.organisations.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </Liste>
          )}
          <Cloche />
          <span className="text-sm">{nomUtilisateur}</span>
          {s.monRole && <Badge ton="info">{s.monRole.libelle}</Badge>}
          <button type="button" className="text-sm text-texte-2 hover:text-texte" onClick={() => void s.deconnecter()}>Déconnexion</button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
