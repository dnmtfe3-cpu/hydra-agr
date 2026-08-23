import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, HeartPulse, Scale, Search, ShieldCheck, Stethoscope } from "lucide-react";
import { Modal } from "../../components/ui";
import type { HydraAccount } from "../../lib/hydra-types";
import "./herd-health-tools.css";

type Props = { account: HydraAccount };
type HealthView = "checkup" | "weight" | null;
type Urgency = "observe" | "attention" | "urgent";
type Condition = { name: string; kind: string; symptoms: string[]; urgency: Urgency; note: string };
type SpeciesHealth = { symptoms: string[]; conditions: Condition[]; weight: { range: string; note: string; checkpoints: string[] } };

const health: Record<string, SpeciesHealth> = {
  Bovino: {
    symptoms: ["Falta de apetite", "Febre", "Tosse", "Secreção nasal", "Diarreia", "Apatia", "Queda na produção de leite", "Úbere inchado ou dolorido", "Mancar", "Lesões na boca ou salivação excessiva"],
    conditions: [
      { name: "Doença respiratória bovina", kind: "Condição respiratória", symptoms: ["Febre", "Tosse", "Secreção nasal", "Apatia", "Falta de apetite"], urgency: "attention", note: "Sinais respiratórios podem ter várias causas e exigem avaliação do lote e do ambiente." },
      { name: "Mastite", kind: "Doença", symptoms: ["Queda na produção de leite", "Úbere inchado ou dolorido", "Febre", "Falta de apetite"], urgency: "attention", note: "A confirmação depende de exame do animal e, quando indicado, avaliação do leite." },
      { name: "Diarreia / enterite", kind: "Condição digestiva", symptoms: ["Diarreia", "Apatia", "Falta de apetite", "Febre"], urgency: "attention", note: "Desidratação e idade do animal mudam bastante a gravidade." },
      { name: "Parasitismo gastrointestinal", kind: "Doença parasitária", symptoms: ["Diarreia", "Apatia", "Falta de apetite"], urgency: "observe", note: "A suspeita deve ser confirmada com avaliação clínica e, quando indicado, exames." },
      { name: "BVD", kind: "Doença viral", symptoms: ["Febre", "Diarreia", "Falta de apetite", "Apatia"], urgency: "attention", note: "Os sinais são inespecíficos; confirmação é laboratorial." },
      { name: "IBR", kind: "Doença viral", symptoms: ["Febre", "Tosse", "Secreção nasal", "Falta de apetite"], urgency: "attention", note: "Precisa de avaliação veterinária e confirmação quando houver suspeita." },
      { name: "Suspeita de doença vesicular", kind: "Alerta sanitário", symptoms: ["Lesões na boca ou salivação excessiva", "Febre", "Mancar"], urgency: "urgent", note: "Evite movimentar o animal e procure orientação veterinária/sanitária imediatamente." },
    ],
    weight: { range: "Não existe um peso ideal único. Muitos bovinos adultos ficam aproximadamente entre 350 e 750 kg, mas raça, sexo e finalidade podem levar a valores bem menores ou maiores.", note: "No Hydra, o mais útil é acompanhar a evolução individual e a condição corporal, não perseguir um único número.", checkpoints: ["Compare com animais da mesma raça, sexo e idade.", "Observe crescimento ao longo do tempo, não apenas uma pesagem.", "Queda de peso sem explicação merece investigação."] },
  },
  Caprino: {
    symptoms: ["Falta de apetite", "Diarreia", "Apatia", "Tosse", "Secreção nasal", "Mucosa pálida", "Perda de peso", "Mancar", "Feridas nos lábios"],
    conditions: [
      { name: "Verminose", kind: "Doença parasitária", symptoms: ["Mucosa pálida", "Perda de peso", "Diarreia", "Apatia", "Falta de apetite"], urgency: "attention", note: "A confirmação pode exigir exame clínico e avaliação de fezes." },
      { name: "Pneumonia", kind: "Doença respiratória", symptoms: ["Tosse", "Secreção nasal", "Apatia", "Falta de apetite"], urgency: "attention", note: "Ventilação, umidade e lotação também devem ser avaliadas." },
      { name: "Pododermatite", kind: "Doença de casco", symptoms: ["Mancar", "Apatia"], urgency: "attention", note: "Casco e piso precisam ser examinados para diferenciar causas." },
      { name: "Ectima contagioso", kind: "Doença viral", symptoms: ["Feridas nos lábios", "Falta de apetite"], urgency: "attention", note: "Pode ser contagioso e também afetar pessoas; manuseie com proteção e procure orientação veterinária." },
    ],
    weight: { range: "Caprinos adultos frequentemente ficam na faixa de 30 a 80 kg; machos e raças maiores podem ultrapassar 100 kg.", note: "Raça, sexo, idade, gestação e finalidade produtiva mudam bastante a referência.", checkpoints: ["Acompanhe ganho ou perda de peso por período.", "Use condição corporal junto com a balança.", "Fêmeas prenhes não devem ser avaliadas apenas pelo peso total."] },
  },
  Ovino: {
    symptoms: ["Falta de apetite", "Diarreia", "Apatia", "Tosse", "Secreção nasal", "Mucosa pálida", "Perda de peso", "Mancar", "Feridas na boca"],
    conditions: [
      { name: "Verminose", kind: "Doença parasitária", symptoms: ["Mucosa pálida", "Perda de peso", "Diarreia", "Apatia"], urgency: "attention", note: "A avaliação do rebanho e exames ajudam a evitar tratamento sem necessidade." },
      { name: "Pneumonia", kind: "Doença respiratória", symptoms: ["Tosse", "Secreção nasal", "Apatia", "Falta de apetite"], urgency: "attention", note: "Ambiente, clima e lotação também influenciam." },
      { name: "Pododermatite", kind: "Doença de casco", symptoms: ["Mancar", "Apatia"], urgency: "attention", note: "O casco precisa ser examinado para confirmar a causa." },
      { name: "Ectima contagioso", kind: "Doença viral", symptoms: ["Feridas na boca", "Falta de apetite"], urgency: "attention", note: "É contagioso e exige cuidado no manejo." },
    ],
    weight: { range: "Ovinos adultos frequentemente ficam em torno de 40 a 90 kg; algumas raças e machos podem ultrapassar 100 kg.", note: "A condição corporal e a fase produtiva são tão importantes quanto o peso bruto.", checkpoints: ["Compare com raça, sexo e idade semelhantes.", "Observe lã, musculatura e condição corporal.", "Perda rápida de peso deve ser investigada."] },
  },
  Equino: {
    symptoms: ["Falta de apetite", "Apatia", "Tosse", "Secreção nasal", "Febre", "Mancar", "Dor abdominal / inquietação", "Suor excessivo", "Fraqueza"],
    conditions: [
      { name: "Cólica", kind: "Síndrome", symptoms: ["Dor abdominal / inquietação", "Suor excessivo", "Falta de apetite", "Apatia"], urgency: "urgent", note: "Dor abdominal em equinos pode piorar rapidamente e exige avaliação veterinária urgente." },
      { name: "Influenza equina", kind: "Doença viral", symptoms: ["Febre", "Tosse", "Secreção nasal", "Apatia", "Falta de apetite"], urgency: "attention", note: "Pode se espalhar rapidamente entre animais; confirmação depende de avaliação profissional." },
      { name: "Laminite / problema de casco", kind: "Condição locomotora", symptoms: ["Mancar", "Apatia", "Suor excessivo"], urgency: "urgent", note: "Alteração intensa de apoio ou dor nos cascos precisa de atendimento rápido." },
      { name: "Anemia infecciosa equina", kind: "Doença viral", symptoms: ["Febre", "Fraqueza", "Apatia", "Perda de peso"], urgency: "attention", note: "O diagnóstico é laboratorial e segue regras sanitárias específicas." },
    ],
    weight: { range: "Muitos cavalos adultos de sela ficam aproximadamente entre 350 e 600 kg. Pôneis podem pesar bem menos e animais de tração podem passar bastante dessa faixa.", note: "Raça, altura e condição corporal são indispensáveis para interpretar o peso.", checkpoints: ["Use fita de pesagem ou balança de forma consistente.", "Compare a tendência com a carga de trabalho e dieta.", "Mudança rápida de peso ou condição corporal pede avaliação."] },
  },
  "Suíno": {
    symptoms: ["Falta de apetite", "Febre", "Tosse", "Respiração difícil", "Diarreia", "Apatia", "Manchas na pele", "Perda de peso", "Problemas reprodutivos"],
    conditions: [
      { name: "Doença respiratória suína", kind: "Condição respiratória", symptoms: ["Tosse", "Respiração difícil", "Febre", "Apatia", "Falta de apetite"], urgency: "attention", note: "Há várias causas possíveis; lote, ventilação e biossegurança precisam ser avaliados." },
      { name: "Influenza suína", kind: "Doença viral", symptoms: ["Febre", "Tosse", "Respiração difícil", "Apatia", "Falta de apetite"], urgency: "attention", note: "A confirmação depende de avaliação e, quando indicado, teste laboratorial." },
      { name: "Circovirose suína", kind: "Doença viral", symptoms: ["Perda de peso", "Apatia", "Diarreia", "Respiração difícil"], urgency: "attention", note: "Os sinais se confundem com outras doenças e precisam de investigação." },
      { name: "Enterite / diarreia", kind: "Condição digestiva", symptoms: ["Diarreia", "Apatia", "Falta de apetite", "Febre"], urgency: "attention", note: "Leitões podem desidratar rapidamente." },
    ],
    weight: { range: "O peso muda muito com a fase: animais de crescimento, terminação e reprodutores têm referências diferentes. Adultos reprodutores podem passar de 200 kg.", note: "No suíno, idade e fase produtiva são essenciais para interpretar o peso.", checkpoints: ["Acompanhe ganho de peso por lote e idade.", "Compare consumo de ração com evolução do peso.", "Evite usar um peso adulto como meta para animais em crescimento."] },
  },
  Ave: {
    symptoms: ["Falta de apetite", "Apatia", "Respiração difícil", "Espirros / secreção", "Diarreia", "Queda na postura", "Penas arrepiadas", "Sinais neurológicos", "Mortalidade aumentada"],
    conditions: [
      { name: "Bronquite infecciosa", kind: "Doença viral", symptoms: ["Espirros / secreção", "Respiração difícil", "Queda na postura", "Apatia"], urgency: "attention", note: "É necessária avaliação do lote para diferenciar de outras doenças respiratórias." },
      { name: "Doença de Newcastle", kind: "Doença viral", symptoms: ["Respiração difícil", "Sinais neurológicos", "Queda na postura", "Mortalidade aumentada", "Apatia"], urgency: "urgent", note: "Suspeitas importantes exigem orientação veterinária e sanitária rápida." },
      { name: "Coccidiose", kind: "Doença parasitária", symptoms: ["Diarreia", "Apatia", "Penas arrepiadas", "Falta de apetite"], urgency: "attention", note: "Idade, cama e manejo ajudam na investigação." },
      { name: "Doença respiratória do lote", kind: "Condição respiratória", symptoms: ["Espirros / secreção", "Respiração difícil", "Apatia", "Falta de apetite"], urgency: "attention", note: "Ventilação, poeira e agentes infecciosos podem produzir sinais semelhantes." },
    ],
    weight: { range: "Em aves não há uma faixa única: uma galinha adulta comum pode pesar cerca de 1,5 a 4 kg, enquanto outras espécies e linhagens variam muito.", note: "Espécie, linhagem, sexo e finalidade são obrigatórios para uma referência útil.", checkpoints: ["Compare aves da mesma linhagem e idade.", "Acompanhe uniformidade do lote.", "Queda de peso acompanhada de redução de consumo deve ser investigada."] },
  },
  Outra: {
    symptoms: ["Falta de apetite", "Apatia", "Febre", "Diarreia", "Tosse", "Respiração difícil", "Mancar", "Perda de peso", "Alteração de pele", "Mudança de comportamento"],
    conditions: [
      { name: "Alteração digestiva", kind: "Possibilidade", symptoms: ["Diarreia", "Falta de apetite", "Apatia", "Perda de peso"], urgency: "attention", note: "A espécie precisa ser identificada para uma triagem mais específica." },
      { name: "Alteração respiratória", kind: "Possibilidade", symptoms: ["Tosse", "Respiração difícil", "Febre", "Apatia"], urgency: "attention", note: "Procure avaliação profissional para identificar a causa." },
      { name: "Alteração locomotora", kind: "Possibilidade", symptoms: ["Mancar", "Apatia", "Mudança de comportamento"], urgency: "attention", note: "Lesão, casco, articulação e outras causas precisam ser diferenciadas." },
    ],
    weight: { range: "Não há uma referência segura sem identificar a espécie, raça, idade e sexo.", note: "Cadastre esses dados para acompanhar o peso de forma útil.", checkpoints: ["Use sempre a mesma unidade e método de pesagem.", "Observe tendência ao longo do tempo.", "Mudança inesperada deve ser investigada por profissional."] },
  },
};

