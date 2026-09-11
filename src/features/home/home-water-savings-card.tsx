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

export function HomeWaterSavingsCard({ account, onOpen }: Props) {
  const summary = calculateWaterConsumption(account.waterRecords);
  const topPurpose = summary.purposeBreakdown[0];

  const statusIcon = summary.status === "saving"
    ? <TrendingDown size={12} />
    : summary.status === "higher"
      ? <TrendingUp size={12} />
      : <Minus size={12} />;

  const statusLabel = summary.status === "saving"
    ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% menos`
    : summary.status === "higher"
      ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% mais`
      : summary.status === "stable"
        ? "Estável"
        : "Sem comparação";

  const insight = summary.status === "saving"
    ? `${formatLiters(summary.savingsLiters)} economizados no período comparado`
    : summary.status === "higher"
      ? `${formatLiters(Math.abs(summary.differenceLiters))} acima do período anterior`
      : summary.status === "stable"
        ? "Consumo praticamente igual ao período anterior"
        : summary.measuredDays === 0
          ? "Registre o primeiro consumo para começar"
          : `Faltam ${summary.readingsNeeded} dia${summary.readingsNeeded === 1 ? "" : "s"} medido${summary.readingsNeeded === 1 ? "" : "s"} para comparar`;

  const averageText = summary.measuredDays > 0
    ? `Média ${formatLiters(summary.currentDailyAverage)}/dia`
    : "Média —";

  const daysText = summary.currentMonthDays > 0
    ? `${summary.currentMonthDays} dia${summary.currentMonthDays === 1 ? "" : "s"} no mês`
    : "0 dias no mês";

  const purposeText = topPurpose
    ? `${topPurpose.key} ${Math.round(topPurpose.percent)}%`
    : "Uso ainda não definido";

  return (
    <button
      type="button"
      className={`home-water-savings-card ${summary.status}`}
      onClick={onOpen}
      aria-label="Abrir consumo e economia de água da fazenda"
    >
      <span className="home-water-savings-icon"><Droplets size={19} /></span>

      <span className="home-water-savings-copy">
        <span className="home-water-savings-topline">
          <strong>Água</strong>
          <span className={`home-water-card-status ${summary.status}`}>{statusIcon}{statusLabel}</span>
        </span>

        <span className="home-water-savings-value">
          <strong>{summary.currentMonthTotal > 0 ? formatLiters(summary.currentMonthTotal) : "—"}</strong>
          <em>consumidos neste mês</em>
        </span>

        <span className="home-water-savings-meta" aria-label="Resumo do consumo de água">
          <span>{averageText}</span>
          <i aria-hidden="true" />
          <span>{daysText}</span>
          <i aria-hidden="true" />
          <span>{purposeText}</span>
        </span>

        <span className="home-water-savings-detail">{insight}</span>
      </span>

      <ChevronRight className="home-water-savings-arrow" size={18} />
    </button>
  );
}
