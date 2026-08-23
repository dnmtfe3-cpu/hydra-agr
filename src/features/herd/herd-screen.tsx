import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Camera, ChevronRight, Beef as Cow, Filter, History, LoaderCircle, Nfc, Pencil, Plus, Search, Sprout, Trash2, Weight } from "lucide-react";
import { ConfirmDialog, EmptyState, Field, LoadingButton, Modal, ScreenHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type Animal, type AnimalHistoryEntry, type HydraAccount, type UpdateAccount } from "../../lib/hydra-types";
import { AnimalPublicShare } from "./animal-public-share";
import { HerdCareGuide } from "./herd-care-guide";
import { HerdHealthTools } from "./herd-health-tools";
import { HerdProductionTools } from "./herd-production-tools";
import { HerdReproductionTools } from "./herd-reproduction-tools";

type Props = {
  account: HydraAccount;
  updateAccount: UpdateAccount;
  openNfc: (animalId?: string) => void;
  focusAnimalId?: string;
  createRequest?: number;
  onRequestHandled?: () => void;
  saveAnimalPhoto: (animalId: string, file?: File) => Promise<boolean>;
};

const blankAnimal = { identification: "", name: "", species: "Bovino", breed: "", sex: "", birthDate: "", weight: "", status: "Ativo", electronicId: "", notes: "" };
const today = () => new Date().toISOString().slice(0, 10);

function formFromAnimal(animal: Animal) {
  return { identification: animal.identification, name: animal.name || "", species: animal.species, breed: animal.breed || "", sex: animal.sex || "", birthDate: animal.birthDate || "", weight: animal.weight?.toString() || "", status: animal.status, electronicId: animal.electronicId || "", notes: animal.notes || "" };
}

function weightHistory(animal: Animal) {
  const entries = (animal.history ?? [])
    .filter((entry) => typeof entry.weight === "number" && Number.isFinite(entry.weight) && entry.weight > 0)
    .slice()
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  if (entries.length === 0 && animal.weight) {
    return [{ id: "current-weight", date: new Date().toISOString(), type: "Peso atual", description: "Último peso informado", weight: animal.weight } satisfies AnimalHistoryEntry];
  }
  return entries;
}

