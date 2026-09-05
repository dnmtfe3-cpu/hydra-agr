import { useEffect, useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { AlertCircle, Beef as Cow, CheckCircle2, ChevronRight, Keyboard, LoaderCircle, Nfc, Radio, ScanLine, Settings, Smartphone } from "lucide-react";
import { EmptyState, Field, LoadingButton, Modal, ScreenHeader } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { Animal, HydraAccount, UpdateAccount } from "../../lib/hydra-types";
import { getNfcAvailability, openNfcSettings, readNfcTag, stopNfcRead, type NfcAvailability } from "../../services/nfc-service";

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
  const isIos = Capacitor.getPlatform() === "ios";
  const [mode, setMode] = useState<"locate" | "link">(initialAnimalId && canLink ? "link" : "locate");
  const [code, setCode] = useState("");
  const [animalId, setAnimalId] = useState(initialAnimalId ?? "");
  const [result, setResult] = useState<Animal | null>(null);
  const [message, setMessage] = useState("");
  const [nativeInfo, setNativeInfo] = useState(false);
  const [availability, setAvailability] = useState<NfcAvailability>("web");
  const [scanning, setScanning] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    void getNfcAvailability().then(setAvailability).catch(() => setAvailability("unsupported"));
    return () => { void stopNfcRead(); };
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

  async function startNativeRead() {
    if (isIos) {
      setAvailability("unsupported");
      setNativeInfo(true);
      return;
    }

    const currentAvailability = await getNfcAvailability().catch(() => "unsupported" as NfcAvailability);
    setAvailability(currentAvailability);

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

  const availabilityText = isIos
    ? "NFC disponível em breve no iOS"
    : availability === "ready"
    ? "NFC pronto para leitura"
    : availability === "disabled"
      ? "NFC desativado no celular"
      : availability === "unsupported"
        ? "Este aparelho não oferece NFC compatível"
        : "Leitura por aproximação disponível no app Android";

  return (
    <div className="screen page-enter extra-screen nfc-screen">
      <ScreenHeader
        eyebrow="IDENTIFICAÇÃO ANIMAL"
        title="NFC e RFID"
        subtitle={canLink ? "Leia uma tag por aproximação ou informe o código manualmente." : "Localize animais pela identificação eletrônica."}
        onBack={onBack}
      />

      <section className="nfc-desktop-notice" aria-label="Leitura NFC no celular">
        <span><Smartphone size={26} /></span>
        <div>
          <small>LEITURA POR APROXIMAÇÃO</small>
          <strong>{isIos ? "NFC disponível em breve no iOS" : "Use um celular Android com NFC"}</strong>
          <p>{isIos ? "Enquanto isso, localize ou vincule o animal digitando o código da identificação." : "Em dispositivos sem leitura NFC compatível, localize o animal pelo código da identificação."}</p>
        </div>
      </section>

      <section className={`nfc-hero ${scanning ? "is-scanning" : ""}`}>
        <div className="nfc-waves"><span /><span /><span />{scanning ? <LoaderCircle size={38} className="spin" /> : <Nfc size={38} />}</div>
        <h2>{scanning ? "Lendo identificação…" : "Aproxime a tag do celular"}</h2>
        <p>Encoste o brinco eletrônico ou a tag na área NFC do aparelho.</p>
        <button className="nfc-native-read-button" onClick={() => void startNativeRead()} disabled={scanning}><Radio size={18} /> {scanning ? "Aguardando etiqueta" : "Iniciar leitura"}</button>
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

      <Modal open={nativeInfo} onClose={() => setNativeInfo(false)} eyebrow="LEITURA NFC" title={availability === "disabled" ? "Ative o NFC do celular" : "Leitura por aproximação indisponível"}>
        <div className="hardware-message">
          <span><Smartphone size={31} /></span>
          <p>{availability === "disabled"
            ? "O NFC está desativado. Ative-o nas configurações do Android e tente novamente."
            : isIos
              ? "O NFC estará disponível em breve no iOS. Enquanto isso, use o código manual."
              : availability === "web"
                ? "A leitura por aproximação funciona no app Android. Neste dispositivo, use o código manual."
              : "Este aparelho não oferece leitura NFC compatível. Use o código manual ou outro celular Android com NFC."}</p>
          <div className="future-data-list"><div><Nfc size={17} /> Leitura por aproximação no Android</div><div><span className="tiny-shield" /> Código manual em qualquer dispositivo</div></div>
          {availability === "disabled" && <button className="secondary-button full" onClick={() => void openNfcSettings()}><Settings size={17} /> Abrir configurações</button>}
          <button className="primary-button full" onClick={() => setNativeInfo(false)}>Usar código manual</button>
        </div>
      </Modal>
    </div>
  );
}
