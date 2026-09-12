import { useEffect } from "react";
import { ArrowLeft, Home, MapPinOff, Sprout } from "lucide-react";
import "./not-found-screen.css";

export function NotFoundScreen() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Página não encontrada | Hydra Agro";

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const hadRobots = Boolean(robots);
    const previousRobots = robots?.content ?? "";

    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";

    return () => {
      document.title = previousTitle;
      if (!robots) return;
      if (hadRobots) robots.content = previousRobots;
      else robots.remove();
    };
  }, []);

  function goHome() {
    window.location.assign("/");
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else goHome();
  }

  return (
    <main className="hydra-not-found">
      <div className="hydra-not-found-glow hydra-not-found-glow-one" aria-hidden="true" />
      <div className="hydra-not-found-glow hydra-not-found-glow-two" aria-hidden="true" />

      <section className="hydra-not-found-card" aria-labelledby="hydra-404-title">
        <div className="hydra-not-found-brand" aria-label="Hydra Agro">
          <span><Sprout size={21} /></span>
          <strong>HYDRA AGRO</strong>
        </div>

        <div className="hydra-not-found-visual" aria-hidden="true">
          <span className="hydra-not-found-code">404</span>
          <span className="hydra-not-found-pin"><MapPinOff size={30} /></span>
          <i className="hydra-not-found-route hydra-not-found-route-one" />
          <i className="hydra-not-found-route hydra-not-found-route-two" />
        </div>

        <div className="hydra-not-found-copy">
          <span className="hydra-not-found-kicker">PÁGINA NÃO ENCONTRADA</span>
          <h1 id="hydra-404-title">Essa área não existe por aqui.</h1>
          <p>O endereço pode estar incorreto, ter sido alterado ou a página pode não estar mais disponível.</p>
        </div>

        <div className="hydra-not-found-actions">
          <button className="hydra-not-found-primary" onClick={goHome}>
            <Home size={18} />
            Ir para o início
          </button>
          <button className="hydra-not-found-secondary" onClick={goBack}>
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>

        <small className="hydra-not-found-footnote">Se você chegou aqui por um link do Hydra Agro, tente abrir novamente pelo aplicativo.</small>
      </section>
    </main>
  );
}
