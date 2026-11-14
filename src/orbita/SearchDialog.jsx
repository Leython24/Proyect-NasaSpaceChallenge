import { formatCoords, parseCoordinateInput } from "./geography.js";
import { AtlasImage } from "./Evidence.jsx";

export function SearchDialog({
  searchQuery,
  setSearchQuery,
  filteredSearchRegions,
  setIsSearchOpen,
  handleSelectRegion,
  setActiveBodyId,
  setFocusedSystemBodyId,
  setViewMode,
  handleSurfaceProbe,
}) {
  return (
    <div
      onClick={() => setIsSearchOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar una región"
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-space-800 border border-space-600/80 shadow-2xl p-6 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-white">
              Buscar una región
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slatex-400">
              Filtra por nombre, cuerpo celeste, país, tipo de terreno o
              coordenadas.
            </p>
          </div>
          <button
            onClick={() => setIsSearchOpen(false)}
            className="w-9 h-9 rounded-xl bg-space-700/80 hover:bg-space-600 text-slatex-300 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar búsqueda"
          >
            ✕
          </button>
        </div>

        <div className="mt-5">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Nombre o coordenadas"
            placeholder="Ej. Copérnico, Gale, Atacama, o coordenadas: -24.08, -69.91"
            className="w-full px-4 py-3.5 rounded-2xl bg-space-950/90 border border-space-700 focus:border-mint-400 focus:outline-none text-sm text-white placeholder-slatex-500"
          />
        </div>

        {(() => {
          const parsedCoords = parseCoordinateInput(searchQuery);
          if (!parsedCoords) return null;
          return (
            <div className="mt-4 p-3.5 rounded-2xl bg-mint-400/10 border border-mint-400/35">
              <div className="text-[10px] font-bold tracking-[0.14em] text-mint-300 uppercase">
                IR DIRECTAMENTE A COORDENADA:{" "}
                {formatCoords(parsedCoords.lat, parsedCoords.lon)}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  { id: "tierra", label: "En Tierra 3D" },
                  { id: "luna", label: "En Luna 3D" },
                  { id: "marte", label: "En Marte 3D" },
                ].map((target) => (
                  <button
                    key={target.id}
                    onClick={() => {
                      setActiveBodyId(target.id);
                      setFocusedSystemBodyId(target.id);
                      setViewMode("explore");
                      setIsSearchOpen(false);
                      handleSurfaceProbe(
                        target.id,
                        parsedCoords.lat,
                        parsedCoords.lon,
                      );
                    }}
                    className="py-2 px-2.5 rounded-xl bg-space-900 hover:bg-mint-400 text-white hover:text-space-950 border border-mint-400/40 text-xs font-semibold transition-all"
                  >
                    {target.label} →
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="mt-5">
          <div className="text-[10px] font-bold tracking-[0.15em] text-mint-400 uppercase mb-3">
            REGIONES DISPONIBLES ({filteredSearchRegions.length})
          </div>

          <div className="max-h-[35dvh] overflow-y-auto space-y-2.5 pr-1">
            {filteredSearchRegions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slatex-400">
                No se encontraron regiones que coincidan con "{searchQuery}".
              </div>
            ) : (
              filteredSearchRegions.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => handleSelectRegion(reg)}
                  className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-space-750/80 hover:bg-space-700 border border-space-600/50 hover:border-mint-400/50 text-left transition-all group"
                >
                  <AtlasImage
                    item={reg}
                    className="w-16 h-12 rounded-xl object-cover flex-shrink-0 bg-space-900"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-white group-hover:text-mint-300 transition-colors truncate">
                      {reg.name}
                    </div>
                    <div className="text-xs text-slatex-400 mt-0.5 truncate">
                      {reg.countryOrBody} · {reg.coordsText}
                    </div>
                  </div>
                  <span className="text-xs text-mint-400 opacity-0 group-hover:opacity-100 transition-opacity px-2">
                    Explorar →
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-space-700/70 text-[11px] text-slatex-500">
          Catálogo de referencia y sectores de estudio del Perú
        </div>
      </div>
    </div>
  );
}
