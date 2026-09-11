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
  const maxRecent = Math.max(...summary.recentDailyTotals.map((item) => item.liters), 1);
  const topPurpose = summary.purposeBreakdown[0];
  const topSource = summary.sourceBreakdown[0];
  const topSourceName = topSource
    ? account.waterSources.find((source) => source.id === topSource.key)?.name || "Fonte registrada"
    : "";

  const statusIcon = summary.status === "saving"
    ? <TrendingDown size={15} />
    : summary.status === "higher"
      ? <TrendingUp size={15} />
      : <Minus size={15} />;

  const statusLabel = summary.status === "saving"
    ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% menos`
    : summary.status === "higher"
      ? `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% mais`
      : summary.status === "stable"
        ? "Consumo estável"
        : "Comparação em breve";

  const comparisonText = summary.status === "saving"
    ? `${formatLiters(summary.savingsLiters)} economizados nos últimos ${summary.comparisonDays} dias medidos`
    : summary.status === "higher"
      ? `${formatLiters(Math.abs(summary.differenceLiters))} acima do período anterior`
      : summary.status === "stable"
        ? `Variação abaixo de 3% entre os períodos medidos`
        : summary.measuredDays === 0
          ? "Registre o consumo para começar o acompanhamento"
          : `Mais ${summary.readingsNeeded} dia${summary.readingsNeeded === 1 ? "" : "s"} medido${summary.readingsNeeded === 1 ? "" : "s"} para comparar`;

  return (
    <button
      type="button"
      className={`home-water-savings-card ${summary.status}`}
      onClick={onOpen}
      aria-label="Abrir consumo e economia de água da fazenda"
    >
      <span className="home-water-card-head">
        <span className="home-water-savings-icon"><Droplets size={21} /></span>
        <span className="home-water-card-title">
          <small>GESTÃO HÍDRICA</small>
          <strong>Água da fazenda</strong>
          <em>Consumo, economia e tendência</em>
        </span>
        <ChevronRight className="home-water-savings-arrow" size={19} />
      </span>

      <span className="home-water-card-primary">
        <span className="home-water-card-consumption">
          <small>CONSUMO NESTE MÊS</small>
          <strong>{summary.currentMonthTotal > 0 ? formatLiters(summary.currentMonthTotal) : "—"}</strong>
          <em>{summary.currentMonthDays > 0 ? `${summary.currentMonthDays} dia${summary.currentMonthDays === 1 ? "" : "s"} com registro` : "Sem leitura neste mês"}</em>
        </span>
        <span className={`home-water-card-status ${summary.status}`}>
          {statusIcon}
          {statusLabel}
        </span>
      </span>

      {summary.recentDailyTotals.length > 0 ? (
        <span className="home-water-mini-chart" aria-label="Consumo dos últimos dias medidos">
          {summary.recentDailyTotals.map((item) => (
            <span className="home-water-mini-bar" key={item.date} title={`${item.date}: ${formatLiters(item.liters)}`}>
              <i style={{ height: `${Math.max((item.liters / maxRecent) * 100, 12)}%` }} />
            </span>
          ))}
        </span>
      ) : (
        <span className="home-water-mini-empty">O gráfico aparece conforme as leituras são registradas.</span>
      )}

      <span className="home-water-card-metrics">
        <span className="home-water-card-metric">
          <small>MÉDIA RECENTE</small>
          <strong>{summary.measuredDays > 0 ? formatLiters(summary.currentDailyAverage) : "—"}</strong>
          <em>por dia medido</em>
        </span>
        <span className="home-water-card-metric">
          <small>MAIOR USO</small>
          <strong>{topPurpose?.key || "—"}</strong>
          <em>{topPurpose ? `${Math.round(topPurpose.percent)}% do período recente` : "sem dados ainda"}</em>
        </span>
      </span>

      <span className="home-water-card-footer">
        <span>{comparisonText}</span>
        <span className="home-water-card-source">{topSourceName ? `Fonte: ${topSourceName}` : "Toque para registrar"}</span>
      </span>
    </button>
  );
}
