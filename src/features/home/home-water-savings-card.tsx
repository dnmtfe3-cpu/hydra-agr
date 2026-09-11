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

  const statusIcon = summary.status === "saving"
    ? <TrendingDown size={13} />
    : summary.status === "higher"
      ? <TrendingUp size={13} />
      : <Minus size={13} />;

  const statusLabel = summary.status === "saving"
    ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% menos`
    : summary.status === "higher"
      ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% mais`
      : summary.status === "stable"
        ? "Estável"
        : "Medindo";

  const detail = summary.status === "saving"
    ? `${formatLiters(summary.savingsLiters)} economizados vs. período anterior`
    : summary.status === "higher"
      ? `${formatLiters(Math.abs(summary.differenceLiters))} acima do período anterior`
      : summary.status === "stable"
        ? `Média recente de ${formatLiters(summary.currentDailyAverage)}/dia`
        : summary.measuredDays === 0
          ? "Registre o consumo para começar"
          : `Faltam ${summary.readingsNeeded} dia${summary.readingsNeeded === 1 ? "" : "s"} medido${summary.readingsNeeded === 1 ? "" : "s"} para comparar`;

  const monthMeta = summary.currentMonthDays > 0
    ? `${summary.currentMonthDays} dia${summary.currentMonthDays === 1 ? "" : "s"} registrado${summary.currentMonthDays === 1 ? "" : "s"}`
    : "Sem registro neste mês";

  return (
    <button
      type="button"
      className={`home-water-savings-card ${summary.status}`}
      onClick={onOpen}
      aria-label="Abrir consumo e economia de água da fazenda"
    >
      <span className="home-water-savings-icon"><Droplets size={20} /></span>

      <span className="home-water-savings-copy">
        <span className="home-water-savings-topline">
          <small>ÁGUA DA FAZENDA</small>
          <span className={`home-water-card-status ${summary.status}`}>{statusIcon}{statusLabel}</span>
        </span>
        <span className="home-water-savings-value">
          <strong>{summary.currentMonthTotal > 0 ? formatLiters(summary.currentMonthTotal) : "—"}</strong>
          <em>no mês</em>
        </span>
        <span className="home-water-savings-detail">{monthMeta} · {detail}</span>
      </span>

      <ChevronRight className="home-water-savings-arrow" size={18} />
    </button>
  );
}
