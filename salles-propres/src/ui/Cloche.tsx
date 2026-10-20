import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSession } from "../session";
import type { Notification } from "../data/types";
import { formatDate } from "./composants";

/** Notifications internes : attributions, mentions. */
export function Cloche() {
  const s = useSession();
  const org = s.org!.id;
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const [liste, setListe] = useState<Notification[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let actif = true;
    const charger = () => s.depot.lister("notifications", org).then((l) => { if (actif) setListe(l.sort((a, b) => b.cree_le.localeCompare(a.cree_le))); }).catch(() => undefined);
    void charger();
    const minuteur = window.setInterval(charger, 30000);
    return () => { actif = false; window.clearInterval(minuteur); };
  }, [s.depot, org, emplacement.pathname, emplacement.search]);

  useEffect(() => {
    const clic = (e: MouseEvent) => { if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, []);

  const nonLues = liste.filter((n) => !n.lue);
  const lire = async (n: Notification) => {
    if (!n.lue) await s.depot.modifier("notifications", n.id, { lue: true });
    setListe(liste.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
    setOuvert(false);
    if (n.lien) naviguer(n.lien);
  };
  const toutLire = async () => {
    for (const n of nonLues) await s.depot.modifier("notifications", n.id, { lue: true });
    setListe(liste.map((x) => ({ ...x, lue: true })));
  };

  return (
    <div className="relative" ref={boite}>
      <button type="button" aria-label={`Notifications (${nonLues.length} non lues)`} className="relative rounded-lg px-2 py-1 hover:bg-fond" onClick={() => setOuvert(!ouvert)}>
        <span aria-hidden>🔔</span>
        {nonLues.length > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold text-white">{nonLues.length}</span>}
      </button>
      {ouvert && (
        <div className="absolute right-0 z-40 mt-1 w-80 rounded-xl border border-bord bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-bord px-3 py-2 text-sm">
            <strong>Notifications</strong>
            {nonLues.length > 0 && <button type="button" className="text-xs text-navy-700 hover:underline" onClick={() => void toutLire()}>Tout marquer comme lu</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {liste.length === 0 && <li className="px-3 py-4 text-center text-sm text-texte-2">Aucune notification.</li>}
            {liste.slice(0, 30).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => void lire(n)} className={`block w-full border-b border-bord px-3 py-2 text-left text-sm hover:bg-fond ${n.lue ? "text-texte-2" : "bg-navy-050/60"}`}>
                  <div>{n.texte}</div>
                  <div className="text-xs text-texte-2">{formatDate(n.cree_le, true)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
