import { GuidedForm } from "../easy-mode/easy-mode";
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  ChevronRight,
  Droplet,
  Droplets,
  Plus,
  Pencil,
  Trash2,
  Waves,
} from "lucide-react";
import { ConfirmDialog, EmptyState, Field, LoadingButton, Modal, ScreenHeader, SectionHeader, Toggle } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import { makeId, type HydraAccount, type UpdateAccount, type WaterRecord, type WaterSource } from "../../lib/hydra-types";
import { calculateWaterConsumption } from "../../lib/water-savings";
import { WaterScienceCard } from "../climate/water-science-card";
import { WaterConsumptionPanel } from "./water-consumption-panel";

type Props = {
  account: HydraAccount;
  updateAccount: UpdateAccount;
  createRecordRequest?: number;
  onRequestHandled?: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function WaterScreen({ account, updateAccount, createRecordRequest, onRequestHandled }: Props) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string>();
  const [editingRecordId, setEditingRecordId] = useState<string>();
  const [selectedSource, setSelectedSource] = useState<WaterSource | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<WaterRecord | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("Poço");
  const [sourceStatus, setSourceStatus] = useState<WaterSource["status"]>("ativa");
  const [record, setRecord] = useState({ date: today(), amount: "", sourceId: "", purpose: "Consumo animal", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"source" | "record" | "delete" | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "source"; item: WaterSource } | { kind: "record"; item: WaterRecord } | null>(null);

  const total = useMemo(
    () => account.waterRecords.reduce((sum, item) => sum + item.amount, 0),
    [account.waterRecords],
  );
  const consumption = useMemo(
    () => calculateWaterConsumption(account.waterRecords),
    [account.waterRecords],
  );
  const maxRecord = Math.max(...account.waterRecords.map((item) => item.amount), 1);

  async function addSource(event: FormEvent) {
    event.preventDefault();
    if (!sourceName.trim()) {
      setError("Dê um nome para a fonte de água.");
      return;
    }
    const id = editingSourceId ?? makeId("source");
    setSaving("source");
    setError("");
    try {
      await updateAccount((current) => ({ ...current, waterSources: editingSourceId
        ? current.waterSources.map((source) => source.id === editingSourceId ? { ...source, name: sourceName.trim(), type: sourceType, status: sourceStatus } : source)
        : [...current.waterSources, { id, name: sourceName.trim(), type: sourceType, status: sourceStatus }],
      }), { requireRemote: true });
      setRecord((current) => ({ ...current, sourceId: current.sourceId || id }));
      setSourceName("");
      setSourceStatus("ativa");
      setEditingSourceId(undefined);
      setSourceOpen(false);
      showAppToast(editingSourceId ? "Fonte de água atualizada" : "Fonte de água cadastrada");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a fonte de água.");
    } finally {
      setSaving(null);
    }
  }

  async function addRecord(event: FormEvent) {
    event.preventDefault();
    const amount = Number(record.amount.replace(",", "."));
    if (!record.sourceId) {
      setError("Selecione a origem da água.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe uma quantidade válida.");
      return;
    }
    const nextRecord = { id: editingRecordId ?? makeId("water"), date: record.date, amount, sourceId: record.sourceId, purpose: record.purpose, note: record.note.trim() };
    setSaving("record");
    setError("");
    try {
      await updateAccount((current) => ({ ...current, waterRecords: editingRecordId
        ? current.waterRecords.map((item) => item.id === editingRecordId ? nextRecord : item)
        : [nextRecord, ...current.waterRecords],
      }), { requireRemote: true });
      setRecord({ date: today(), amount: "", sourceId: account.waterSources[0]?.id ?? "", purpose: "Consumo animal", note: "" });
      setEditingRecordId(undefined);
      setRecordOpen(false);
      showAppToast(editingRecordId ? "Leitura atualizada com sucesso" : "Água registrada com sucesso");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar a leitura.");
    } finally {
      setSaving(null);
    }
  }

  function openRecord() {
    setError("");
    if (account.waterSources.length > 0 && !record.sourceId) {
      setRecord((current) => ({ ...current, sourceId: account.waterSources[0].id }));
    }
    setRecordOpen(true);
  }

  useEffect(() => { if (createRecordRequest !== undefined) { openRecord(); onRequestHandled?.(); } }, [createRecordRequest]);

  function openSourceForm() {
    setEditingSourceId(undefined);
    setSourceName("");
    setSourceType("Poço");
    setSourceStatus("ativa");
    setError("");
    setSourceOpen(true);
  }

  function editSource(source: WaterSource) {
    setEditingSourceId(source.id);
    setSourceName(source.name);
    setSourceType(source.type);
    setSourceStatus(source.status);
    setSelectedSource(null);
    setSourceOpen(true);
  }

  function deleteSource(source: WaterSource) {
    if (account.waterRecords.some((item) => item.sourceId === source.id)) {
      setError("Esta fonte possui leituras. Exclua ou edite os registros vinculados primeiro.");
      return;
    }
    setDeleteTarget({ kind: "source", item: source });
  }

  function editRecord(item: WaterRecord) {
    setEditingRecordId(item.id);
    setRecord({ date: item.date, amount: String(item.amount), sourceId: item.sourceId, purpose: item.purpose, note: item.note ?? "" });
    setSelectedRecord(null);
    setRecordOpen(true);
  }

  function deleteRecord(item: WaterRecord) {
    setDeleteTarget({ kind: "record", item });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving("delete");
    setDeleteError("");
    try {
      if (deleteTarget.kind === "source") {
        await updateAccount((current) => ({ ...current, waterSources: current.waterSources.filter((item) => item.id !== deleteTarget.item.id) }), { requireRemote: true });
        setSelectedSource(null);
      } else {
        await updateAccount((current) => ({ ...current, waterRecords: current.waterRecords.filter((item) => item.id !== deleteTarget.item.id) }), { requireRemote: true });
        setSelectedRecord(null);
      }
      setDeleteTarget(null);
      showAppToast("Registro excluído com sucesso");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Não foi possível concluir a exclusão.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="screen page-enter">
      <ScreenHeader
        eyebrow="GESTÃO HÍDRICA"
        title="Água"
        subtitle="Registre o volume usado e acompanhe consumo e economia da fazenda."
        action={<button className="icon-button accent" onClick={openSourceForm} aria-label="Adicionar fonte"><Plus size={21} /></button>}
      />
      <WaterScienceCard account={account} />
      <WaterConsumptionPanel account={account} onRegister={openRecord} />

      <section className="water-overview">
        <div className="water-total">
          <div className="water-total-icon"><Droplets size={28} /></div>
          <span>Volume registrado</span>
          <strong>{account.waterRecords.length ? `${total.toLocaleString("pt-BR")} L` : "—"}</strong>
          <small>{account.waterRecords.length ? `${account.waterRecords.length} leitura${account.waterRecords.length > 1 ? "s" : ""}` : "Nenhuma leitura ainda"}</small>
        </div>
        <div className="water-mini-metrics">
          <div><span>Fontes</span><strong>{account.waterSources.length}</strong></div>
          <div><span>Média</span><strong>{account.waterRecords.length ? `${Math.round(total / account.waterRecords.length)} L` : "—"}</strong></div>
        </div>
      </section>

      <div className="action-pair">
        <button className="primary-button" onClick={openRecord}><Droplet size={18} /> Registrar leitura</button>
        <button className="secondary-button" onClick={openSourceForm}><Waves size={18} /> Nova fonte</button>
      </div>

      <section className="content-section">
        <SectionHeader title="Evolução" action={<span className="subtle-label">Leituras recentes</span>} />
        {account.waterRecords.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={25} />}
            title="A evolução começa com uma leitura"
            text="O gráfico só aparecerá quando houver dados registrados por você."
            action={<button className="small-button" onClick={openRecord}>Registrar agora</button>}
          />
        ) : (
          <div className="water-chart" aria-label="Gráfico das leituras recentes">
            {account.waterRecords.slice(0, 7).reverse().map((item) => (
              <div className="chart-column" key={item.id}>
                <span className="chart-value">{item.amount}L</span>
                <div className="chart-track"><i style={{ height: `${Math.max((item.amount / maxRecord) * 100, 8)}%` }} /></div>
                <small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="content-section">
        <SectionHeader title="Fontes cadastradas" action={<button className="text-button" onClick={openSourceForm}>Adicionar</button>} />
        {account.waterSources.length === 0 ? (
          <div className="inline-empty"><Waves size={21} /><span><strong>Nenhuma fonte cadastrada</strong><small>Poço, cisterna, nascente, açude e outras.</small></span></div>
        ) : (
          <div className="compact-list">
            {account.waterSources.map((source) => (
              <button className="compact-row" key={source.id} onClick={() => { setSelectedSource(source); setError(""); }}>
                <span className="row-icon soft-blue"><Droplet size={19} /></span>
                <div><strong>{source.name}</strong><small>{source.type}</small></div>
                <span className={`status-pill ${source.status}`}>{source.status}</span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="setting-card">
          <span className="row-icon soft-orange"><BellRing size={20} /></span>
          <div><strong>Alertas de consumo</strong><small>Avisos baseados nos dias medidos.</small></div>
          <Toggle
            checked={account.settings.waterAlerts}
            label="Alertas de consumo de água"
            onChange={(waterAlerts) => updateAccount((current) => ({ ...current, settings: { ...current.settings, waterAlerts } }))}
          />
        </div>
        {account.settings.waterAlerts && consumption.status === "insufficient" && (
          <div className="info-strip"><AlertTriangle size={17} /> Registre água em pelo menos 4 dias diferentes para comparar períodos de consumo.</div>
        )}
        {account.settings.waterAlerts && consumption.status === "higher" && Math.abs(consumption.changePercent) >= 15 && <div className="info-strip attention"><AlertTriangle size={17} /> Atenção: nos últimos {consumption.comparisonDays} dias medidos, o consumo ficou {Math.abs(consumption.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% acima dos {consumption.comparisonDays} dias medidos anteriores.</div>}
        {account.settings.waterAlerts && account.waterSources.some((source) => source.status === "atenção") && <div className="info-strip attention"><AlertTriangle size={17} /> Há fonte de água marcada como “atenção”. Abra a fonte para revisar sua situação.</div>}
      </section>

      <section className="content-section last-section">
        <SectionHeader title="Histórico" />
        {account.waterRecords.length === 0 ? (
          <div className="plain-empty">Nenhum registro de água.</div>
        ) : (
          <div className="timeline-list">
            {account.waterRecords.map((item) => {
              const source = account.waterSources.find((entry) => entry.id === item.sourceId);
              return (
                <button key={item.id} onClick={() => setSelectedRecord(item)}>
                  <span className="timeline-dot" />
                  <div><strong>{item.amount.toLocaleString("pt-BR")} L · {item.purpose}</strong><small>{source?.name || "Origem removida"} · {new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={sourceOpen} onClose={() => { setSourceOpen(false); setEditingSourceId(undefined); setError(""); }} eyebrow="RECURSO HÍDRICO" title={editingSourceId ? "Editar fonte de água" : "Cadastrar fonte de água"} dismissible={!saving}>
        <GuidedForm className="modal-form" onSubmit={addSource}>
          <Field label="Nome da fonte">
            <input value={sourceName} onChange={(e) => { setSourceName(e.target.value); setError(""); }} placeholder="Ex.: Cisterna principal" autoFocus />
          </Field>
          <Field label="Tipo">
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {['Poço', 'Cisterna', 'Nascente', 'Açude', 'Reservatório', 'Rede', 'Outra'].map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Situação">
            <select value={sourceStatus} onChange={(event) => setSourceStatus(event.target.value as WaterSource["status"])}>
              <option value="ativa">Ativa</option>
              <option value="atenção">Atenção</option>
              <option value="inativa">Inativa</option>
            </select>
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setSourceOpen(false)} disabled={saving === "source"}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving === "source"} loadingLabel="Salvando fonte...">{editingSourceId ? "Confirmar alterações" : "Confirmar fonte"}</LoadingButton></div>
        </GuidedForm>
      </Modal>

      <Modal open={recordOpen} onClose={() => { setRecordOpen(false); setEditingRecordId(undefined); setError(""); }} eyebrow={editingRecordId ? "EDIÇÃO" : "NOVA LEITURA"} title={editingRecordId ? "Editar leitura" : "Registrar água"} dismissible={!saving}>
        {account.waterSources.length === 0 ? (
          <EmptyState
            icon={<Waves size={24} />}
            title="Cadastre uma fonte primeiro"
            text="Toda leitura precisa informar de onde veio a água."
            action={<button className="primary-button" onClick={() => { setRecordOpen(false); setSourceOpen(true); }}>Cadastrar fonte</button>}
          />
        ) : (
          <GuidedForm className="modal-form" onSubmit={addRecord}>
            <div className="field-combo">
              <Field label="Data"><input type="date" value={record.date} onChange={(e) => setRecord({ ...record, date: e.target.value })} /></Field>
              <Field label="Quantidade usada (L)"><input inputMode="decimal" value={record.amount} onChange={(e) => { setRecord({ ...record, amount: e.target.value }); setError(""); }} placeholder="0" /></Field>
            </div>
            <Field label="Origem">
              <select value={record.sourceId} onChange={(e) => setRecord({ ...record, sourceId: e.target.value })}>
                <option value="">Selecione</option>
                {account.waterSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
              </select>
            </Field>
            <Field label="Finalidade">
              <select value={record.purpose} onChange={(e) => setRecord({ ...record, purpose: e.target.value })}>
                {['Consumo animal', 'Irrigação', 'Uso doméstico rural', 'Limpeza', 'Outra'].map((purpose) => <option key={purpose}>{purpose}</option>)}
              </select>
            </Field>
            <Field label="Observação (opcional)"><textarea value={record.note} onChange={(e) => setRecord({ ...record, note: e.target.value })} placeholder="Alguma informação importante?" /></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-action-row"><button className="secondary-button" type="button" onClick={() => setRecordOpen(false)} disabled={saving === "record"}>Cancelar</button><LoadingButton className="primary-button" type="submit" loading={saving === "record"} loadingLabel="Salvando leitura...">{editingRecordId ? "Confirmar alterações" : "Confirmar leitura"}</LoadingButton></div>
          </GuidedForm>
        )}
      </Modal>

      <Modal open={Boolean(selectedSource)} onClose={() => { setSelectedSource(null); setError(""); }} eyebrow="FONTE DE ÁGUA" title={selectedSource?.name || "Fonte"}>
        {selectedSource && <div className="water-detail"><span><Waves size={27} /></span><strong>{selectedSource.type}</strong><p>Situação: {selectedSource.status}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="detail-actions"><button className="secondary-button" onClick={() => editSource(selectedSource)}><Pencil size={17} /> Editar</button><button className="danger-button" onClick={() => deleteSource(selectedSource)}><Trash2 size={17} /> Excluir</button></div></div>}
      </Modal>

      <Modal open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} eyebrow="LEITURA DE ÁGUA" title={selectedRecord ? `${selectedRecord.amount.toLocaleString("pt-BR")} L` : "Leitura"}>
        {selectedRecord && <div className="water-detail"><span><Droplet size={27} /></span><strong>{selectedRecord.purpose}</strong><p>{account.waterSources.find((source) => source.id === selectedRecord.sourceId)?.name || "Origem removida"} · {new Date(`${selectedRecord.date}T12:00:00`).toLocaleDateString("pt-BR")}</p>{selectedRecord.note && <div className="detail-note">{selectedRecord.note}</div>}<div className="detail-actions"><button className="secondary-button" onClick={() => editRecord(selectedRecord)}><Pencil size={17} /> Editar</button><button className="danger-button" onClick={() => deleteRecord(selectedRecord)}><Trash2 size={17} /> Excluir</button></div></div>}
      </Modal>
      <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.kind === "source" ? "Excluir fonte de água?" : "Excluir leitura de água?"} text={deleteTarget?.kind === "source" ? `A fonte ${deleteTarget.item.name} será removida da propriedade.` : "Esta leitura será removida do histórico e dos indicadores de água."} confirmLabel="Confirmar exclusão" busy={saving === "delete"} error={deleteError} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={confirmDelete} />
    </div>
  );
}
