import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import GeoPendienteExperience from "../GeoPendienteExperience.jsx";
import TopographyLab from "../TopographyLab.jsx";
import { missions } from "../data/catalog.js";
import "./terrain-tools.css";

/**
 * «Conoce tu terreno» dentro del marco de Órbita. GeoPendiente (iframe) y el
 * laboratorio técnico permanecen montados: alternar entre ellos no reinicia
 * el analizador ni pierde sus resultados.
 */
export default function TerrainWorkspace({
  target,
  references,
  isVisible = true,
  returnLabel,
  onClose,
  onChangeMission,
}) {
  const { missionKey, sector, coordinates } = target;
  const [technical, setTechnical] = useState(false);
  const [labMounted, setLabMounted] = useState(false);
  const workspace = useRef(null);
  const reference = references.find((item) => item.mision === missionKey);
  const mission = {
    ...missions[missionKey],
    target: [
      reference?.latitud_centro_deg ?? missions[missionKey].target[0],
      reference?.longitud_centro_este_deg ?? missions[missionKey].target[1],
    ],
  };

  useEffect(() => {
    workspace.current?.scrollTo(0, 0);
  }, [technical, target.openedAt]);

  function openTechnical() {
    setLabMounted(true);
    setTechnical(true);
  }

  return (
    <div
      ref={workspace}
      className={`orbita-terrain-workspace ${missionKey}`}
      data-body={missionKey}
    >
      <div hidden={technical} className="o-panel">
        <GeoPendienteExperience
          target={target}
          scrollContainer={workspace}
          isVisible={isVisible && !technical}
          returnLabel={returnLabel}
          onClose={onClose}
          onOpenPrecision={openTechnical}
          onChangeMission={onChangeMission}
        />
      </div>
      {labMounted && (
        <div hidden={!technical} className="o-panel">
          <button className="gp-back" onClick={() => setTechnical(false)} type="button">
            <ArrowLeft size={16} aria-hidden="true" /> Volver a GeoPendiente
          </button>
          <TopographyLab
            missionKey={missionKey}
            mission={mission}
            sector={sector}
            coordinates={coordinates}
            reference={reference}
            onClose={() => setTechnical(false)}
          />
        </div>
      )}
    </div>
  );
}
