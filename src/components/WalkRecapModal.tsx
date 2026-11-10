import React, { useMemo } from 'react';
import { EPISTEMIC_STATUS_META, haversineMeters, UnlockedEntry } from '../types';
import { PixelCornerRivets, PixelGuildIcon, PixelUiIcon } from './PixelIcons';

export interface WalkRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionMeters: number;
  sessionElevGainM: number;
  sessionUnlockedPoiIds: string[];
  entries: UnlockedEntry[];
  onOpenEntry: (poiId: string) => void;
  onResetSession: () => void;
  isSimulatedLocation?: boolean;
}

function formatMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

export const WalkRecapModal: React.FC<WalkRecapModalProps> = ({
  isOpen,
  onClose,
  sessionMeters,
  sessionElevGainM,
  sessionUnlockedPoiIds,
  entries,
  onOpenEntry,
  onResetSession,
  isSimulatedLocation,
}) => {
  if (!isOpen) return null;

  // Filter entries discovered during this outing
  const sessionEntries = useMemo(() => {
    const idSet = new Set(sessionUnlockedPoiIds);
    return entries.filter((e) => idSet.has(e.poiId));
  }, [entries, sessionUnlockedPoiIds]);

  // Entries with notes or photos
  const annotatedSessionEntries = useMemo(() => {
    return sessionEntries.filter((e) => Boolean(e.personalNote) || e.photoCount > 0);
  }, [sessionEntries]);

  // Rough estimation of walking time at ~4 km/h
  const estimatedWalkMinutes = Math.round((sessionMeters / 4000) * 60);

  return (
    <div
      role="dialog"
      aria-label="Récapitulatif de la promenade"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#f5e6cc] text-[#24160c] border-2 border-[#8c653b] p-4 sm:p-6 jrpg-shadow space-y-5 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <PixelCornerRivets />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#8c653b]/60 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 bg-[#28160d] text-amber-300 border border-[#d97706] shadow-sm">
                <PixelUiIcon name="boot" className="w-4 h-4 text-amber-300" />
              </span>
              <h2 className="text-base sm:text-xl font-bold font-display uppercase tracking-wide text-[#24160c]">
                Carnet de Promenade en Cours
              </h2>
            </div>
            <p className="text-xs text-[#54361d]">
              Récapitulatif consultable à la demande · Vos pas, reliefs et observations sans obligation de clôture
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le récapitulatif"
            className="min-h-[38px] px-2.5 py-1 text-xs font-bold bg-[#3b2214] text-amber-200 hover:text-white border border-[#d97706] transition-colors"
          >
            ✕ Fermer
          </button>
        </div>

        {/* Mode Integrity Status Banner */}
        <div
          className={`p-2.5 border text-xs flex items-center justify-between gap-3 ${
            isSimulatedLocation
              ? 'bg-amber-100/80 border-amber-600/60 text-[#451a03]'
              : 'bg-emerald-100/80 border-emerald-600/60 text-[#064e3b]'
          }`}
        >
          <div className="flex items-center gap-2">
            <PixelUiIcon name={isSimulatedLocation ? 'boot' : 'gps'} className="w-4 h-4 shrink-0" />
            <div className="leading-snug">
              <span className="font-bold">
                {isSimulatedLocation
                  ? 'Arpentage Virtuel (Mode Simulation)'
                  : 'Marche Réelle Vérifiée (GPS)'}
              </span>
              <p className="text-[11px] opacity-90">
                {isSimulatedLocation
                  ? 'Distance et dénivelé simulés pour tester et explorer la carte sans altérer vos classements pédestres réels.'
                  : 'Déplacement physique enregistré in situ : vos pas alimentent vos défis de marche réels.'}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-current shrink-0">
            {isSimulatedLocation ? 'Simulateur' : 'GPS Terrain'}
          </span>
        </div>

        {/* Walking Metrics Cartouches */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2.5 bg-[#ecd8b1] border border-[#8c653b]">
            <div className="text-[10px] uppercase font-bold text-[#6b4928]">
              {isSimulatedLocation ? 'Distance simulée' : 'Distance marchée'}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#24160c]">
              {formatMeters(sessionMeters)}
            </div>
          </div>
          <div className="p-2.5 bg-[#ecd8b1] border border-[#8c653b]">
            <div className="text-[10px] uppercase font-bold text-[#6b4928]">Dénivelé D+</div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#24160c]">
              +{sessionElevGainM} m
            </div>
          </div>
          <div className="p-2.5 bg-[#ecd8b1] border border-[#8c653b]">
            <div className="text-[10px] uppercase font-bold text-[#6b4928]">Temps estimé</div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#24160c]">
              {sessionMeters >= 30 ? `${estimatedWalkMinutes || 1} min` : 'En pause'}
            </div>
          </div>
          <div className="p-2.5 bg-[#ecd8b1] border border-[#8c653b]">
            <div className="text-[10px] uppercase font-bold text-[#6b4928]">Découvertes</div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#24160c]">
              {sessionEntries.length}
            </div>
          </div>
        </div>

        {/* Section: Découvertes de cette sortie */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#54361d]">
            <span className="uppercase tracking-wider">
              Lieux croisés pendant cette sortie ({sessionEntries.length})
            </span>
          </div>

          {sessionEntries.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {sessionEntries.map((entry) => {
                const epMeta = entry.epistemicStatus
                  ? EPISTEMIC_STATUS_META[entry.epistemicStatus]
                  : null;
                return (
                  <button
                    key={entry.poiId}
                    type="button"
                    onClick={() => {
                      onOpenEntry(entry.poiId);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 bg-[#fbf5e8] border border-[#8c653b] hover:border-[#24160c] transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PixelGuildIcon category={entry.category} className="w-4 h-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-[#24160c] truncate">{entry.name}</div>
                        <div className="text-[11px] text-[#6b4928] truncate">
                          {entry.subType || entry.eraLabel}
                          {epMeta && (
                            <span className="ml-2 font-mono text-[10px] text-[#78350f]">
                              [{epMeta.badgeLabel}]
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(Boolean(entry.personalNote) || entry.photoCount > 0) && (
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 border border-rose-300">
                          {entry.photoCount > 0 ? `📷 ${entry.photoCount}` : 'Note'}
                        </span>
                      )}
                      <span className="text-amber-800 text-[11px] font-bold">Consulter ▸</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Poetic and respectful framing for an outing without recorded POIs */
            <div className="p-4 bg-[#fbf5e8] border-2 border-dashed border-[#a27a4a]/60 text-center space-y-2">
              <div className="inline-flex items-center justify-center w-8 h-8 bg-amber-100 rounded-full border border-amber-300 mx-auto text-[#6b4928]">
                <PixelUiIcon name="radar" className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#24160c]">
                Une promenade sans vestige classé conserve toute sa valeur
              </h3>
              <p className="text-xs text-[#54361d] leading-relaxed max-w-lg mx-auto">
                Le simple fait d’avoir marché, d’observer le vent, les murets de pierre, la pente du
                terrain et les lisières compose votre propre atlas sensible. Le paysage ne se réduit pas
                aux inventaires : cheminez à votre rythme.
              </p>
            </div>
          )}
        </div>

        {/* Section: Notes & clichés récents de la sortie si existants */}
        {annotatedSessionEntries.length > 0 && (
          <div className="space-y-1.5 p-3 bg-[#ecd8b1] border border-[#8c653b] text-xs">
            <div className="font-bold text-[#4a321d] uppercase tracking-wider text-[11px]">
              Notes &amp; Clichés saisis lors de cette promenade ({annotatedSessionEntries.length})
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {annotatedSessionEntries.map((e) => (
                <button
                  key={e.poiId}
                  type="button"
                  onClick={() => {
                    onOpenEntry(e.poiId);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-[#fffaf0] border border-[#6b4928] text-[#24160c] hover:bg-amber-100 text-[11px] font-medium flex items-center gap-1.5 truncate max-w-xs"
                >
                  <PixelUiIcon name="quill" className="w-3 h-3 text-[#6b4928]" />
                  <span className="truncate">{e.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Safety and Land Stewardship Note */}
        <div className="p-2.5 bg-[#fbf5e8] border border-[#a27a4a]/60 text-[11px] text-[#54361d] flex items-center gap-2.5">
          <PixelUiIcon name="shield" className="w-4 h-4 text-[#8c653b] shrink-0" />
          <p className="leading-snug">
            <strong>Respect des lieux &amp; sécurité :</strong> restez toujours sur les voies publiques
            balisées. Ne pénétrez jamais dans une propriété privée, un terrain clos ou un milieu
            naturel fragile pour valider un sceau — la portée de détection permet d’explorer à distance.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#8c653b]/40">
          <button
            type="button"
            onClick={onResetSession}
            className="min-h-[42px] px-3.5 py-2 text-xs font-bold bg-[#fbf5e8] text-[#6b4928] hover:bg-[#fffaf0] border border-[#8c653b] transition-colors"
            title="Remet le compteur de la promenade à zéro pour débuter une nouvelle boucle"
          >
            ↺ Commencer une nouvelle sortie
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 py-2 text-xs font-bold bg-[#991b1b] text-[#fffbeb] hover:bg-[#b91c1c] border-2 border-[#24160c] jrpg-shadow transition-colors"
          >
            ← Continuer la promenade
          </button>
        </div>
      </div>
    </div>
  );
};
