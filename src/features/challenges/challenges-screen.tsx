"use client";

import "./challenge-xp.css";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Crown, Gift, Info, LoaderCircle, RefreshCw, Target } from "lucide-react";
import { Modal, ScreenHeader } from "../../components/ui";
import type { HydraAccount } from "../../lib/hydra-types";
import { MAX_FARM_LEVEL, MAX_FARM_XP, XP_PER_LEVEL } from "../../lib/farm-xp";
import { syncMissionProgress, type MissionProgress } from "../../services/mission-progress";

type Props = { account: HydraAccount; onBack: () => void };

const tierLabel = {
  main: "Principal",
  medium: "Média",
  hard: "Difícil",
  complete: "Concluída",
} as const;

export function ChallengesScreen({ account, onBack }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [progress, setProgress] = useState<MissionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setProgress(await syncMissionProgress()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar a missão atual."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh, account.id]);

  const percent = progress && progress.target > 0 ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : progress?.complete ? 100 : 0;
  const xpToNext = progress ? progress.level >= MAX_FARM_LEVEL ? 0 : progress.level === 9 ? Math.max(0, MAX_FARM_XP - progress.xp) : Math.max(0, progress.level * XP_PER_LEVEL - progress.xp) : 0;

  return (
    <div className="screen page-enter extra-screen challenges-screen sequential-missions-screen">
      <ScreenHeader
        title="Missão atual"
        subtitle="Uma missão por vez. A próxima libera sozinha quando você concluir esta."
        onBack={onBack}
        action={<button className="icon-button bare" onClick={() => setInfoOpen(true)} aria-label="Como funcionam as missões"><Info size={21} /></button>}
      />

      {loading ? <div className="mission-sequence-loading"><LoaderCircle className="spin" size={28} /><span>Atualizando seu progresso…</span></div> : error ? <div className="mission-sequence-error"><strong>Não foi possível atualizar</strong><p>{error}</p><button onClick={() => void refresh()}><RefreshCw size={17} /> Tentar novamente</button></div> : progress && <>
        <section className={`xp-level-hero ${progress.level === MAX_FARM_LEVEL ? "max-level" : ""}`}>
          <div><span>SEU PROGRESSO</span><strong>{progress.xp.toLocaleString("pt-BR")} XP</strong><small>{progress.level >= MAX_FARM_LEVEL ? "Nível máximo" : `${xpToNext.toLocaleString("pt-BR")} XP para o próximo nível`}</small></div>
          <span className="xp-level-badge">{progress.level}</span>
          <div className="challenge-progress"><i style={{ width: `${progress.levelProgress}%` }} /></div>
          <p>{progress.complete ? <><Crown size={17} /> Trilha concluída · nível 10 liberado</> : <><Gift size={17} /> {progress.completedCount}/50 missões concluídas</>}</p>
        </section>

        {progress.complete ? (
          <section className="mission-finished-card"><span><Crown size={27} /></span><div><small>TRILHA COMPLETA</small><h2>Nível 10 alcançado</h2><p>Você concluiu todas as 50 missões da fazenda.</p></div><CheckCircle2 size={24} /></section>
        ) : (
          <section className={`active-mission-card tier-${progress.tier}`}>
            <header><span className="active-mission-icon"><Target size={23} /></span><div><small>{tierLabel[progress.tier]} · missão {progress.ordinal} de 50</small><h2>{progress.title}</h2></div><b>+{progress.reward} XP</b></header>
            <p>{progress.description}</p>
            <div className="active-mission-progress"><i style={{ width: `${percent}%` }} /></div>
            <footer><strong>{Math.min(progress.current, progress.target)} / {progress.target}</strong><span>{percent}%</span></footer>
            <div className="mission-auto-note"><CheckCircle2 size={16} /><span>Quando chegar a 100%, o XP entra e a próxima missão é liberada automaticamente.</span></div>
          </section>
        )}

        {!progress.complete && <section className="mission-sequence-map">
          <div className={progress.ordinal <= 5 ? "active" : "done"}><strong>5</strong><span>Principais</span></div>
          <i />
          <div className={progress.ordinal > 5 && progress.ordinal <= 20 ? "active" : progress.ordinal > 20 ? "done" : "locked"}><strong>15</strong><span>Médias</span></div>
          <i />
          <div className={progress.ordinal > 20 ? "active" : "locked"}><strong>30</strong><span>Difíceis</span></div>
        </section>}
      </>}

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="Como funcionam as missões">
        <div className="legal-copy"><p>As missões seguem uma ordem fixa. Você não escolhe nem pula desafios.</p><p>Ao liberar uma missão, o aplicativo salva o ponto de início dela. Ações feitas antes dessa liberação não contam para o novo desafio.</p><p>São 5 principais, 15 médias e 30 difíceis. O XP é registrado ao concluir cada missão e a próxima aparece automaticamente.</p><button className="primary-button full" onClick={() => setInfoOpen(false)}>Entendi</button></div>
      </Modal>
    </div>
  );
}
