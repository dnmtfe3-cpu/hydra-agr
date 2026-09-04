"use client";

import "../../ranking.css";
import "./challenge-xp.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp, CheckCircle2, Crown, Gift, Info, RefreshCw, Target, Trophy } from "lucide-react";
import { Modal, ScreenHeader } from "../../components/ui";
import type { HydraAccount } from "../../lib/hydra-types";
import { farmExperience, farmMissions, MAX_FARM_LEVEL, MAX_FARM_XP, XP_PER_LEVEL, type FarmMissionTier } from "../../lib/farm-xp";
import { loadPropertyRanking, type PropertyRankingEntry } from "../../services/property-ranking";

type Props = { account: HydraAccount; onBack: () => void };

function MissionCard({ title, description, current, target, reward, completed }: { title: string; description: string; current: number; target: number; reward: number; completed: boolean }) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <article className={`challenge-card mission-xp-card ${completed ? "completed" : ""}`}>
      <span className="challenge-icon">{completed ? <CheckCircle2 size={21} /> : <Target size={21} />}</span>
      <div className="challenge-copy"><strong>{title}</strong><p>{description}</p></div>
      <em>+{reward} XP</em>
      <div className="challenge-progress"><i style={{ width: `${percent}%` }} /></div>
      <small>{completed ? "Concluída" : `${current}/${target}`}<b>{percent}%</b></small>
    </article>
  );
}

function PodiumPlace({ item }: { item: PropertyRankingEntry }) {
  return <div className={`ranking-podium-place place-${item.position} ${item.isMine ? "mine" : ""}`}><div className="ranking-podium-mark">{item.position === 1 ? <Crown size={20} /> : <span>{item.position}º</span>}</div><strong>{item.propertyName}</strong><small>{item.municipality || "Município não informado"}</small><b>{item.xp} XP</b></div>;
}

const tierLabels: Record<FarmMissionTier, { title: string; subtitle: string }> = {
  main: { title: "Principais", subtitle: "5 missões para começar" },
  medium: { title: "Médias", subtitle: "15 missões de evolução" },
  hard: { title: "Difíceis", subtitle: "30 missões da reta final" },
};