export function HerdScreen({ account, updateAccount, openNfc, focusAnimalId, saveAnimalPhoto, createRequest, onRequestHandled }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [careOpen, setCareOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [animal, setAnimal] = useState(blankAnimal);
  const [weightDraft, setWeightDraft] = useState({ date: today(), weight: "", note: "" });
  const [error, setError] = useState("");
  const [weightError, setWeightError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Animal | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const selected = account.animals.find((item) => item.id === selectedId) ?? null;

  useEffect(() => { if (focusAnimalId) setSelectedId(focusAnimalId); }, [focusAnimalId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return account.animals.filter((item) => {
      const matchesSearch = !term || [item.identification, item.name, item.species, item.breed, item.electronicId].filter(Boolean).some((value) => value!.toLocaleLowerCase("pt-BR").includes(term));
      const matchesFilter = filter === "Todos" || item.species === filter || (filter === "Identificados" && Boolean(item.electronicId));
      return matchesSearch && matchesFilter;
    });
  }, [account.animals, filter, search]);

  function openCreate() {
    setEditingId(undefined);
    setAnimal(blankAnimal);
    setError("");
    setFormOpen(true);
  }

  useEffect(() => { if (createRequest !== undefined) { openCreate(); onRequestHandled?.(); } }, [createRequest]);

  function openEdit(item: Animal) {
    setEditingId(item.id);
    setAnimal(formFromAnimal(item));
    setError("");
    setSelectedId(undefined);
    setFormOpen(true);
  }

  function openWeight(item: Animal) {
    setWeightDraft({ date: today(), weight: item.weight?.toString() ?? "", note: "" });
    setWeightError("");
    setWeightOpen(true);
  }

  async function saveAnimal(event: FormEvent) {
    event.preventDefault();
    if (!animal.identification.trim()) {
      setError("Informe a identificação do animal.");
      return;
    }
    const duplicate = account.animals.some((item) => item.id !== editingId && item.identification.toLowerCase() === animal.identification.trim().toLowerCase());
    if (duplicate) {
      setError("Já existe um animal com esta identificação.");
      return;
    }
    const duplicateTag = animal.electronicId.trim() && account.animals.some((item) => item.id !== editingId && item.electronicId?.toLowerCase() === animal.electronicId.trim().toLowerCase());
    if (duplicateTag) {
      setError("Esta identificação eletrônica já está vinculada a outro animal.");
      return;
    }
    const weight = animal.weight ? Number(animal.weight.replace(",", ".")) : undefined;
    const item: Animal = {
      id: editingId ?? makeId("animal"), identification: animal.identification.trim(), name: animal.name.trim() || undefined, species: animal.species, breed: animal.breed.trim() || undefined, sex: animal.sex || undefined, birthDate: animal.birthDate || undefined, weight: Number.isFinite(weight) ? weight : undefined, status: animal.status, electronicId: animal.electronicId.trim() || undefined, notes: animal.notes.trim() || undefined,
    };
    setSaving(true);
    setError("");
    try {
      await updateAccount((current) => {
        if (!editingId) {
          const history: AnimalHistoryEntry[] = [{ id: makeId("history"), date: new Date().toISOString(), type: "Cadastro", description: "Ficha criada no Hydra Agro" }];
          if (item.weight) history.push({ id: makeId("history"), date: new Date().toISOString(), type: "Pesagem", description: `Peso inicial registrado: ${item.weight} kg`, weight: item.weight });
          return { ...current, animals: [{ ...item, history }, ...current.animals] };
        }
        return {
          ...current,
          animals: current.animals.map((existing) => {
            if (existing.id !== editingId) return existing;
            const history: AnimalHistoryEntry[] = [...(existing.history ?? []), { id: makeId("history"), date: new Date().toISOString(), type: "Edição", description: "Dados da ficha atualizados" }];
            if (item.weight && item.weight !== existing.weight) history.push({ id: makeId("history"), date: new Date().toISOString(), type: "Pesagem", description: `Peso atualizado para ${item.weight} kg`, weight: item.weight });
            return { ...existing, ...item, history };
          }),
        };
      }, { requireRemote: true });
      showAppToast(editingId ? "Animal atualizado com sucesso" : "Animal cadastrado com sucesso");
      setAnimal(blankAnimal);
      setEditingId(undefined);
      setFormOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o animal.");
    } finally {
      setSaving(false);
    }
  }

  async function saveWeight(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const parsed = Number(weightDraft.weight.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setWeightError("Informe um peso válido maior que zero.");
      return;
    }
    if (!weightDraft.date) {
      setWeightError("Informe a data da pesagem.");
      return;
    }
    setWeightSaving(true);
    setWeightError("");
    try {
      const note = weightDraft.note.trim();
      const entry: AnimalHistoryEntry = {
        id: makeId("history"),
        date: `${weightDraft.date}T12:00:00`,
        type: "Pesagem",
        description: note ? `Peso registrado: ${parsed} kg · ${note}` : `Peso registrado: ${parsed} kg`,
        weight: parsed,
      };
      await updateAccount((current) => ({
        ...current,
        animals: current.animals.map((item) => item.id === selected.id ? { ...item, weight: parsed, history: [...(item.history ?? []), entry] } : item),
      }), { requireRemote: true });
      setWeightOpen(false);
      setWeightDraft({ date: today(), weight: "", note: "" });
      showAppToast("Pesagem registrada no histórico");
    } catch (caught) {
      setWeightError(caught instanceof Error ? caught.message : "Não foi possível registrar a pesagem.");
    } finally {
      setWeightSaving(false);
    }
  }

  async function removeAnimal(item: Animal) {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await updateAccount((current) => ({ ...current, animals: current.animals.filter((animalItem) => animalItem.id !== item.id), activities: current.activities.map((activity) => activity.animalId === item.id ? { ...activity, animalId: undefined } : activity) }), { requireRemote: true });
      setSelectedId(undefined);
      setDeleteTarget(null);
      showAppToast("Animal excluído com sucesso");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Não foi possível excluir o animal.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function setPhoto(file?: File) {
    if (!selected) return;
    setPhotoBusy(true);
    setError("");
    try { if (await saveAnimalPhoto(selected.id, file)) showAppToast("Foto do animal atualizada"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar a foto."); }
    finally { setPhotoBusy(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  return (
    <div className="screen page-enter">
      <ScreenHeader eyebrow="GESTÃO ANIMAL" title="Rebanho" subtitle={account.animals.length === 1 ? "1 animal cadastrado" : `${account.animals.length} animais cadastrados`} action={<button className="icon-button accent" onClick={openCreate} aria-label="Cadastrar animal"><Plus size={21} /></button>} />

      <div className="search-row"><label className="search-box"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, código, raça ou tag" /></label><button className={`filter-button ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen((value) => !value)} aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}><Filter size={19} /></button></div>
      {filtersOpen && <div className="filter-chips">{["Todos", "Bovino", "Caprino", "Ovino", "Equino", "Identificados"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>}

      <button className="nfc-inline-card" onClick={() => openNfc()}><span><Nfc size={23} /></span><div><strong>Localizar por NFC/RFID</strong><small>Aproxime uma tag compatível ou digite o código.</small></div><ChevronRight size={19} /></button>
      <button className="herd-care-launch" onClick={() => setCareOpen(true)}><span><Sprout size={23} /></span><div><strong>Alimentação e manejo</strong><small>Dicas de alimentação, habitat, bem-estar, saúde e uso sustentável por espécie.</small></div><ChevronRight size={19} /></button>

      <HerdProductionTools account={account} updateAccount={updateAccount} />
      <HerdReproductionTools account={account} updateAccount={updateAccount} />
      <HerdHealthTools account={account} />

      {account.animals.length === 0 ? <EmptyState icon={<Cow size={27} />} title="Nenhum animal cadastrado" text="Crie a primeira ficha do rebanho sem preencher dados inventados." action={<button className="primary-button" onClick={openCreate}><Plus size={17} /> Cadastrar animal</button>} /> : filtered.length === 0 ? <EmptyState icon={<Search size={25} />} title="Nenhum resultado" text="Tente outro termo ou remova o filtro." /> : <div className="animal-list">{filtered.map((item) => <button key={item.id} className="animal-card" onClick={() => setSelectedId(item.id)}>{item.photoUrl ? <img className="animal-avatar image" src={item.photoUrl} alt={`Foto de ${item.name || item.identification}`} /> : <span className="animal-avatar"><Cow size={25} /></span>}<div className="animal-copy"><span className="animal-code">{item.identification}</span><strong>{item.name || "Animal sem nome"}</strong><small>{[item.species, item.breed, item.sex].filter(Boolean).join(" · ")}</small></div><div className="animal-side">{item.electronicId && <span className="tag-badge"><Nfc size={13} /> vinculado</span>}<ChevronRight size={19} /></div></button>)}</div>}

      <Modal open={careOpen} onClose={() => setCareOpen(false)} eyebrow="REBANHO" title="Alimentação e manejo" wide tall>
        <HerdCareGuide account={account} />
      </Modal>

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setError(""); }} eyebrow={editingId ? "EDIÇÃO" : "NOVA FICHA"} title={editingId ? "Editar animal" : "Cadastrar animal"} wide dismissible={!saving}>
        <form className="modal-form" onSubmit={saveAnimal}>
          <div className="field-combo"><Field label="Identificação"><input value={animal.identification} onChange={(event) => { setAnimal({ ...animal, identification: event.target.value }); setError(""); }} placeholder="Ex.: BOV-001" autoFocus /></Field><Field label="Nome (opcional)"><input value={animal.name} onChange={(event) => setAnimal({ ...animal, name: event.target.value })} placeholder="Ex.: Estrela" /></Field></div>
          <div className="field-combo"><Field label="Espécie"><select value={animal.species} onChange={(event) => setAnimal({ ...animal, species: event.target.value })}>{["Bovino", "Caprino", "Ovino", "Equino", "Suíno", "Ave", "Outra"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Raça"><input value={animal.breed} onChange={(event) => setAnimal({ ...animal, breed: event.target.value })} placeholder="Informe se souber" /></Field></div>
          <div className="field-combo"><Field label="Sexo"><select value={animal.sex} onChange={(event) => setAnimal({ ...animal, sex: event.target.value })}><option value="">Não informado</option><option>Fêmea</option><option>Macho</option></select></Field><Field label="Nascimento"><input type="date" value={animal.birthDate} onChange={(event) => setAnimal({ ...animal, birthDate: event.target.value })} /></Field></div>
          <div className="field-combo"><Field label="Peso (kg)"><input inputMode="decimal" value={animal.weight} onChange={(event) => setAnimal({ ...animal, weight: event.target.value })} placeholder="0" /></Field><Field label="Situação"><select value={animal.status} onChange={(event) => setAnimal({ ...animal, status: event.target.value })}><option>Ativo</option><option>Em observação</option><option>Vendido</option><option>Baixa</option></select></Field></div>
          <Field label="Código NFC/RFID (opcional)" hint="Você também pode usar a Central NFC para ler uma tag real."><input value={animal.electronicId} onChange={(event) => setAnimal({ ...animal, electronicId: event.target.value })} placeholder="Digite o código da tag" /></Field>
          <Field label="Observações"><textarea value={animal.notes} onChange={(event) => setAnimal({ ...animal, notes: event.target.value })} placeholder="Histórico ou informações importantes" /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving} loadingLabel="Salvando animal...">{editingId ? "Confirmar alterações" : "Confirmar animal"}</LoadingButton></div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} onClose={() => { setSelectedId(undefined); setError(""); setWeightOpen(false); }} eyebrow="FICHA INDIVIDUAL" title={selected?.name || selected?.identification || "Animal"} dismissible={!photoBusy && !weightSaving}>
        {selected && <div className="animal-detail">
          <div className="animal-detail-hero">{selected.photoUrl ? <img src={selected.photoUrl} alt={`Foto de ${selected.name || selected.identification}`} /> : <span><Cow size={34} /></span>}<div><small>{selected.identification}</small><strong>{selected.name || "Animal sem nome"}</strong><em>{selected.status}</em></div></div>
          <div className="animal-photo-actions"><button className="secondary-button" onClick={() => void setPhoto()} disabled={photoBusy}>{photoBusy ? <LoaderCircle size={17} className="spin" /> : <Camera size={17} />} Câmera</button><button className="secondary-button" onClick={() => photoRef.current?.click()} disabled={photoBusy}>Galeria</button><input ref={photoRef} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void setPhoto(event.target.files?.[0])} /></div>
          <div className="detail-grid"><div><span>Espécie</span><strong>{selected.species}</strong></div><div><span>Raça</span><strong>{selected.breed || "Não informada"}</strong></div><div><span>Sexo</span><strong>{selected.sex || "Não informado"}</strong></div><div><span>Peso</span><strong>{selected.weight ? `${selected.weight} kg` : "Não informado"}</strong></div></div>
          <div className="detail-line">{selected.electronicId ? <BadgeCheck size={19} /> : <Nfc size={19} />}<div><span>Identificação eletrônica</span><strong>{selected.electronicId || "Não vinculada"}</strong></div></div>
          {selected.weight && <div className="detail-line"><Weight size={19} /><div><span>Último peso informado</span><strong>{selected.weight} kg</strong></div></div>}
          {selected.notes && <div className="detail-note">{selected.notes}</div>}

          <AnimalPublicShare animal={selected} />
          <WeightEvolution animal={selected} onAdd={() => openWeight(selected)} />

          {(selected.history?.length ?? 0) > 0 && <div className="animal-history animal-timeline"><h3><History size={17} /> Linha do tempo</h3>{selected.history!.slice().reverse().map((entry) => <div key={entry.id} className={entry.weight ? "is-weight" : ""}><span /><p><strong>{entry.type}</strong>{entry.description}{entry.weight && <b>{entry.weight} kg</b>}<small>{new Date(entry.date).toLocaleString("pt-BR")}</small></p></div>)}</div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="detail-actions three"><button className="secondary-button" onClick={() => openEdit(selected)}><Pencil size={17} /> Editar</button><button className="secondary-button" onClick={() => openNfc(selected.id)}><Nfc size={17} /> Vincular tag</button><button className="danger-button" onClick={() => { setDeleteError(""); setDeleteTarget(selected); }}><Trash2 size={17} /> Excluir</button></div>
        </div>}
      </Modal>

      <Modal open={weightOpen && Boolean(selected)} onClose={() => { setWeightOpen(false); setWeightError(""); }} eyebrow="PESAGEM" title="Registrar novo peso" dismissible={!weightSaving}>
        <form className="modal-form" onSubmit={saveWeight}>
          <div className="weight-modal-animal"><Weight size={22} /><span><strong>{selected?.name || selected?.identification}</strong><small>O registro entra automaticamente na linha do tempo.</small></span></div>
          <div className="field-combo"><Field label="Data"><input type="date" value={weightDraft.date} onChange={(event) => setWeightDraft({ ...weightDraft, date: event.target.value })} /></Field><Field label="Peso (kg)"><input inputMode="decimal" value={weightDraft.weight} onChange={(event) => { setWeightDraft({ ...weightDraft, weight: event.target.value }); setWeightError(""); }} placeholder="Ex.: 245" autoFocus /></Field></div>
          <Field label="Observação (opcional)"><textarea value={weightDraft.note} onChange={(event) => setWeightDraft({ ...weightDraft, note: event.target.value })} placeholder="Ex.: pesagem após manejo" /></Field>
          {weightError && <p className="form-error" role="alert">{weightError}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setWeightOpen(false)} disabled={weightSaving}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={weightSaving} loadingLabel="Registrando pesagem...">Registrar peso</LoadingButton></div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} title="Excluir animal?" text={`${deleteTarget?.name || deleteTarget?.identification || "Este animal"} e seu histórico serão removidos da conta. Atividades vinculadas perderão apenas a referência ao animal.`} confirmLabel="Confirmar exclusão" busy={deleteBusy} error={deleteError} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={() => deleteTarget ? removeAnimal(deleteTarget) : Promise.resolve()} />
    </div>
  );
}

function WeightEvolution({ animal, onAdd }: { animal: Animal; onAdd: () => void }) {
  const points = weightHistory(animal).slice(-6);
  const weights = points.map((entry) => entry.weight ?? 0);
  const max = Math.max(...weights, 1);
  const min = Math.min(...weights, max);
  const range = Math.max(max - min, 1);
  const first = weights[0] ?? 0;
  const last = weights[weights.length - 1] ?? 0;
  const delta = points.length > 1 ? last - first : 0;

  return (
    <section className="weight-evolution-card">
      <header><div><span>EVOLUÇÃO DO PESO</span><strong>{last ? `${last} kg` : "Sem pesagens"}</strong>{points.length > 1 && <small className={delta >= 0 ? "positive" : "negative"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1).replace(".0", "")} kg no período</small>}</div><button onClick={onAdd}><Plus size={16} /> Pesagem</button></header>
      {points.length > 0 ? <div className="weight-chart" role="img" aria-label="Gráfico da evolução do peso do animal">{points.map((entry) => { const height = points.length === 1 ? 68 : 30 + (((entry.weight ?? 0) - min) / range) * 62; return <div className="weight-chart-point" key={entry.id}><span className="weight-chart-value">{entry.weight} kg</span><i style={{ height: `${height}%` }} /><small>{new Date(entry.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></div>; })}</div> : <div className="weight-chart-empty"><Weight size={22} /><span><strong>Comece o histórico de pesagem</strong><small>Registre o peso para acompanhar a evolução deste animal.</small></span></div>}
    </section>
  );
}
