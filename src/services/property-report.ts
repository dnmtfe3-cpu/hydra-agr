import type { HydraAccount } from "../lib/hydra-types";

type PdfLine = { text: string; size?: number; bold?: boolean; gapAfter?: number };

function clean(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function escapePdf(value: string) {
  return clean(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, max = 88) {
  const words = clean(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function dateLabel(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildLines(account: HydraAccount): PdfLine[] {
  const now = new Date();
  const pending = account.activities.filter((activity) => !activity.done);
  const overdue = pending.filter((activity) => new Date(activity.date).getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  const identified = account.animals.filter((animal) => Boolean(animal.electronicId)).length;
  const weighted = account.animals.filter((animal) => Number(animal.weight ?? 0) > 0).length;
  const occurrences = account.monitoring.filter((record) => Boolean(record.occurrence?.trim()));

  const lines: PdfLine[] = [
    { text: "HYDRA AGRO", size: 18, bold: true, gapAfter: 5 },
    { text: "Relatório da propriedade", size: 13, bold: true, gapAfter: 2 },
    { text: `Gerado em ${now.toLocaleString("pt-BR")}`, size: 9, gapAfter: 12 },
    { text: "PROPRIEDADE", size: 11, bold: true, gapAfter: 4 },
    { text: `Nome: ${account.property.name || "Não informado"}` },
    { text: `Localização: ${account.property.municipality || "Não informada"}${account.property.state ? ` - ${account.property.state}` : ""}` },
    { text: `Atividade principal: ${account.property.mainActivity || "Não informada"}` },
    { text: `Área: ${account.property.area ? `${account.property.area} ${account.property.areaUnit}` : "Não informada"}`, gapAfter: 10 },
    { text: "REBANHO", size: 11, bold: true, gapAfter: 4 },
    { text: countLabel(account.animals.length, "animal cadastrado", "animais cadastrados") },
    { text: countLabel(identified, "animal identificado por NFC/RFID", "animais identificados por NFC/RFID") },
    { text: countLabel(weighted, "animal com peso registrado", "animais com peso registrado") },
    { text: countLabel(account.nfcReadCount, "leitura NFC registrada", "leituras NFC registradas"), gapAfter: 8 },
  ];

  account.animals.slice(0, 18).forEach((animal) => {
    lines.push({ text: `- ${animal.identification}${animal.name ? ` | ${animal.name}` : ""} | ${animal.species}${animal.weight ? ` | ${animal.weight} kg` : ""} | ${animal.electronicId ? "NFC vinculado" : "sem NFC"}` });
  });
  if (account.animals.length > 18) lines.push({ text: `... e mais ${countLabel(account.animals.length - 18, "animal", "animais")}.` });

  lines.push(
    { text: "", gapAfter: 3 },
    { text: "TAREFAS", size: 11, bold: true, gapAfter: 4 },
    { text: countLabel(account.activities.length, "tarefa cadastrada", "tarefas cadastradas") },
    { text: countLabel(pending.length, "tarefa pendente", "tarefas pendentes") },
    { text: countLabel(overdue.length, "tarefa atrasada", "tarefas atrasadas"), gapAfter: 6 },
  );

  pending.slice(0, 12).forEach((activity) => lines.push({ text: `- ${activity.title} | ${activity.category} | ${dateLabel(activity.date)}` }));

  lines.push(
    { text: "", gapAfter: 3 },
    { text: "MONITORAMENTO E OCORRÊNCIAS", size: 11, bold: true, gapAfter: 4 },
    { text: countLabel(account.monitoring.length, "monitoramento registrado", "monitoramentos registrados") },
    { text: countLabel(occurrences.length, "registro com ocorrência", "registros com ocorrência"), gapAfter: 6 },
  );
  occurrences.slice(0, 10).forEach((record) => lines.push({ text: `- ${dateLabel(record.date)} | ${record.type}: ${record.occurrence}` }));

  lines.push(
    { text: "", gapAfter: 4 },
    { text: "Observação", size: 10, bold: true, gapAfter: 3 },
    { text: "Este relatório foi gerado com os registros disponíveis no Hydra Agro no momento da exportação. Ele serve para organização da propriedade e não substitui avaliação técnica ou veterinária." },
    { text: "", gapAfter: 5 },
    { text: "Tecnologia que nasce do campo", size: 9, bold: true },
  );

  return lines;
}

function paginate(lines: PdfLine[]) {
  const pages: PdfLine[][] = [[]];
  let y = 792;
  for (const item of lines) {
    const wrapped = wrapText(item.text, item.size && item.size >= 13 ? 62 : 88);
    const lineHeight = (item.size ?? 9.5) * 1.5;
    for (const text of wrapped) {
      if (y < 54) {
        pages.push([]);
        y = 792;
      }
      pages[pages.length - 1].push({ ...item, text, gapAfter: 0 });
      y -= lineHeight;
    }
    y -= item.gapAfter ?? 2;
  }
  return pages;
}

function streamForPage(lines: PdfLine[]) {
  let y = 792;
  const chunks: string[] = [];
  for (const line of lines) {
    const size = line.size ?? 9.5;
    chunks.push(`BT /${line.bold ? "F2" : "F1"} ${size} Tf 44 ${y.toFixed(1)} Td (${escapePdf(line.text)}) Tj ET`);
    y -= size * 1.5 + (line.gapAfter ?? 2);
  }
  return chunks.join("\n");
}

function pdfBytes(account: HydraAccount) {
  const pages = paginate(buildLines(account));
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const stream = streamForPage(page);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Uint8Array(Array.from(pdf, (char) => char.charCodeAt(0) & 0xff));
}

export function downloadPropertyReportPdf(account: HydraAccount) {
  const bytes = pdfBytes(account);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const safeName = (account.property.name || "propriedade").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "propriedade";
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hydra-agro-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
