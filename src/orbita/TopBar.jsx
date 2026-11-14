import { Fragment } from "react";

export function TopBar({
  viewMode,
  activeBody,
  activeBodyId,
  handleNavigateSystem,
  handleNavigateBody,
  setMobileMenuOpen,
  setIsSearchOpen,
  setIsConfigOpen,
}) {
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 bg-space-750/90 backdrop-blur-md border-b border-space-600/60 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slatex-300 hover:bg-space-700"
          aria-label="Abrir menú"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
          <button
            onClick={handleNavigateSystem}
            className="font-semibold text-white hover:text-mint-400 transition-colors"
          >
            Explorador
          </button>
          <span className="text-slatex-500">&gt;</span>
          {viewMode === "system" && (
            <span className="text-slatex-300 truncate">Sistema planetario</span>
          )}
          {viewMode === "explore" && (
            <span className="text-slatex-300 truncate">
              {activeBody.shortName}
            </span>
          )}
          {viewMode === "compare" && (
            <span className="text-slatex-300 truncate">
              {activeBody.shortName}{" "}
              <span className="text-slatex-500 mx-1">/</span>{" "}
              <span className="text-mint-300">Comparación</span>
            </span>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 bg-space-850/70 px-2 py-1 rounded-xl border border-space-600/50">
        {[
          { id: "luna", label: "Luna" },
          { id: "marte", label: "Marte" },
          { id: "tierra", label: "Tierra" },
        ].map((b, idx) => {
          const isActive = viewMode !== "system" && activeBodyId === b.id;
          return (
            <Fragment key={b.id}>
              {idx > 0 && (
                <span className="h-3.5 w-[1px] bg-space-600/80 mx-1" />
              )}
              <button
                onClick={() => handleNavigateBody(b.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-mint-400/15 text-mint-300"
                    : "text-slatex-300 hover:text-white hover:bg-space-700/60"
                }`}
              >
                {b.label}
              </button>
            </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-2.5 w-44 sm:w-64 px-3.5 py-1.5 rounded-xl bg-space-850/90 border border-space-600/70 hover:border-mint-400/50 text-xs text-slatex-400 transition-all"
        >
          <svg
            className="w-3.5 h-3.5 text-slatex-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="truncate">Buscar en el explorador</span>
        </button>

        <button
          onClick={() => setIsConfigOpen(true)}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-400/12 hover:bg-mint-400/20 border border-mint-400/25 text-[10px] font-bold tracking-wider text-mint-300 uppercase transition-colors"
          title="Ver fuentes de datos orbitales NASA y satelitales"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-mint-400" />
          EXPLORADOR 3D
        </button>
      </div>
    </header>
  );
}