export function ChallengesScreen({ account, onBack }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [tier, setTier] = useState<FarmMissionTier>("main");
  const [ranking, setRanking] = useState<PropertyRankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");
  const experience = farmExperience(account);
  const missions = farmMissions(account);
  const completedMissions = missions.filter((mission) => mission.completed).length;
  const visibleMissions = useMemo(() => missions.filter((mission) => mission.tier === tier), [missions, tier]);
  const completedTier = visibleMissions.filter((mission) => mission.completed).length;
  const nextLevelXp = experience.level >= MAX_FARM_LEVEL ? MAX_FARM_XP : Math.min(MAX_FARM_XP, experience.level * XP_PER_LEVEL);

  const myRanking = ranking.find((item) => item.isMine);
  const topThree = ranking.slice(0, 3);
  const podium = [topThree[1], topThree[0], topThree[2]].filter(Boolean) as PropertyRankingEntry[];
  const nextAhead = myRanking && myRanking.position > 1 ? ranking.find((item) => item.position === myRanking.position - 1) : undefined;
  const xpToNext = myRanking && nextAhead ? Math.max(1, nextAhead.xp - myRanking.xp + 1) : 0;

  const refreshRanking = useCallback(async () => {
    setRankingLoading(true); setRankingError("");
    try { setRanking(await loadPropertyRanking()); }
    catch { setRankingError("Não foi possível carregar o ranking agora."); }
    finally { setRankingLoading(false); }
  }, []);

  useEffect(() => { void refreshRanking(); }, [refreshRanking]);

  return (
    <div className="screen page-enter extra-screen challenges-screen">
      <ScreenHeader title="Missões" subtitle="Complete desafios reais da fazenda e ganhe XP." onBack={onBack} action={<button className="icon-button bare" onClick={() => setInfoOpen(true)} aria-label="Sobre XP"><Info size={21} /></button>} />

      <section className={`xp-level-hero ${experience.level === MAX_FARM_LEVEL ? "max-level" : ""}`}>
        <div><span>SEU PROGRESSO</span><strong>{experience.xp.toLocaleString("pt-BR")} XP</strong><small>{experience.level >= MAX_FARM_LEVEL ? "Nível máximo" : `Próximo nível em ${nextLevelXp.toLocaleString("pt-BR")} XP`}</small></div>
        <span className="xp-level-badge">{experience.level}</span>
        <div className="challenge-progress"><i style={{ width: `${experience.progress}%` }} /></div>
        <p>{experience.lifetimeVip ? <><Crown size={17} /> Nível 10 · VIP vitalício liberado</> : <><Gift size={17} /> Nível {experience.level} · {completedMissions}/50 missões concluídas</>}</p>
      </section>

      <div className="mission-tier-tabs" role="tablist" aria-label="Dificuldade das missões">
        {(["main", "medium", "hard"] as FarmMissionTier[]).map((item) => <button key={item} className={tier === item ? "active" : ""} onClick={() => setTier(item)}><strong>{tierLabels[item].title}</strong><small>{tierLabels[item].subtitle}</small></button>)}
      </div>

      <div className="challenge-heading"><h2>{tierLabels[tier].title}</h2><span>{completedTier}/{visibleMissions.length}</span></div>
      <div className="challenge-list mission-tier-list">{visibleMissions.map((mission) => <MissionCard key={mission.id} {...mission} />)}</div>

      <section className="property-ranking-section" aria-label="Ranking de propriedades">
        <header className="property-ranking-head"><span><Trophy size={22} /></span><div><strong>Ranking de propriedades</strong><small>Top fazendas por XP acumulado.</small></div><button className={rankingLoading ? "loading" : ""} onClick={() => void refreshRanking()} disabled={rankingLoading} aria-label="Atualizar ranking"><RefreshCw size={18} /></button></header>
        {rankingLoading && <p className="property-ranking-message">Carregando propriedades…</p>}
        {!rankingLoading && rankingError && <p className="property-ranking-message error">{rankingError}</p>}
        {!rankingLoading && !rankingError && ranking.length === 0 && <p className="property-ranking-message">Ainda não há propriedades no ranking.</p>}
        {!rankingLoading && !rankingError && ranking.length > 0 && <>
          <div className={`ranking-podium count-${Math.min(3, topThree.length)}`}>{podium.map((item) => <PodiumPlace key={item.propertyId} item={item} />)}</div>
          <div className="ranking-my-position"><div className="ranking-my-number"><span>{myRanking ? `${myRanking.position}º` : "—"}</span><small>sua posição</small></div><div className="ranking-my-copy"><strong>{account.property.name || "Sua propriedade"}</strong><small>{myRanking ? `${myRanking.xp} XP acumulados` : `${experience.xp} XP calculados`}</small>{myRanking?.position === 1 ? <p>Você está liderando o ranking.</p> : myRanking && nextAhead ? <p><ArrowUp size={13} /> Faltam {xpToNext} XP para ultrapassar {nextAhead.propertyName}.</p> : <p>Sua posição aparece assim que o ranking sincronizar.</p>}</div></div>
          <div className="ranking-table-head"><span>Classificação</span><span>XP</span></div>
          <div className="property-ranking-list">{ranking.map((item) => <div key={item.propertyId} className={`property-ranking-row ${item.isMine ? "mine" : ""}`}><span className="property-ranking-position">{item.position}º</span><div className="property-ranking-copy"><strong>{item.propertyName}</strong><small>{item.municipality || "Município não informado"}{item.isMine ? " · sua propriedade" : ""}</small></div><strong className="property-ranking-xp">{item.xp} XP</strong></div>)}</div>
        </>}
      </section>

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="Como funciona o XP">
        <div className="legal-copy"><p>O XP entra apenas quando uma missão é concluída. As 50 missões somam {MAX_FARM_XP.toLocaleString("pt-BR")} XP no total.</p><p>São 5 principais, 15 médias e 30 difíceis. Cada nível usa blocos de {XP_PER_LEVEL} XP e o nível 10 libera o benefício VIP vitalício.</p><button className="primary-button full" onClick={() => setInfoOpen(false)}>Entendi</button></div>
      </Modal>
    </div>
  );
}
