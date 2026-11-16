import { Fragment } from "react";
import { preloadBody } from "./Globe.jsx";

export function TopBar({
  viewMode,
  activeBody,
  activeBodyId,
  terrainTarget,
  handleNavigateSystem,
  handleNavigateBody,
  setMobileMenuOpen,
  setIsSearchOpen,
  setIsConfigOpen,
}) {
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 bg-space-750/90 backdrop-blur-md border-b border-space-600/60 z-20">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-slatex-300 hover:bg-space-700"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <nav aria-label="Ubicación" className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
          <button
            onClick={handleNavigateSystem}
            className="min-h-[32px] font-semibold text-white hover:text-mint-400 transition-colors flex-shrink-0"
          >
            Explorador
          </button>
          <span className="text-slatex-500" aria-hidden="true">›</span>
          <span key={viewMode + activeBodyId} className="o-swap text-slatex-300 truncate">
            {viewMode === "system" && "Sistema planetario"}
            {viewMode === "explore" && activeBody.shortName}
            {viewMode === "compare" && (
              <>
                {activeBody.shortName}
                <span className="text-slatex-500 mx-1">/</span>
                <span className="text-mint-300">Comparación</span>
              </>
            )}
            {viewMode === "terrain" && (
              <>
                <span className="text-mint-300">Conoce tu terreno</span>
                {terrainTarget?.name && (
                  <span className="hidden sm:inline">
                    <span className="text-slatex-500 mx-1">/</span>
                    {terrainTarget.name}
                  </span>
                )}
              </>
            )}
          </span>
        </nav>
      </div>

      <div className="hidden md:flex items-center gap-1 bg-space-850/70 px-1.5 py-1 rounded-xl border border-space-600/50" role="group" aria-label="Cuerpo celeste">
        {[
          { id: "luna", label: "Luna" },
          { id: "marte", label: "Marte" },
          { id: "tierra", label: "Tierra" },
        ].map((b, idx) => {
          const isActive =
            (viewMode === "explore" || viewMode === "compare") &&
            activeBodyId === b.id;
          return (
            <Fragment key={b.id}>
              {idx > 0 && (
                <span className="h-3.5 w-[1px] bg-space-600/80 mx-0.5" aria-hidden="true" />
              )}
              <button
                data-body={b.id}
                aria-pressed={isActive}
                onPointerEnter={() => preloadBody(b.id)}
                onFocus={() => preloadBody(b.id)}
                onClick={() => handleNavigateBody(b.id)}
                className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors duration-180 ${
                  isActive
                    ? "bg-mint-400/15 text-mint-300"
                    : "text-slatex-300 hover:text-white hover:bg-space-700/60"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-mint-400" aria-hidden="true" />
                {b.label}
              </button>
            </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          onClick={() => setIsSearchOpen(true)}
          aria-label="Buscar en el explorador"
          className="flex items-center gap-2.5 min-h-[40px] sm:w-44 lg:w-64 px-3 sm:px-3.5 rounded-xl bg-space-850/90 border border-space-600/70 hover:border-mint-400/50 text-xs text-slatex-400 transition-colors duration-180"
        >
          <svg className="w-4 h-4 text-slatex-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="truncate hidden sm:inline">Buscar en el explorador</span>
        </button>

        <button
          onClick={() => setIsConfigOpen(true)}
          className="hidden xl:inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-full bg-mint-400/12 hover:bg-mint-400/20 border border-mint-400/25 text-[11px] font-bold tracking-wider text-mint-300 uppercase transition-colors duration-180"
          title="Ver fuentes de datos orbitales NASA y satelitales"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-mint-400" />
          Explorador 3D
        </button>
      </div>
    </header>
  );
}