function ToolCard({ icon, title, text, value, onClick }: { icon: ReactNode; title: string; text: string; value: string; onClick: () => void }) {
  return <button className="herd-health-card" type="button" onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div><b>{value}</b><ChevronRight size={18} /></button>;
}

export function HerdHealthTools({ account }: Props) {
  const [open, setOpen] = useState<HealthView>(null);
  const availableSpecies = useMemo(() => {
    const found = Array.from(new Set(account.animals.map((animal) => animal.species))).filter((name) => health[name]);
    return found.length ? found : Object.keys(health);
  }, [account.animals]);
  const [species, setSpecies] = useState(availableSpecies[0] || "Bovino");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const guide = health[species] || health.Outra;
  const weights = account.animals.filter((animal) => animal.species === species && animal.weight).map((animal) => animal.weight as number);

  const matches = useMemo(() => guide.conditions.map((condition) => {
    const hits = condition.symptoms.filter((symptom) => selectedSymptoms.includes(symptom)).length;
    const score = selectedSymptoms.length ? Math.round((hits / Math.max(condition.symptoms.length, 1)) * 100) : 0;
    return { ...condition, hits, score };
  }).filter((item) => item.hits > 0).sort((a, b) => b.hits - a.hits || b.score - a.score).slice(0, 4), [guide, selectedSymptoms]);

  function changeSpecies(next: string) {
    setSpecies(next);
    setSelectedSymptoms([]);
  }

  function toggleSymptom(symptom: string) {
    setSelectedSymptoms((current) => current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]);
  }

  return <>
    <section className="herd-health-tools">
      <header><div><span>SAÚDE DO REBANHO</span><h2>Check-up e peso</h2><p>Triagem por sintomas e referências gerais para acompanhar o desenvolvimento.</p></div><HeartPulse size={22} /></header>
      <div className="herd-health-grid">
        <ToolCard icon={<Stethoscope size={21} />} title="Check-up" text="Selecione sintomas e veja o que merece investigação" value="Triagem" onClick={() => setOpen("checkup")} />
        <ToolCard icon={<Scale size={21} />} title="Peso e condição" text="Referências por espécie e histórico cadastrado" value={weights.length ? `${weights.length} pesagens` : "Referência"} onClick={() => setOpen("weight")} />
      </div>
    </section>

    <Modal open={open === "checkup"} onClose={() => setOpen(null)} eyebrow="SAÚDE ANIMAL" title="Check-up do rebanho" wide tall>
      <div className="herd-checkup">
        <div className="herd-checkup-warning"><ShieldCheck size={19} /><p><strong>Triagem, não diagnóstico</strong><small>Os sintomas ajudam a organizar possibilidades comuns. A confirmação depende de exame veterinário e, em algumas doenças, testes laboratoriais.</small></p></div>
        <div className="herd-health-species">{availableSpecies.map((name) => <button key={name} className={species === name ? "active" : ""} onClick={() => changeSpecies(name)}>{name}</button>)}</div>
        <section className="herd-checkup-step"><div className="herd-checkup-title"><Search size={18} /><div><strong>O que você observou?</strong><small>Marque todos os sinais presentes no animal.</small></div></div><div className="herd-symptom-grid">{guide.symptoms.map((symptom) => <button type="button" key={symptom} className={selectedSymptoms.includes(symptom) ? "active" : ""} onClick={() => toggleSymptom(symptom)}>{selectedSymptoms.includes(symptom) ? <CheckCircle2 size={16} /> : <span />}{symptom}</button>)}</div></section>
        <section className="herd-checkup-result"><div className="herd-checkup-title"><Stethoscope size={18} /><div><strong>Resultado da triagem</strong><small>{selectedSymptoms.length ? `${selectedSymptoms.length} sintoma(s) selecionado(s)` : "Selecione sintomas para comparar"}</small></div></div>{!selectedSymptoms.length ? <p className="herd-health-empty">Nenhum sintoma selecionado.</p> : matches.length ? <div className="herd-match-list">{matches.map((item) => <article key={item.name} className={`urgency-${item.urgency}`}><span>{item.urgency === "urgent" ? <AlertTriangle size={18} /> : <HeartPulse size={18} />}</span><div><small>{item.kind}</small><strong>{item.name}</strong><p>{item.note}</p></div><b>{item.hits} compatível(is)</b></article>)}</div> : <p className="herd-health-empty">Os sintomas selecionados não formam um padrão específico nesta referência. Registre as observações e procure avaliação veterinária se persistirem.</p>}</section>
        <p className="herd-checkup-footer">Sinais intensos, dificuldade para respirar, incapacidade de ficar em pé, dor forte, sintomas neurológicos, mortalidade aumentada ou suspeita de doença contagiosa exigem atendimento veterinário rápido. O Hydra não recomenda medicamentos ou doses a partir deste check-up.</p>
      </div>
    </Modal>

    <Modal open={open === "weight"} onClose={() => setOpen(null)} eyebrow="DESENVOLVIMENTO" title="Peso e condição corporal" wide>
      <div className="herd-weight-reference">
        <div className="herd-health-species">{availableSpecies.map((name) => <button key={name} className={species === name ? "active" : ""} onClick={() => changeSpecies(name)}>{name}</button>)}</div>
        <section className="herd-weight-reference-main"><Scale size={27} /><div><span>REFERÊNCIA GERAL · {species.toUpperCase()}</span><h3>{guide.weight.range}</h3><p>{guide.weight.note}</p></div></section>
        <div className="herd-weight-checkpoints">{guide.weight.checkpoints.map((item) => <div key={item}><CheckCircle2 size={17} /><span>{item}</span></div>)}</div>
        {weights.length > 0 && <div className="herd-weight-current"><strong>Pesos cadastrados nesta espécie</strong><div>{account.animals.filter((animal) => animal.species === species && animal.weight).slice(0, 8).map((animal) => <span key={animal.id}><b>{animal.name || animal.identification}</b>{animal.weight} kg</span>)}</div></div>}
        <p className="herd-checkup-footer">Essas faixas são apenas referências amplas. Raça, sexo, idade, gestação, manejo e finalidade produtiva mudam o peso esperado; use o histórico individual e orientação técnica para definir metas.</p>
      </div>
    </Modal>
  </>;
}
