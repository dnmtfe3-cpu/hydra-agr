"use client";

import { BarChart3, CalendarDays, Droplets, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { HydraAccount } from "../../lib/hydra-types";
import { calculateWaterConsumption } from "../../lib/water-savings";
import "./water-consumption-panel.css";

type Props = {
  account: HydraAccount;
  onRegister: () => void;
};

function liters(value: number) {
  return `${Math.round(value).toLocaleString("pt-BR")} L`;
}

function shortDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function WaterConsumptionPanel({ account, onRegister }: Props) {
  const summary = calculateWaterConsumption(account.waterRecords);
  const maxRecent = Math.max(...summary.recentDailyTotals.map((item) => item.liters), 1);
  const sourceNames = new Map(account.waterSources.map((source) => [source.id, source.name]));

  const comparisonTitle = summary.status === "saving"
    ? `Economia de ${liters(summary.savingsLiters)}`
    : summary.status === "higher"
      ? `${liters(Math.abs(summary.differenceLiters))} a mais`
      : summary.status === "stable"
        ? "Consumo estável"
        : "Ainda aprendendo seu consumo";

  const comparisonText = summary.status === "insufficient"
    ? summary.readingsNeeded > 0
      ? `Registre água em mais ${summary.readingsNeeded} dia${summary.readingsNeeded === 1 ? "" : "s"} diferente${summary.readingsNeeded === 1 ? "" : "s"} para comparar períodos.`
      : "Continue registrando para criar uma referência confiável."
    : `${Math.abs(summary.changePercent).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ${summary.status === "saving" ? "abaixo" : summary.status === "higher" ? "acima" : "de variação em relação"} aos ${summary.comparisonDays} dias medidos anteriores.`;

  const TrendIcon = summary.status === "saving" ? TrendingDown : summary.status === "higher" ? TrendingUp : Minus;
  const purposes = summary.purposeBreakdown.slice(0, 3);
  const topSource = summary.sourceBreakdown[0];

  return (
    <section className={`water-consumption-panel ${summary.status}`} aria-label="Consumo de água da fazenda">
      <div className="water-consumption-heading">
        <div>
          <span>CONSUMO DA FAZENDA</span>
          <h2>Acompanhe onde a água está indo</h2>
          <p>Os cálculos usam somente as quantidades que você registra.</p>
        </div>
        <span className="water-consumption-heading-icon"><Droplets size={22} /></span>
      </div>

      {summary.measuredDays === 0 ? (
        <div className="water-consumption-empty">
          <span><BarChart3 size={25} /></span>
          <div><strong>Registre a primeira leitura</strong><p>Depois disso, o Hydra começa a montar o histórico de consumo da propriedade.</p></div>
          <button type="button" onClick={onRegister}>Registrar</button>
        </div>
      ) : (
        <>
          <div className="water-consumption-main">
            <div className="water-consumption-volume">
              <small>{summary.comparisonDays >= 2 ? `ÚLTIMOS ${summary.comparisonDays} DIAS MEDIDOS` : "PERÍODO MEDIDO"}</small>
              <strong>{liters(summary.currentWindowTotal)}</strong>
              <span>Média de {liters(summary.currentDailyAverage)} por dia medido</span>
            </div>
            <div className={`water-consumption-comparison ${summary.status}`}>
              <TrendIcon size={19} />
              <div><strong>{comparisonTitle}</strong><span>{comparisonText}</span></div>
            </div>
          </div>

          <div className="water-consumption-metrics">
            <div><CalendarDays size={16} /><span><small>Este mês</small><strong>{liters(summary.currentMonthTotal)}</strong></span></div>
            <div><Droplets size={16} /><span><small>Total registrado</small><strong>{liters(summary.totalRegistered)}</strong></span></div>
            <div><BarChart3 size={16} /><span><small>Dias medidos</small><strong>{summary.measuredDays}</strong></span></div>
          </div>

          {summary.recentDailyTotals.length > 0 && (
            <div className="water-consumption-chart-block">
              <div className="water-consumption-subhead"><strong>Consumo por dia</strong><span>últimos registros</span></div>
              <div className="water-consumption-bars" aria-label="Consumo de água por dia medido">
                {summary.recentDailyTotals.map((item) => (
                  <div key={item.date} className="water-consumption-bar">
                    <span>{Math.round(item.liters).toLocaleString("pt-BR")}</span>
                    <i><b style={{ height: `${Math.max((item.liters / maxRecent) * 100, 8)}%` }} /></i>
                    <small>{shortDate(item.date)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {purposes.length > 0 && (
            <div className="water-consumption-breakdown">
              <div className="water-consumption-subhead"><strong>Onde está sendo usada</strong><span>{summary.comparisonDays >= 2 ? `últimos ${summary.comparisonDays} dias medidos` : "registros atuais"}</span></div>
              <div className="water-consumption-uses">
                {purposes.map((item) => (
                  <div key={item.key}>
                    <div><strong>{item.key}</strong><span>{liters(item.liters)} · {item.percent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</span></div>
                    <i><b style={{ width: `${Math.max(item.percent, 4)}%` }} /></i>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="water-consumption-note">
            <Droplets size={15} />
            <span>{topSource ? `Maior origem no período: ${sourceNames.get(topSource.key) || "Fonte removida"}, com ${liters(topSource.liters)}.` : "Cadastre a origem de cada leitura para saber quais fontes mais abastecem a fazenda."}</span>
          </div>
        </>
      )}

      <p className="water-consumption-method">Dias sem leitura não são tratados como consumo zero. A economia só aparece quando existem períodos medidos suficientes para uma comparação justa.</p>
    </section>
  );
}
