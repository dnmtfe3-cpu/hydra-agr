"use client";

import { ChevronRight, Droplets, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { calculateWaterConsumption } from "../../lib/water-savings";
import "./home-water-savings-card.css";

type Props = {
  account: HydraAccount;
  onOpen: () => void;
};

function formatLiters(value: number) {
  const rounded = Math.max(0, value);
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi L`;
  if (rounded >= 1_000) return `${(rounded / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil L`;
  return `${Math.round(rounded).toLocaleString("pt-BR")} L`;
}

function shortenPurpose(value?: string) {
  if (!value) return "—";
  return value
    .replace(/^consumo\s+/i, "")
    .replace(/^uso\s+/i, "")
    .trim();
}

export function HomeWaterSavingsCard({ account, onOpen }: Props) {
  const summary = calculateWaterConsumption(account.waterRecords);
  const topPurpose = summary.purposeBreakdown[0];
  const hasMonthData = summary.currentMonthDays > 0;
  const hasAnyData = summary.measuredDays > 0;

  const statusIcon = summary.status === "saving"
    ? <TrendingDown size={12} />
    : summary.status === "higher"
      ? <TrendingUp size={12} />
      : <Minus size={12} />;

  const statusLabel = summary.status === "saving"
    ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% menor`
    : summary.status === "higher"
      ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% maior`
      : summary.status === "stable"
        ? "Estável"
        : hasAnyData
          ? "Dados iniciais"
          : "Sem registros";

  const insight = summary.status === "saving"
    ? `${formatLiters(summary.savingsLiters)} economizados no período comparado`
    : summary.status === "higher"
      ? `${formatLiters(Math.abs(summary.differenceLiters))} a mais que no período anterior`
      : summary.status === "stable"
        ? "Consumo praticamente igual ao período anterior"
        : !hasAnyData
          ? "Registre o consumo para começar a acompanhar"
          : `Registre mais ${summary.readingsNeeded} dia${summary.readingsNeeded === 1 ? "" : "s"} para liberar a comparação`;

  const monthValue = hasMonthData ? formatLiters(summary.currentMonthTotal) : "Sem registros";
  const averageValue = hasAnyData ? formatLiters(summary.currentDailyAverage) : "—";
  const purposeValue = topPurpose ? shortenPurpose(topPurpose.key) : "—";
  const purposePercent = topPurpose ? `${Math.round(topPurpose.percent)}%` : "";

  return (
    <button
      type="button"
      className={`home-water-savings-card ${summary.status}`}
      onClick={onOpen}
      aria-label="Abrir consumo e economia de água da fazenda"
    >
      <span className="home-water-card-head">
        <span className="home-water-savings-icon"><Droplets size={17} /></span>
        <span className="home-water-card-heading">
          <strong>Água da fazenda</strong>
          <small>Consumo e economia</small>
        </span>
        <span className={`home-water-card-status ${summary.status}`}>{statusIcon}{statusLabel}</span>
        <ChevronRight className="home-water-savings-arrow" size={17} />
      </span>

      <span className="home-water-card-body">
        <span className="home-water-card-month">
          <small>ESTE MÊS</small>
          <strong className={!hasMonthData ? "empty" : ""}>{monthValue}</strong>
        </span>

        <span className="home-water-card-stats" aria-label="Resumo do consumo de água">
          <span>
            <small>MÉDIA/DIA</small>
            <strong>{averageValue}</strong>
          </span>
          <span>
            <small>DIAS MEDIDOS</small>
            <strong>{summary.measuredDays}</strong>
          </span>
          <span>
            <small>MAIOR USO</small>
            <strong title={topPurpose?.key}>{purposeValue}{purposePercent ? <em>{purposePercent}</em> : null}</strong>
          </span>
        </span>
      </span>

      <span className="home-water-savings-detail">{insight}</span>
    </button>
  );
}
