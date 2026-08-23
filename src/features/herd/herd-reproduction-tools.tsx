import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Baby, CalendarDays, ChevronRight, Dna, Plus, Stethoscope } from "lucide-react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type HydraAccount, type UpdateAccount } from "../../lib/hydra-types";
import "./herd-reproduction-tools.css";

type Props = { account: HydraAccount; updateAccount: UpdateAccount };
type Tool = "pregnancy" | "insemination" | null;

const PREFIX = {
  pregnancy: "HYDRA_PREGNANCY",
  insemination: "HYDRA_INSEMINATION",
} as const;

const today = () => new Date().toISOString().slice(0, 10);
const tagged = (prefix: string, text?: string) => text?.startsWith(`${prefix}|`) ?? false;
const encode = (prefix: string, parts: Record<string, string>) => `${prefix}|${Object.entries(parts).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("|")}`;
const decode = (value?: string) => Object.fromEntries((value || "").split("|").slice(1).map((part) => { const at = part.indexOf("="); return at < 0 ? [part, ""] : [part.slice(0, at), decodeURIComponent(part.slice(at + 1))]; }));

function ToolCard({ icon, title, text, value, onClick }: { icon: ReactNode; title: string; text: string; value: string; onClick: () => void }) {
  return <button className="herd-reproduction-card" type="button" onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div><b>{value}</b><ChevronRight size={18} /></button>;
}

