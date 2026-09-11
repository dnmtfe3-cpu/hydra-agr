"use client";

import { ChevronRight, Droplets, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { calculateWaterSavings } from "../../lib/water-savings";
import "./home-water-savings-card.css";

type Props = {
  account: HydraAccount;
  onOpen: () => void;
};

function formatLiters(value: number) {
  return `${Math.round(value).toLocaleString("pt-BR")} L`;
}

export function HomeWaterSavingsCard({ account, onOpen }: Props) {
  const insight = calculateWaterSavings(account.waterRecords);
  const statusIcon = insight.status === "saving"
    ? <TrendingDown size={20} />
    : insight.status === "higher"
      ? <TrendingUp size={20} />
      : <Minus size={20} />;

  const headline = insight.status === "saving"
    ? `${insight.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a menos`
    : insight.status === "higher"
      ? `${insight.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a mais`
      : insight.status === "stable"
        ? "Consumo estável"
        : "Comece a medir";

  const detail = insight.status === "saving"
    ? `${formatLiters(insight.savingsLiters)} economizados nos últimos ${insight.comparisonDays} dias medidos`
    : insight.status === "higher"
      ? `${formatLiters(Math.abs(insight.litersDifference))} acima dos ${insight.comparisonDays} dias medidos anteriores`
      : insight.status === "stable"
        ? `Média de ${formatLiters(insight.currentAverage)} por dia medido`
        : insight.readingsNeeded > 0
          ? `Registre em mais ${insight.readingsNeeded} dia${insight.readingsNeeded === 1 ? "" : "s"} para comparar o consumo`
          : "Registre leituras para acompanhar consumo e economia";

  return (
    <button type="button" className={`home-water-savings-card ${insight.status}`} onClick={onOpen}>
      <span className="home-water-savings-icon"><Droplets size={22} /></span>
      <span className="home-water-savings-copy">
        <small>ECONOMIA DE ÁGUA</small>
        <strong>{headline}</strong>
        <em>{detail}</em>
      </span>
      <span className="home-water-savings-trend" aria-hidden="true">{statusIcon}</span>
      <ChevronRight className="home-water-savings-arrow" size={19} />
    </button>
  );
}
