import { useEffect, useState } from "react";
import { CheckCircle2, Navigation, Radio } from "lucide-react";
import type { Animal } from "../../lib/hydra-types";
import "./tag-tracker-demo.css";

const distances = [120, 85, 48, 20, 5];

export function TagTrackerDemo({ animals }: { animals: Animal[] }) {
  const [tag, setTag] = useState("530");
  const animal = animals.find((item) => item.electronicId?.trim() === tag || item.identification.trim() === tag);
  const [step, setStep] = useState<number | null>(null);
  const running = step !== null && step < distances.length - 1;
  const found = step === distances.length - 1;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setStep((current) => current === null ? null : current + 1), 900);
    return () => window.clearTimeout(timer);
  }, [step, running]);

  return <section className="tag-tracker-demo" aria-label="Rastreador demonstrativo">
    <header><Radio size={20} /><strong>Encontrar {animal?.name || `animal da tag ${tag}`}</strong><small>Modo demonstração</small></header>
    <p>Distância e direção fictícias para demonstrar a busca do animal.</p>
    <div className="tag-tracker-choices" role="group" aria-label="Escolher tag">
      {["530", "529", "528"].map((value) => <button key={value} type="button" aria-pressed={tag === value} onClick={() => { setTag(value); setStep(null); }}>Tag {value}</button>)}
    </div>
    {step !== null && <>
      <div className={`tag-tracker-radar ${running ? "is-searching" : ""}`} aria-hidden="true">
        <span /><span /><Navigation size={36} /><i style={{ transform: `translate(${70 - step * 15}px, ${-65 + step * 14}px)` }} />
      </div>
      <div className="tag-tracker-reading" role="status" aria-live="polite">
        <strong>{distances[step]} m</strong>
        <span>{found ? <><CheckCircle2 size={20} /> Animal encontrado na simulação</> : "Sinal simulado · direção nordeste"}</span>
      </div>
    </>}
    <button className="primary-button full" type="button" onClick={() => setStep(running ? null : 0)}>
      {running ? "Cancelar busca" : found ? "Simular novamente" : "Simular localização"}
    </button>
  </section>;
}
