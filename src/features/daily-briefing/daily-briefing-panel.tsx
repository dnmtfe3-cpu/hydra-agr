"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { HydraAccount } from "../../lib/hydra-types";
import {
  buildDailyBriefing,
  defaultDailyBriefingSettings,
  loadDailyBriefingSettings,
  scheduleDailyBriefing,
  shareDailyBriefing,
  type DailyBriefingSettings,
} from "../../services/daily-briefing";
import "./daily-briefing-panel.css";

type Props = {
  account: HydraAccount;
  open: boolean;
  onClose: () => void;
};

export function DailyBriefingPanel({ account, open, onClose }: Props) {
  const [settings, setSettings] = useState<DailyBriefingSettings>(defaultDailyBriefingSettings);
  const [saving, setSaving] = useState(false);
  const briefing = useMemo(() => buildDailyBriefing(account), [account]);

  useEffect(() => {
    if (!open) return;
    void loadDailyBriefingSettings().then(setSettings);
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const result = await scheduleDailyBriefing(account, settings);
      if (result.reason === "web") {
        showAppToast("No site, o resumo fica disponível para compartilhar. O aviso diário automático funciona no APK.");
      } else if (result.reason === "permission") {
        showAppToast("Permita notificações do Hydra Agro no celular para ativar o aviso diário.", "error");
      } else if (result.reason === "disabled") {
        showAppToast("Aviso diário desativado");
      } else {
        showAppToast(`Aviso diário ativado para ${String(settings.hour).padStart(2, "0")}:${String(settings.minute).padStart(2, "0")}`);
      }
    } catch {
      showAppToast("Não foi possível configurar o aviso diário neste aparelho.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const result = await shareDailyBriefing(account);
    if (result === "copied") showAppToast("Resumo copiado. Cole no WhatsApp para enviar.");
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="HYDRA AVISOS" title="O que fazer hoje" wide>
      <div className="daily-briefing-preview">
        <span><BellRing size={24} /></span>
        <div><strong>{briefing.title}</strong><p>{briefing.body}</p></div>
      </div>

      <div className="daily-briefing-metrics">
        <div><strong>{briefing.dueToday.length}</strong><small>para hoje</small></div>
        <div><strong>{briefing.overdue.length}</strong><small>atrasadas</small></div>
        <div><strong>{briefing.healthAttention.length}</strong><small>em atenção</small></div>
        <div><strong>{briefing.withoutNfc.length}</strong><small>sem NFC</small></div>
      </div>

      <section className="daily-briefing-settings">
        <label className="daily-briefing-switch">
          <span><BellRing size={19} /><span><strong>Resumo diário no celular</strong><small>Notificação local, sem mensalidade e sem API paga.</small></span></span>
          <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
        </label>

        <label className="daily-briefing-time">
          <span><Clock3 size={19} /><span><strong>Horário</strong><small>Escolha quando o Hydra deve lembrar você.</small></span></span>
          <input
            type="time"
            value={`${String(settings.hour).padStart(2, "0")}:${String(settings.minute).padStart(2, "0")}`}
            disabled={!settings.enabled}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(":").map(Number);
              setSettings({ ...settings, hour, minute });
            }}
          />
        </label>
      </section>

      <div className="daily-briefing-actions">
        <button className="secondary-button" onClick={() => void share()}><MessageCircle size={18} /> Enviar no WhatsApp</button>
        <button className="primary-button" disabled={saving} onClick={() => void save()}><CheckCircle2 size={18} /> {saving ? "Salvando..." : "Salvar aviso"}</button>
      </div>

      <p className="daily-briefing-note"><ShieldCheck size={15} /> O WhatsApp não permite disparo automático gratuito sem a API oficial. Nesta versão grátis, o aviso chega pelo próprio Hydra e o resumo pode ser enviado ao WhatsApp com um toque.</p>
    </Modal>
  );
}