export function HerdReproductionTools({ account, updateAccount }: Props) {
  const [open, setOpen] = useState<Tool>(null);
  const pregnancies = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.pregnancy, item.note)), [account.monitoring]);
  const inseminations = useMemo(() => account.monitoring.filter((item) => tagged(PREFIX.insemination, item.note)), [account.monitoring]);
  const females = account.animals.filter((animal) => animal.sex?.toLocaleLowerCase("pt-BR") === "fêmea");
  const reproductiveAnimals = females.length ? females : account.animals.filter((animal) => animal.sex !== "Macho");
  const activePregnancies = pregnancies.filter((item) => {
    const status = decode(item.note).status;
    return status === "Confirmada" || status === "Em acompanhamento";
  });
  const pendingInseminations = inseminations.filter((item) => decode(item.note).result === "Aguardando confirmação").length;

  async function addPregnancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const animalId = String(form.get("animalId") || "");
    const status = String(form.get("status") || "Confirmada");
    if (!animalId) return;
    const animal = account.animals.find((item) => item.id === animalId);
    if (!animal) return;
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("pregnancy"),
        date: String(form.get("date") || today()),
        type: "Acompanhamento reprodutivo",
        note: encode(PREFIX.pregnancy, {
          animalId,
          animal: animal.name || animal.identification,
          status,
          method: String(form.get("method") || "Não informado"),
          expectedBirth: String(form.get("expectedBirth") || ""),
          responsible: String(form.get("responsible") || account.profile.name).trim(),
          notes: String(form.get("notes") || "").trim(),
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    showAppToast("Acompanhamento de prenhez salvo");
    setOpen(null);
  }

  async function addInsemination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const animalId = String(form.get("animalId") || "");
    if (!animalId) return;
    const animal = account.animals.find((item) => item.id === animalId);
    if (!animal) return;
    await updateAccount((current) => ({
      ...current,
      monitoring: [{
        id: makeId("insemination"),
        date: String(form.get("date") || today()),
        type: "Inseminação artificial",
        note: encode(PREFIX.insemination, {
          animalId,
          animal: animal.name || animal.identification,
          semen: String(form.get("semen") || "").trim(),
          technician: String(form.get("technician") || account.profile.name).trim(),
          result: String(form.get("result") || "Aguardando confirmação"),
          checkDate: String(form.get("checkDate") || ""),
          notes: String(form.get("notes") || "").trim(),
        }),
      }, ...current.monitoring],
    }), { requireRemote: true });
    showAppToast("Inseminação registrada");
    setOpen(null);
  }

  return <>
    <section className="herd-reproduction-tools">
      <header><div><span>REPRODUÇÃO</span><h2>Prenhez e inseminação</h2><p>Acompanhe matrizes, confirmações e registros reprodutivos sem misturar com a ficha geral.</p></div><Dna size={22} /></header>
      <div className="herd-reproduction-grid">
        <ToolCard icon={<Baby size={21} />} title="Animais prenhes" text="Confirmação, acompanhamento e previsão" value={`${activePregnancies.length} em acompanhamento`} onClick={() => setOpen("pregnancy")} />
        <ToolCard icon={<Stethoscope size={21} />} title="Inseminação artificial" text="Data, sêmen/touro, responsável e retorno" value={pendingInseminations ? `${pendingInseminations} aguardando` : `${inseminations.length} registros`} onClick={() => setOpen("insemination")} />
      </div>
    </section>

    <Modal open={open === "pregnancy"} onClose={() => setOpen(null)} eyebrow="REPRODUÇÃO" title="Animais prenhes" wide>
      <div className="herd-reproduction-modal">
        <div className="herd-reproduction-list">{pregnancies.length ? pregnancies.map((item) => { const meta = decode(item.note); return <article key={item.id}><span><Baby size={18} /></span><div><strong>{meta.animal || "Animal"}</strong><small>{meta.status} · registro em {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}{meta.expectedBirth ? ` · previsão ${new Date(`${meta.expectedBirth}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</small></div><b>{meta.method || "Prenhez"}</b></article>; }) : <p className="herd-reproduction-empty">Nenhuma prenhez registrada.</p>}</div>
        <form className="herd-reproduction-form" onSubmit={addPregnancy}><h3><Plus size={17} /> Registrar prenhez</h3><label>Animal<select name="animalId" required defaultValue=""><option value="" disabled>Selecione</option>{reproductiveAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name || animal.identification} · {animal.species}</option>)}</select></label><div><label>Data da avaliação<input name="date" type="date" defaultValue={today()} required /></label><label>Status<select name="status"><option>Confirmada</option><option>Em acompanhamento</option><option>Suspeita</option><option>Finalizada</option></select></label></div><div><label>Origem<select name="method"><option>Não informado</option><option>Monta natural</option><option>Inseminação artificial</option><option>Transferência de embrião</option></select></label><label>Previsão de parto<input name="expectedBirth" type="date" /></label></div><label>Responsável<input name="responsible" defaultValue={account.profile.name} /></label><label>Observações<textarea name="notes" placeholder="Exames realizados, condição da matriz, retorno recomendado..." /></label><button className="primary-button" type="submit">Salvar acompanhamento</button><small className="herd-reproduction-note">A confirmação de prenhez e a previsão de parto devem seguir avaliação profissional. O Hydra apenas organiza o acompanhamento informado.</small></form>
      </div>
    </Modal>

    <Modal open={open === "insemination"} onClose={() => setOpen(null)} eyebrow="REPRODUÇÃO" title="Inseminação artificial" wide>
      <div className="herd-reproduction-modal">
        <div className="herd-reproduction-list">{inseminations.length ? inseminations.map((item) => { const meta = decode(item.note); return <article key={item.id}><span><CalendarDays size={18} /></span><div><strong>{meta.animal || "Animal"}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")} · {meta.semen || "Sêmen/touro não informado"}{meta.checkDate ? ` · retorno ${new Date(`${meta.checkDate}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</small></div><b>{meta.result || "Registrada"}</b></article>; }) : <p className="herd-reproduction-empty">Nenhuma inseminação registrada.</p>}</div>
        <form className="herd-reproduction-form" onSubmit={addInsemination}><h3><Plus size={17} /> Nova inseminação</h3><label>Animal<select name="animalId" required defaultValue=""><option value="" disabled>Selecione</option>{reproductiveAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name || animal.identification} · {animal.species}</option>)}</select></label><div><label>Data<input name="date" type="date" defaultValue={today()} required /></label><label>Retorno / confirmação<input name="checkDate" type="date" /></label></div><label>Identificação do sêmen / touro<input name="semen" placeholder="Código, nome ou lote" /></label><label>Responsável / técnico<input name="technician" defaultValue={account.profile.name} /></label><label>Resultado<select name="result"><option>Aguardando confirmação</option><option>Prenhez confirmada</option><option>Não confirmada</option><option>Repetir avaliação</option></select></label><label>Observações<textarea name="notes" placeholder="Informações do procedimento e acompanhamento" /></label><button className="primary-button" type="submit">Salvar inseminação</button><small className="herd-reproduction-note">Protocolos hormonais, medicamentos, doses e execução do procedimento devem ser definidos e realizados por profissional habilitado.</small></form>
      </div>
    </Modal>
  </>;
}
