"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  ChevronRight,
  Clock3,
  LayoutGrid,
  MapPin,
  LoaderCircle,
  Pencil,
  Plus,
  RadioTower,
  Trash2,
} from "lucide-react";
import { ConfirmDialog, EmptyState, Field, LoadingButton, Modal, ScreenHeader, SectionHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type HydraAccount, type MonitoringRecord, type Sector, type UpdateAccount } from "../../lib/hydra-types";

type Props = {
  account: HydraAccount;
  updateAccount: UpdateAccount;
  saveMonitoringPhoto: (recordId: string, file?: File) => Promise<boolean>;
  createSectorRequest?: number;
  onRequestHandled?: () => void;
};

export function MonitorScreen({ account, updateAccount, saveMonitoringPhoto, createSectorRequest, onRequestHandled }: Props) {
  const [tab, setTab] = useState<"sectors" | "history">("sectors");
  const [sectorOpen, setSectorOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [selectedMonitoringId, setSelectedMonitoringId] = useState<string>();
  const [editingSectorId, setEditingSectorId] = useState<string>();
  const [sector, setSector] = useState({ name: "", kind: "Pasto", note: "" });
  const [record, setRecord] = useState({ date: new Date().toISOString().slice(0, 10), sectorId: "", type: "Inspeção manual", duration: "", note: "", occurrence: "" });
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState<"sector" | "monitoring" | "delete" | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "sector"; item: Sector } | { kind: "monitoring"; item: MonitoringRecord } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const selectedMonitoring = account.monitoring.find((item) => item.id === selectedMonitoringId) ?? null;

  async function saveSector(event: FormEvent) {
    event.preventDefault();
    if (!sector.name.trim()) {
      setError("Informe o nome do setor.");
      return;
    }
    setSaving("sector");
    setError("");
    try {
      await updateAccount((current) => ({ ...current, sectors: editingSectorId
        ? current.sectors.map((item) => item.id === editingSectorId ? { ...item, name: sector.name.trim(), kind: sector.kind, note: sector.note.trim() || undefined } : item)
        : [...current.sectors, { id: makeId("sector"), name: sector.name.trim(), kind: sector.kind, note: sector.note.trim() || undefined }],
      }), { requireRemote: true });
      setSector({ name: "", kind: "Pasto", note: "" });
      setEditingSectorId(undefined);
      setSectorOpen(false);
      showAppToast(editingSectorId ? "Setor atualizado" : "Setor criado com sucesso");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o setor.");
    } finally {
      setSaving(null);
    }
  }

  async function saveMonitoring(event: FormEvent) {
    event.preventDefault();
    if (!record.sectorId) {
      setError("Selecione o setor monitorado.");
      return;
    }
    const item = { id: makeId("monitor"), date: record.date, sectorId: record.sectorId, type: record.type, duration: record.duration || undefined, note: record.note.trim() || undefined, occurrence: record.occurrence.trim() || undefined };
    setSaving("monitoring");
    setError("");
    try {
      await updateAccount((current) => ({ ...current, monitoring: [item, ...current.monitoring] }), { requireRemote: true });
      setRecord({ date: new Date().toISOString().slice(0, 10), sectorId: "", type: "Inspeção manual", duration: "", note: "", occurrence: "" });
      setRecordOpen(false);
      setTab("history");
      showAppToast("Monitoramento registrado com sucesso");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar o monitoramento.");
    } finally {
      setSaving(null);
    }
  }

  function removeSector(item: Sector) {
    setDeleteTarget({ kind: "sector", item });
  }

  function editSector(item: Sector) {
    setEditingSectorId(item.id);
    setSector({ name: item.name, kind: item.kind, note: item.note ?? "" });
    setSelected(null);
    setSectorOpen(true);
  }

  function openNewSector() {
    setEditingSectorId(undefined);
    setSector({ name: "", kind: "Pasto", note: "" });
    setError("");
    setSectorOpen(true);
  }

  useEffect(() => { if (createSectorRequest !== undefined) { openNewSector(); onRequestHandled?.(); } }, [createSectorRequest]);

  function removeMonitoring(item: MonitoringRecord) {
    setDeleteTarget({ kind: "monitoring", item });
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    setSaving("delete");
    setDeleteError("");
    try {
      if (target.kind === "sector") {
        await updateAccount((current) => ({ ...current, sectors: current.sectors.filter((item) => item.id !== target.item.id), activities: current.activities.map((activity) => activity.sectorId === target.item.id ? { ...activity, sectorId: undefined } : activity), monitoring: current.monitoring.map((record) => record.sectorId === target.item.id ? { ...record, sectorId: undefined } : record) }), { requireRemote: true });
        setSelected(null);
      } else {
        await updateAccount((current) => ({ ...current, monitoring: current.monitoring.filter((item) => item.id !== target.item.id) }), { requireRemote: true });
        setSelectedMonitoringId(undefined);
      }
      setDeleteTarget(null);
      showAppToast(target.kind === "sector" ? "Setor excluído" : "Monitoramento excluído");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Não foi possível concluir a exclusão.");
    } finally {
      setSaving(null);
    }
  }

  async function addMonitoringPhoto(file?: File) {
    if (!selectedMonitoring) return;
    setPhotoBusy(true);
    setError("");
    try { if (await saveMonitoringPhoto(selectedMonitoring.id, file)) showAppToast("Foto adicionada ao monitoramento"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível anexar a foto."); }
    finally { setPhotoBusy(false); if (photoRef.current) photoRef.current.value = ""; }
  }

  return (
    <div className="screen page-enter monitor-screen">
      <ScreenHeader
        eyebrow="GESTÃO DA PROPRIEDADE"
        title="Monitorar"
        subtitle="Setores, inspeções e ocorrências da propriedade."
        action={<button className="icon-button accent" onClick={openNewSector} aria-label="Criar setor"><Plus size={21} /></button>}
      />

      <section className="monitor-overview" aria-label="Resumo do monitoramento">
        <div className="monitor-overview-heading">
          <span><RadioTower size={26} /></span>
          <div><small>VISÃO DA PROPRIEDADE</small><strong>Inspeções e setores</strong></div>
        </div>
        <div className="monitor-overview-metrics">
          <div><strong>{account.sectors.length}</strong><small>{account.sectors.length === 1 ? "setor" : "setores"}</small></div>
          <div><strong>{account.monitoring.length}</strong><small>{account.monitoring.length === 1 ? "registro" : "registros"}</small></div>
          <div><strong>{account.monitoring.filter((item) => Boolean(item.occurrence?.trim())).length}</strong><small>ocorrências</small></div>
        </div>
        {account.sectors.length > 0 && <button onClick={() => { setRecord((current) => ({ ...current, sectorId: current.sectorId || account.sectors[0].id })); setRecordOpen(true); }}><Plus size={17} /> Registrar inspeção</button>}
      </section>

      <div className="segmented-control">
        <button className={tab === "sectors" ? "active" : ""} onClick={() => setTab("sectors")}>Quadro <span>{account.sectors.length}</span></button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Histórico <span>{account.monitoring.length}</span></button>
      </div>

      {tab === "sectors" ? (
        <section className="content-section monitor-section">
          <SectionHeader title="Quadro de setores" action={<button className="text-button" onClick={openNewSector}>Novo setor</button>} />
          {account.sectors.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid size={26} />}
              title="Monte o quadro da propriedade"
              text="Cadastre áreas como pastos, curral, galpão, reserva ou pontos de água."
              action={<button className="primary-button" onClick={openNewSector}><Plus size={17} /> Criar primeiro setor</button>}
            />
          ) : (
            <div className="sector-board">
              <div className="sector-board-head"><span>Setor</span><span>Situação</span></div>
              {account.sectors.map((item) => {
                const sectorRecords = account.monitoring.filter((recordItem) => recordItem.sectorId === item.id);
                const pending = account.activities.filter((activity) => activity.sectorId === item.id && !activity.done).length;
                const hasOccurrence = sectorRecords.some((recordItem) => Boolean(recordItem.occurrence?.trim()));
                const latest = sectorRecords.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                const status = hasOccurrence ? "Atenção" : pending > 0 ? `${pending} pendente${pending === 1 ? "" : "s"}` : "Em dia";
                return (
                  <button className="sector-board-row" key={item.id} onClick={() => setSelected(item)}>
                    <div className="sector-board-copy">
                      <span><strong>{item.name}</strong><em>{item.kind}</em></span>
                      <small>{latest ? `Última inspeção ${new Date(`${latest.date}T12:00:00`).toLocaleDateString("pt-BR")}` : "Sem inspeção registrada"} · {sectorRecords.length} registro{sectorRecords.length === 1 ? "" : "s"}</small>
                    </div>
                    <span className={`sector-board-status ${hasOccurrence ? "attention" : pending > 0 ? "pending" : "ok"}`}>{status}</span>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
            </div>
          )}
          {account.sectors.length > 0 && (
            <button className="wide-outline-button monitor-register-button" onClick={() => { setRecord((current) => ({ ...current, sectorId: account.sectors[0].id })); setRecordOpen(true); }}>
              <RadioTower size={18} /> Registrar inspeção
            </button>
          )}
        </section>
      ) : (
        <section className="content-section monitor-section">
          <SectionHeader title="Histórico de monitoramento" action={account.sectors.length > 0 ? <button className="text-button" onClick={() => setRecordOpen(true)}>Registrar</button> : undefined} />
          {account.monitoring.length === 0 ? (
            <EmptyState icon={<RadioTower size={26} />} title="Nenhum monitoramento" text="Registros reais aparecerão aqui após as inspeções da propriedade." />
          ) : (
            <div className="monitoring-list">
              {account.monitoring.map((item) => {
                const sectorItem = account.sectors.find((entry) => entry.id === item.sectorId);
                return (
                  <button className="monitoring-card" key={item.id} onClick={() => setSelectedMonitoringId(item.id)}>
                    <span className="monitoring-date">{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                    <div><small>{sectorItem?.name || "Setor removido"}</small><strong>{item.type}</strong><p>{item.note || "Sem observações"}</p></div>
                    {item.duration && <em><Clock3 size={14} /> {item.duration}</em>}
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Modal open={sectorOpen} onClose={() => { setSectorOpen(false); setEditingSectorId(undefined); setError(""); }} eyebrow="SETOR" title={editingSectorId ? "Editar setor" : "Criar setor"} dismissible={!saving}>
        <form className="modal-form" onSubmit={saveSector}>
          <Field label="Nome"><input value={sector.name} onChange={(e) => { setSector({ ...sector, name: e.target.value }); setError(""); }} placeholder="Ex.: Pasto 1" autoFocus /></Field>
          <Field label="Tipo">
            <select value={sector.kind} onChange={(e) => setSector({ ...sector, kind: e.target.value })}>
              {['Pasto', 'Curral', 'Plantação', 'Reserva', 'Área de água', 'Galpão', 'Outro'].map((kind) => <option key={kind}>{kind}</option>)}
            </select>
          </Field>
          <Field label="Observação"><textarea value={sector.note} onChange={(e) => setSector({ ...sector, note: e.target.value })} placeholder="Características ou uso desta área" /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setSectorOpen(false)} disabled={saving === "sector"}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving === "sector"} loadingLabel="Salvando setor...">{editingSectorId ? "Confirmar alterações" : "Confirmar setor"}</LoadingButton></div>
        </form>
      </Modal>

      <Modal open={recordOpen} onClose={() => { setRecordOpen(false); setError(""); }} eyebrow="HISTÓRICO" title="Registrar monitoramento" dismissible={!saving}>
        <form className="modal-form" onSubmit={saveMonitoring}>
          <div className="field-combo">
            <Field label="Data"><input type="date" value={record.date} onChange={(e) => setRecord({ ...record, date: e.target.value })} /></Field>
            <Field label="Duração"><input value={record.duration} onChange={(e) => setRecord({ ...record, duration: e.target.value })} placeholder="Ex.: 25 min" /></Field>
          </div>
          <Field label="Setor">
            <select value={record.sectorId} onChange={(e) => { setRecord({ ...record, sectorId: e.target.value }); setError(""); }}>
              <option value="">Selecione</option>{account.sectors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo"><select value={record.type} onChange={(e) => setRecord({ ...record, type: e.target.value })}><option>Inspeção manual</option><option>Monitoramento de animais</option><option>Inspeção de água</option><option>Outro</option></select></Field>
          <Field label="Observações"><textarea value={record.note} onChange={(e) => setRecord({ ...record, note: e.target.value })} placeholder="O que foi observado?" /></Field>
          <Field label="Ocorrências"><textarea value={record.occurrence} onChange={(e) => setRecord({ ...record, occurrence: e.target.value })} placeholder="Opcional" /></Field>
          <div className="upload-placeholder"><Camera size={20} /><span>Depois de salvar, abra o registro para anexar fotos reais.</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setRecordOpen(false)} disabled={saving === "monitoring"}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving === "monitoring"} loadingLabel="Salvando monitoramento...">Confirmar monitoramento</LoadingButton></div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} eyebrow="SETOR" title={selected?.name || "Setor"}>
        {selected && <div className="sector-detail"><span><MapPin size={28} /></span><strong>{selected.kind}</strong><p>{selected.note || "Sem observações cadastradas."}</p><small>{account.activities.filter((item) => item.sectorId === selected.id).length} atividades · {account.monitoring.filter((item) => item.sectorId === selected.id).length} monitoramentos</small><div className="detail-actions"><button className="secondary-button" onClick={() => editSector(selected)}><Pencil size={17} /> Editar</button><button className="danger-button" onClick={() => removeSector(selected)}><Trash2 size={17} /> Excluir setor</button></div></div>}
      </Modal>

      <Modal open={Boolean(selectedMonitoring)} onClose={() => { setSelectedMonitoringId(undefined); setError(""); }} eyebrow="MONITORAMENTO" title={selectedMonitoring?.type || "Detalhes"} dismissible={!photoBusy}>
        {selectedMonitoring && <div className="monitoring-detail"><div className="detail-grid"><div><span>Data</span><strong>{new Date(`${selectedMonitoring.date}T12:00:00`).toLocaleDateString("pt-BR")}</strong></div><div><span>Setor</span><strong>{account.sectors.find((item) => item.id === selectedMonitoring.sectorId)?.name || "Setor removido"}</strong></div><div><span>Duração</span><strong>{selectedMonitoring.duration || "Não informada"}</strong></div><div><span>Tipo</span><strong>{selectedMonitoring.type}</strong></div></div>{selectedMonitoring.note && <div className="detail-note">{selectedMonitoring.note}</div>}{selectedMonitoring.occurrence && <div className="info-strip">Ocorrência: {selectedMonitoring.occurrence}</div>}{(selectedMonitoring.photoUrls?.length ?? 0) > 0 && <div className="monitoring-photos">{selectedMonitoring.photoUrls!.map((url, index) => <img src={url} alt={`Foto do monitoramento ${index + 1}`} key={url} />)}</div>}<div className="animal-photo-actions"><button className="secondary-button" onClick={() => void addMonitoringPhoto()} disabled={photoBusy}>{photoBusy ? <LoaderCircle size={17} className="spin" /> : <Camera size={17} />} Câmera</button><button className="secondary-button" onClick={() => photoRef.current?.click()} disabled={photoBusy}>Galeria</button><input ref={photoRef} className="hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void addMonitoringPhoto(event.target.files?.[0])} /></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="danger-button full" onClick={() => removeMonitoring(selectedMonitoring)}><Trash2 size={17} /> Excluir monitoramento</button></div>}
      </Modal>
      <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.kind === "sector" ? "Excluir setor?" : "Excluir monitoramento?"} text={deleteTarget?.kind === "sector" ? `O setor ${deleteTarget.item.name} será removido. Atividades e monitoramentos existentes serão preservados sem o vínculo do setor.` : "O registro e suas referências de foto serão removidos do histórico de monitoramento."} confirmLabel="Confirmar exclusão" busy={saving === "delete"} error={deleteError} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={confirmDelete} />
    </div>
  );
}
