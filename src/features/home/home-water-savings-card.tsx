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
    ? `≈ ${formatLiters(insight.litersPerReading)} economizados por leitura recente`
    : insight.status === "higher"
      ? `≈ ${formatLiters(insight.litersPerReading)} acima da média anterior`
      : insight.status === "stable"
        ? `Média recente de ${formatLiters(insight.currentAverage)} por leitura`
        : insight.readingsNeeded > 0
          ? `Faltam ${insight.readingsNeeded} leitura${insight.readingsNeeded === 1 ? "" : "s"} para comparar o consumo`
          : "Registre leituras para comparar o consumo";

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
