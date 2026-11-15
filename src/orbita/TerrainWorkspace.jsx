import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import GeoPendienteExperience from "../GeoPendienteExperience.jsx";
import TopographyLab from "../TopographyLab.jsx";
import { missions } from "../data/catalog.js";
import "./terrain-tools.css";

export default function TerrainWorkspace({ target, references, onClose }) {
  const { missionKey, sector, coordinates } = target;
  const [technical, setTechnical] = useState(false);
  const workspace = useRef(null);
  const reference = references.find((item) => item.mision === missionKey);
  const mission = {
    ...missions[missionKey],
    target: [reference?.latitud_centro_deg ?? missions[missionKey].target[0],
      reference?.longitud_centro_este_deg ?? missions[missionKey].target[1]],
  };

  useEffect(() => {
    workspace.current?.scrollTo(0, 0);
  }, [technical]);

  return (
    <main ref={workspace} className={`orbita-terrain-workspace ${missionKey}`}>
      {technical ? (
        <>
          <button className="geostudio-back" onClick={onClose} type="button">
            <ArrowLeft size={16} /> Volver a Órbita
          </button>
          <TopographyLab
            missionKey={missionKey}
            mission={mission}
            sector={sector}
            coordinates={coordinates}
            reference={reference}
            onClose={() => setTechnical(false)}
          />
        </>
      ) : (
        <GeoPendienteExperience
          missionKey={missionKey}
          sector={sector}
          coordinates={coordinates}
          scrollContainer={workspace}
          onClose={onClose}
          onOpenPrecision={() => setTechnical(true)}
        />
      )}
    </main>
  );
}
