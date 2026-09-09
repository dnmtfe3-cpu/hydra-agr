(() => {
  const artwork = "/hydra-splash-logo.png?v=web-splash-3";
  const html = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let playing = false;

  function hasDirectLaunch() {
    return Boolean(document.body && Array.from(document.body.children).some((node) => node.classList?.contains("hydra-launch")));
  }

  function clearLegacySplashLock() {
    if (!hasDirectLaunch()) html.classList.remove("hydra-splash-active");
  }

  const legacyGuard = new MutationObserver(clearLegacySplashLock);
  legacyGuard.observe(html, { attributes: true, attributeFilter: ["class"] });

  async function preloadArtwork() {
    const image = new Image();
    image.src = artwork;

    if (typeof image.decode === "function") {
      try {
        await image.decode();
        return;
      } catch {
        // Fallback abaixo para navegadores/WebViews que recusam decode().
      }
    }

    if (image.complete) return;
    await new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  }

  async function play() {
    if (playing || !document.body) return;
    playing = true;

    await preloadArtwork();

    html.classList.add("hydra-launch-active");

    const layer = document.createElement("div");
    layer.className = "hydra-launch";
    layer.dataset.phase = "loading";
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-label", "Abrindo Hydra Agro");

    const center = document.createElement("div");
    center.className = "hydra-launch__center";

    // Usa a arte como background em vez de <img>. Assim nenhum CSS global de img
    // consegue zerar, redimensionar ou mascarar a logo da splash no site.
    const mark = document.createElement("div");
    mark.className = "hydra-launch__mark";
    mark.setAttribute("aria-hidden", "true");
    mark.style.backgroundImage = `url("${artwork}")`;
    mark.style.backgroundRepeat = "no-repeat";
    mark.style.backgroundPosition = "center";
    mark.style.backgroundSize = "contain";
    mark.style.webkitMaskImage = "none";
    mark.style.maskImage = "none";

    center.append(mark);
    layer.append(center);
    document.body.append(layer);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      layer.dataset.phase = "entering";

      window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        layer.dataset.phase = "exiting";
        window.setTimeout(() => {
          layer.remove();
          html.classList.remove("hydra-launch-active", "hydra-splash-active");
          playing = false;
          clearLegacySplashLock();
        }, reduced ? 180 : 720);
      })), reduced ? 150 : 1250);
    }));
  }

  if (document.body) void play();
  else document.addEventListener("DOMContentLoaded", () => { void play(); }, { once: true });
})();
