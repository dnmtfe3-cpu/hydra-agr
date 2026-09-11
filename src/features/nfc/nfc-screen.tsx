import { useEffect, useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { AlertCircle, Beef as Cow, CheckCircle2, ChevronRight, Keyboard, LoaderCircle, Nfc, Radio, ScanLine, Settings, Smartphone } from "lucide-react";
import { EmptyState, Field, LoadingButton, Modal, ScreenHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { Animal, HydraAccount, UpdateAccount } from "../../lib/hydra-types";
import { getNfcAvailability, openNfcSettings, readNfcTag, stopNfcRead, type NfcAvailability } from "../../services/nfc-service";
import { TagTrackerDemo } from "./tag-tracker-demo";

type Props = {
  account: HydraAccount;
  updateAccount: UpdateAccount;
  onBack: () => void;
  onFound: (animal: Animal) => void;
  initialAnimalId?: string;
  onRealRead: (code: string) => Promise<boolean>;
};

export function NfcScreen({ account, updateAccount, onBack, onFound, initialAnimalId, onRealRead }: Props) {
  const canLink = account.access.kind === "owner" || account.access.staffRole === "manager";
  const isWeb = !Capacitor.isNativePlatform();
  const [mode, setMode] = useState<"locate" | "link">(initialAnimalId && canLink ? "link" : "locate");
  const [code, setCode] = useState("");
  const [animalId, setAnimalId] = useState(initialAnimalId ?? "");
  const [result, setResult] = useState<Animal | null>(null);
  const [message, setMessage] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const [nativeInfo, setNativeInfo] = useState(false);
  const [availability, setAvailability] = useState<NfcAvailability>("web");
  const [availabilityChecked, setAvailabilityChecked] = useState(isWeb);
  const [scanning, setScanning] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let active = true;
    void getNfcAvailability()
      .then((value) => {
        if (!active) return;
        setAvailability(value);
        setAvailabilityChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAvailability("unsupported");
        setAvailabilityChecked(true);
      });
    return () => {
      active = false;
      void stopNfcRead();
    };
  }, []);

  useEffect(() => {
    if (!canLink && mode === "link") setMode("locate");
  }, [canLink, mode]);

  function findByCode(value: string) {
    const normalized = value.trim().toLowerCase();
    return account.animals.find((animal) => animal.electronicId?.trim().toLowerCase() === normalized) || null;
  }

  function locate(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setMessage("Digite o código da identificação.");
      return;
    }
    const found = findByCode(code);
    setResult(found);
    setMessage(found ? (canLink ? "Animal localizado. Abrindo a ficha…" : "Animal localizado.") : "Nenhum animal foi encontrado com esse código.");
    if (found && canLink) window.setTimeout(() => onFound(found), 350);
  }

  async function link(event: FormEvent) {
    event.preventDefault();
    if (!canLink) {
      setMessage("Seu acesso permite localizar animais, mas não vincular identificações.");
      return;
    }
    const normalized = code.trim();
    if (!animalId || !normalized) {
      setMessage("Selecione o animal e informe o código.");
      return;
    }
    const duplicate = account.animals.find((animal) => animal.electronicId?.toLowerCase() === normalized.toLowerCase() && animal.id !== animalId);
    if (duplicate) {
      setMessage(`Este código já está vinculado a ${duplicate.name || duplicate.identification}.`);
      return;
    }
    const linked = account.animals.find((animal) => animal.id === animalId) || null;
    setLinking(true);
    setMessage("");
    try {
      await updateAccount((current) => ({
        ...current,
        animals: current.animals.map((animal) => animal.id === animalId
          ? {
              ...animal,
              electronicId: normalized,
              history: [
                ...(animal.history ?? []),
                {
                  id: `history-${Date.now()}`,
                  date: new Date().toISOString(),
                  type: "Identificação eletrônica",
                  description: `Tag ${normalized} vinculada`,
                },
              ],
            }
          : animal),
      }), { requireRemote: true });
      setResult(linked ? { ...linked, electronicId: normalized } : null);
      setMessage("Identificação vinculada com sucesso.");
      showAppToast("Identificação NFC/RFID vinculada");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Não foi possível vincular a identificação.");
    } finally {
      setLinking(false);
    }
  }

  async function startNfcRead() {
    if (isWeb) {
      setAvailability("web");
      setAvailabilityChecked(true);
      setNativeInfo(true);
      return;
    }

    const currentAvailability = await getNfcAvailability().catch(() => "unsupported" as NfcAvailability);
    setAvailability(currentAvailability);
    setAvailabilityChecked(true);

    if (currentAvailability !== "ready") {
      setNativeInfo(true);
      return;
    }

    setScanning(true);
    setResult(null);
    setMessage("Aproxime a tag ou o brinco eletrônico do celular.");
    try {
      const readCode = await readNfcTag();
      await onRealRead(readCode).catch(() => false);
      setCode(readCode);
      if (mode === "locate") {
        const found = findByCode(readCode);
        setResult(found);
        setMessage(found ? (canLink ? "Tag lida. Abrindo a ficha do animal…" : "Tag lida. Animal localizado.") : `Tag ${readCode} lida, mas ainda não vinculada.`);
        if (found && canLink) window.setTimeout(() => onFound(found), 350);
      } else {
        setMessage(`Tag ${readCode} lida. Confirme o vínculo abaixo.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a leitura.");
    } finally {
      setScanning(false);
    }
  }

  function switchMode(next: "locate" | "link") {
    if (next === "link" && !canLink) return;
    setMode(next);
    setCode("");
    setResult(null);
    setMessage("");
  }

  const availabilityText = isWeb
    ? "Use QR ou código manual neste dispositivo"
    : !availabilityChecked
      ? "Verificando NFC deste aparelho…"
      : availability === "ready"
        ? "NFC pronto para leitura"
        : availability === "disabled"
          ? "NFC desativado no celular"
          : "Este celular não oferece NFC compatível";

  const nfcUnavailable = !isWeb && availabilityChecked && availability === "unsupported";
  const nfcDisabled = !isWeb && availabilityChecked && availability === "disabled";

  return (
    <div className="screen page-enter extra-screen nfc-screen">
      <ScreenHeader
        eyebrow="IDENTIFICAÇÃO ANIMAL"
        title="NFC e RFID"
        subtitle={isWeb
          ? "No computador, localize ou vincule o animal pelo código da identificação."
          : canLink
            ? "Leia por NFC, QR Code ou informe o Hydra ID."
            : "Abra a ficha do animal por NFC, QR Code ou Hydra ID."}
        onBack={onBack}
      />

      {isWeb && <section className="nfc-desktop-notice" aria-label="Leitura NFC no celular">
        <span><Smartphone size={26} /></span>
        <div>
          <small>LEITURA POR APROXIMAÇÃO</small>
          <strong>Use um celular com NFC compatível</strong>
          <p>Neste dispositivo, use o QR Code ou o código da identificação. A leitura por aproximação só aparece quando o aparelho informa suporte a NFC.</p>
        </div>
      </section>}

      {nfcUnavailable && <section className="nfc-capability-alert" role="status" aria-live="polite">
        <AlertCircle size={20} />
        <div><strong>Este celular não tem NFC compatível</strong><span>Sem problema: use o leitor de QR acima ou digite o Hydra ID.</span></div>
      </section>}

      {nfcDisabled && <section className="nfc-capability-alert is-disabled" role="status" aria-live="polite">
        <Nfc size={20} />
        <div><strong>NFC desativado</strong><span>Ative o NFC do aparelho para usar a leitura por aproximação.</span></div>
        <button type="button" onClick={() => void openNfcSettings()}><Settings size={15} /> Ativar</button>
      </section>}

      <section className={`nfc-hero ${scanning ? "is-scanning" : ""}`}>
        <div className="nfc-waves"><span /><span /><span />{scanning ? <LoaderCircle size={38} className="spin" /> : <Nfc size={38} />}</div>
        <h2>{scanning
          ? "Lendo identificação…"
          : isWeb
            ? "Leitura NFC pelo celular"
            : !availabilityChecked
              ? "Verificando NFC do celular…"
              : availability === "unsupported"
                ? "Celular sem NFC compatível"
                : availability === "disabled"
                  ? "NFC desativado"
                  : "Aproxime a tag do celular"}</h2>
        <p>{isWeb
          ? "Use QR Code ou código manual aqui. Para leitura por aproximação, abra o Hydra Agro em um celular com NFC compatível."
          : !availabilityChecked
            ? "O Hydra Agro está verificando se este aparelho possui NFC."
            : availability === "unsupported"
              ? "Use o QR Code acima ou digite o Hydra ID para identificar o animal."
              : availability === "disabled"
                ? "Ative o NFC nas configurações do aparelho e tente novamente."
                : "Encoste o brinco eletrônico ou a tag na área NFC do aparelho."}</p>
        <button className="nfc-native-read-button" onClick={() => void startNfcRead()} disabled={scanning || (!isWeb && !availabilityChecked)}><Radio size={18} /> {scanning
          ? "Aguardando etiqueta"
          : isWeb
            ? "Como usar NFC"
            : availability === "disabled"
              ? "Ativar NFC"
              : availability === "unsupported"
                ? "Ver alternativas"
                : "Iniciar leitura"}</button>
        <small><Smartphone size={15} /> {availabilityText}</small>
      </section>

      {scanning && (
        <div className="nfc-reading-overlay" role="status" aria-live="polite" aria-label="Lendo etiqueta NFC">
          <div className="nfc-reading-loader">
            <span className="nfc-reading-ring" />
            <Nfc size={30} />
          </div>
          <strong>Lendo etiqueta NFC…</strong>
          <small>Mantenha a etiqueta próxima ao celular.</small>
        </div>
      )}

      <div className="segmented-control nfc-segment">
        <button className={mode === "locate" ? "active" : ""} onClick={() => switchMode("locate")}>Localizar animal</button>
        {canLink && <button className={mode === "link" ? "active" : ""} onClick={() => switchMode("link")}>Vincular identificação</button>}
      </div>

      {account.animals.length === 0 ? (
        <EmptyState icon={<Cow size={26} />} title="Nenhum animal cadastrado" text={canLink ? "Cadastre um animal antes de vincular uma identificação eletrônica." : "Ainda não há animais cadastrados nesta propriedade."} />
      ) : (
        <form className="nfc-manual-card" onSubmit={mode === "locate" ? locate : link}>
          <div className="manual-heading"><Keyboard size={21} /><div><strong>Código manual</strong><small>Use quando preferir digitar o código.</small></div></div>
          {mode === "link" && canLink && (
            <Field label="Animal">
              <select value={animalId} onChange={(event) => { setAnimalId(event.target.value); setMessage(""); }}>
                <option value="">Selecione</option>
                {account.animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name || animal.identification} · {animal.identification}</option>)}
              </select>
            </Field>
          )}
          <Field label="Código da identificação"><input value={code} onChange={(event) => { setCode(event.target.value); setMessage(""); setResult(null); }} placeholder="Digite o código NFC/RFID" /></Field>
          {message && <p className={`nfc-message ${result ? "success" : ""}`}>{result ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}{message}</p>}
          <LoadingButton className="primary-button full" type="submit" loading={linking} loadingLabel="Vinculando…">{mode === "locate" ? <><ScanLine size={18} /> Localizar animal</> : <><Nfc size={18} /> Confirmar vínculo</>}</LoadingButton>
        </form>
      )}

      {result && (
        canLink
          ? <button className="nfc-result-card" onClick={() => onFound(result)}><span><Cow size={27} /></span><div><small>{result.identification}</small><strong>{result.name || "Animal sem nome"}</strong><p>{result.species}{result.breed ? ` · ${result.breed}` : ""}</p></div><ChevronRight size={20} /></button>
          : <div className="nfc-result-card"><span><Cow size={27} /></span><div><small>{result.identification}</small><strong>{result.name || "Animal sem nome"}</strong><p>{result.species}{result.breed ? ` · ${result.breed}` : ""}</p></div><CheckCircle2 size={20} /></div>
      )}

      <section className="nfc-inline-card" aria-label="Localização do animal"><div><strong>Rastreamento não conectado</strong><p>Para mostrar a localização real, conecte um rastreador compatível. Nenhum dispositivo está conectado.</p><p>A tag NFC identifica o animal por aproximação. Ela não informa onde ele está.</p></div></section>
      {isWeb && <details onToggle={event => setDemoOpen(event.currentTarget.open)}><summary>Modo demonstração</summary>{demoOpen && <TagTrackerDemo animals={account.animals} />}</details>}

      <Modal open={nativeInfo} onClose={() => setNativeInfo(false)} eyebrow="LEITURA NFC" title={availability === "disabled" ? "Ative o NFC do celular" : "Leitura por aproximação indisponível"}>
        <div className="hardware-message">
          <span><Smartphone size={31} /></span>
          <p>{availability === "disabled"
            ? "O NFC está desativado. Ative-o nas configurações do aparelho e tente novamente."
            : availability === "web"
              ? "Este dispositivo não oferece a leitura NFC do aplicativo. Use o QR Code ou o código manual."
              : "Este celular não oferece leitura NFC compatível. Use o QR Code ou o Hydra ID."}</p>
          <div className="future-data-list"><div><Nfc size={17} /> Leitura por aproximação em aparelhos compatíveis</div><div><span className="tiny-shield" /> QR Code e Hydra ID continuam disponíveis</div></div>
          {availability === "disabled" && <button className="secondary-button full" onClick={() => void openNfcSettings()}><Settings size={17} /> Abrir configurações</button>}
          <button className="primary-button full" onClick={() => setNativeInfo(false)}>Usar QR ou código manual</button>
        </div>
      </Modal>
    </div>
  );
}
