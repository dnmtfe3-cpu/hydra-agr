"use client";

import { ClipboardList, Download, FileSpreadsheet, Share2, Sprout, UtensilsCrossed, Beef as Cow } from "lucide-react";
import { Modal } from "../../components/ui";
import { showAppToast } from "../../components/modal-system";
import type { HydraAccount } from "../../lib/hydra-types";
import "./hydra-spreadsheet-panel.css";

type Props = {
  account: HydraAccount;
  open: boolean;
  onClose: () => void;
};

type SheetKind = "herd" | "activities" | "feeding" | "property";

type SpreadsheetFile = {
  name: string;
  file: File;
};

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(";"));
  return `\uFEFF${lines.join("\r\n")}`;
}

function dateLabel(value?: string) {
  if (!value) return "";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("pt-BR");
}

function safeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "propriedade";
}

function buildSpreadsheet(account: HydraAccount, kind: SheetKind): SpreadsheetFile {
  const farm = safeName(account.property.name || "hydra-agro");
  const stamp = new Date().toISOString().slice(0, 10);
  let label = "dados";
  let body = "";

  if (kind === "herd") {
    label = "rebanho";
    body = csv(
      ["Identificação", "Nome", "Espécie", "Raça", "Sexo", "Nascimento", "Peso (kg)", "Situação", "NFC/RFID", "Observações"],
      account.animals.map((animal) => [
        animal.identification,
        animal.name || "",
        animal.species,
        animal.breed || "",
        animal.sex || "",
        dateLabel(animal.birthDate),
        animal.weight ?? "",
        animal.status,
        animal.electronicId || "",
        animal.notes || "",
      ]),
    );
  }

  if (kind === "activities") {
    label = "atividades";
    body = csv(
      ["Data", "Atividade", "Categoria", "Situação", "Setor", "Animal", "Observações"],
      account.activities.map((activity) => {
        const sector = account.sectors.find((item) => item.id === activity.sectorId)?.name || "";
        const animal = account.animals.find((item) => item.id === activity.animalId);
        return [dateLabel(activity.date), activity.title, activity.category, activity.done ? "Concluída" : "Pendente", sector, animal?.name || animal?.identification || "", activity.note || ""];
      }),
    );
  }

  if (kind === "feeding") {
    label = "alimentacao";
    const feeding = account.activities.filter((activity) => activity.category.trim().toLocaleLowerCase("pt-BR").includes("alimenta"));
    body = csv(
      ["Data", "Registro de alimentação", "Situação", "Setor", "Animal", "Observações"],
      feeding.map((activity) => {
        const sector = account.sectors.find((item) => item.id === activity.sectorId)?.name || "";
        const animal = account.animals.find((item) => item.id === activity.animalId);
        return [dateLabel(activity.date), activity.title, activity.done ? "Concluída" : "Pendente", sector, animal?.name || animal?.identification || "", activity.note || ""];
      }),
    );
  }

  if (kind === "property") {
    label = "resumo-propriedade";
    const identified = account.animals.filter((animal) => Boolean(animal.electronicId)).length;
    const pending = account.activities.filter((activity) => !activity.done).length;
    body = csv(
      ["Campo", "Informação"],
      [
        ["Propriedade", account.property.name],
        ["Produtor", account.profile.name],
        ["Município", account.property.municipality],
        ["Estado", account.property.state],
        ["Localização", account.property.locationDetails || ""],
        ["Área", `${account.property.area || ""} ${account.property.areaUnit || ""}`.trim()],
        ["Tipo de propriedade", account.property.type],
        ["Atividade principal", account.property.mainActivity],
        ["Outras atividades", account.property.otherActivities.join(", ")],
        ["Animais cadastrados", account.animals.length],
        ["Animais com NFC/RFID", identified],
        ["Setores cadastrados", account.sectors.length],
        ["Atividades pendentes", pending],
        ["Leituras NFC/RFID", account.nfcReadCount],
      ],
    );
  }

  const name = `hydra-${label}-${farm}-${stamp}.csv`;
  return { name, file: new File([body], name, { type: "text/csv;charset=utf-8" }) };
}

function downloadSpreadsheet(spreadsheet: SpreadsheetFile) {
  const url = URL.createObjectURL(spreadsheet.file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = spreadsheet.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function shareSpreadsheet(spreadsheet: SpreadsheetFile) {
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [spreadsheet.file] }))) {
    try {
      await navigator.share({
        title: "Hydra Planilha",
        text: "Planilha gerada pelo Hydra Agro.",
        files: [spreadsheet.file],
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  downloadSpreadsheet(spreadsheet);
  showAppToast("Arquivo baixado. Você já pode enviar pelo WhatsApp.");
}

const sheets: { kind: SheetKind; title: string; description: string; icon: typeof Cow }[] = [
  { kind: "herd", title: "Rebanho", description: "Animais, peso, situação e NFC/RFID.", icon: Cow },
  { kind: "activities", title: "Atividades", description: "Rotina completa, pendências e responsáveis pelos registros.", icon: ClipboardList },
  { kind: "feeding", title: "Alimentação", description: "Registros classificados como alimentação no Hydra.", icon: UtensilsCrossed },
  { kind: "property", title: "Resumo da propriedade", description: "Dados gerais e indicadores da fazenda.", icon: Sprout },
];

export function HydraSpreadsheetPanel({ account, open, onClose }: Props) {
  function download(kind: SheetKind) {
    const spreadsheet = buildSpreadsheet(account, kind);
    downloadSpreadsheet(spreadsheet);
    showAppToast("Planilha gerada com sucesso");
  }

  function share(kind: SheetKind) {
    void shareSpreadsheet(buildSpreadsheet(account, kind));
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="HYDRA PLANILHA" title="Dados prontos para levar" wide>
      <div className="hydra-sheet-intro">
        <span><FileSpreadsheet size={24} /></span>
        <div><strong>Exportação simples e gratuita</strong><p>Os arquivos abrem no Excel, Google Planilhas e similares. No celular, use compartilhar para enviar pelo WhatsApp.</p></div>
      </div>

      <div className="hydra-sheet-list">
        {sheets.map((sheet) => {
          const Icon = sheet.icon;
          const empty = sheet.kind === "herd" ? account.animals.length === 0 : sheet.kind === "activities" ? account.activities.length === 0 : sheet.kind === "feeding" ? !account.activities.some((item) => item.category.trim().toLocaleLowerCase("pt-BR").includes("alimenta")) : false;
          return (
            <article className="hydra-sheet-card" key={sheet.kind}>
              <span className="hydra-sheet-icon"><Icon size={21} /></span>
              <div className="hydra-sheet-copy"><strong>{sheet.title}</strong><small>{empty ? "Sem registros para exportar agora." : sheet.description}</small></div>
              <div className="hydra-sheet-actions">
                <button onClick={() => download(sheet.kind)} aria-label={`Baixar planilha de ${sheet.title}`} title="Baixar"><Download size={18} /></button>
                <button className="share" onClick={() => share(sheet.kind)} aria-label={`Compartilhar planilha de ${sheet.title}`} title="Compartilhar"><Share2 size={18} /></button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="hydra-sheet-footnote">Formato CSV com separação compatível com planilhas em português. Nenhum serviço pago é necessário para gerar os arquivos.</p>
    </Modal>
  );
}
