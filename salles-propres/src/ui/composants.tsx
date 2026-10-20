import { cloneElement, isValidElement, useCallback, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Variante = "principal" | "secondaire" | "danger" | "discret";

const VARIANTES: Record<Variante, string> = {
  principal: "bg-navy-700 text-white hover:bg-navy-600 border-navy-700",
  secondaire: "bg-white text-texte hover:bg-navy-050 border-bord",
  danger: "bg-white text-red-700 hover:bg-red-50 border-red-200",
  discret: "bg-transparent text-navy-700 hover:bg-navy-050 border-transparent",
};

export function Bouton({ variante = "secondaire", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    />
  );
}

export function Carte({ titre, actions, children, className = "" }: { titre?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-bord bg-white shadow-sm ${className}`}>
      {(titre || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-bord px-4 py-3">
          <h2 className="text-[15px] font-semibold">{titre}</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EnTete({ titre, sousTitre, actions }: { titre: ReactNode; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-navy-900">{titre}</h1>
        {sousTitre && <p className="mt-0.5 text-texte-2">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Libellé relié explicitement à son champ (le nom accessible du champ est le libellé seul). */
export function Champ({ libelle, aide, children, className = "" }: { libelle: ReactNode; aide?: ReactNode; children: ReactNode; className?: string }) {
  const genere = useId();
  const element = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const id = element?.props.id ?? genere;
  const idAide = aide ? `${id}-aide` : undefined;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-semibold text-texte-2">{libelle}</label>
      {element ? cloneElement(element as ReactElement<Record<string, unknown>>, { id, ...(idAide ? { "aria-describedby": idAide } : {}) }) : children}
      {aide && <span id={idAide} className="text-xs text-texte-2">{aide}</span>}
    </div>
  );
}

const CLASSE_SAISIE = "w-full rounded-lg border border-bord bg-white px-2.5 py-1.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100 disabled:bg-fond";

export function Saisie(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CLASSE_SAISIE} ${props.className ?? ""}`} />;
}

export function Liste(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CLASSE_SAISIE} ${props.className ?? ""}`} />;
}

export function ZoneTexte(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${CLASSE_SAISIE} ${props.className ?? ""}`} />;
}

/** Champ numérique : chaîne vide ⇄ null. */
export function SaisieNombre({ valeur, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { valeur: number | null; onChange: (v: number | null) => void }) {
  const [texte, setTexte] = useState(valeur === null ? "" : String(valeur).replace(".", ","));
  useEffect(() => {
    const actuel = texte.trim() === "" ? null : Number(texte.replace(",", "."));
    if (actuel !== valeur) setTexte(valeur === null ? "" : String(valeur).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);
  return (
    <Saisie
      inputMode="decimal"
      {...props}
      value={texte}
      onChange={(e) => {
        setTexte(e.target.value);
        const t = e.target.value.trim().replace(",", ".");
        if (t === "") onChange(null);
        else if (!Number.isNaN(Number(t))) onChange(Number(t));
      }}
    />
  );
}

type Ton = "neutre" | "ok" | "attention" | "alerte" | "info" | "cuivre";
const TONS: Record<Ton, string> = {
  neutre: "bg-fond text-texte-2 border-bord",
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  attention: "bg-amber-50 text-amber-800 border-amber-200",
  alerte: "bg-red-50 text-red-800 border-red-200",
  info: "bg-navy-050 text-navy-700 border-navy-100",
  cuivre: "bg-cuivre-050 text-cuivre-600 border-orange-200",
};

export function Badge({ ton = "neutre", children, title }: { ton?: Ton; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONS[ton]}`}>{children}</span>;
}

export function Bandeau({ ton = "info", children }: { ton?: Ton; children: ReactNode }) {
  return <div className={`rounded-lg border px-3 py-2 text-sm ${TONS[ton]}`}>{children}</div>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-bord px-4 py-8 text-center text-texte-2">{children}</div>;
}

export function Modale({ titre, onFermer, children, pied, large }: { titre: ReactNode; onFermer: () => void; children: ReactNode; pied?: ReactNode; large?: boolean }) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div role="dialog" aria-modal="true" className={`my-8 w-full ${large ? "max-w-4xl" : "max-w-xl"} rounded-xl bg-white shadow-xl`}>
        <header className="flex items-center justify-between border-b border-bord px-5 py-3">
          <h2 className="text-base font-semibold">{titre}</h2>
          <button type="button" aria-label="Fermer" className="rounded p-1 text-texte-2 hover:bg-fond" onClick={onFermer}>✕</button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {pied && <footer className="flex flex-wrap justify-end gap-2 border-t border-bord px-5 py-3">{pied}</footer>}
      </div>
    </div>
  );
}

export function Onglets<T extends string>({ onglets, actif, onChange }: { onglets: { cle: T; libelle: ReactNode }[]; actif: T; onChange: (cle: T) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-bord" role="tablist">
      {onglets.map((o) => (
        <button
          key={o.cle}
          type="button"
          role="tab"
          aria-selected={o.cle === actif}
          onClick={() => onChange(o.cle)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${o.cle === actif ? "border-cuivre-500 text-navy-900" : "border-transparent text-texte-2 hover:text-texte"}`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

export function TableauDefilant({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-bord">{children}</div>;
}

/** Charge des données asynchrones et expose l'erreur éventuelle. */
export function useDonnees<T>(charger: () => Promise<T>, dependances: unknown[]): { donnees: T | null; erreur: string | null; recharger: () => void } {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [jeton, setJeton] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(charger, dependances);
  useEffect(() => {
    let actif = true;
    fn().then((d) => { if (actif) { setDonnees(d); setErreur(null); } })
      .catch((e: unknown) => { if (actif) setErreur(e instanceof Error ? e.message : String(e)); });
    return () => { actif = false; };
  }, [fn, jeton]);
  return { donnees, erreur, recharger: () => setJeton((j) => j + 1) };
}

/** Exécute une action asynchrone en gérant l'état « en cours » et l'erreur. */
export function useAction() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const executer = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setEnCours(true);
    setErreur(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setEnCours(false);
    }
  }, []);
  return { enCours, erreur, executer, effacer: () => setErreur(null) };
}

export function MessageErreur({ erreur }: { erreur: string | null }) {
  if (!erreur) return null;
  return <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</div>;
}

export function formatDate(iso: string | null | undefined, avecHeure = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return avecHeure
    ? d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : d.toLocaleDateString("fr-FR");
}

/** Valeur d'un champ datetime-local à l'heure locale (toISOString donnerait l'heure UTC). */
export function dateHeureLocale(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function telechargerFichier(nom: string, contenu: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
