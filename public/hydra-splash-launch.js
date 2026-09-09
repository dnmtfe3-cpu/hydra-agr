(() => {
  const artwork = "/hydra-splash-logo.png";
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

  function play() {
    if (playing || !document.body) return;
    playing = true;
    html.classList.add("hydra-launch-active");

    const layer = document.createElement("div");
    layer.className = "hydra-launch";
    layer.dataset.phase = "loading";
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-label", "Abrindo Hydra Agro");

    const center = document.createElement("div");
    center.className = "hydra-launch__center";

    const image = new Image();
    image.className = "hydra-launch__mark";
    image.alt = "";
    image.width = 1254;
    image.height = 1254;
    image.draggable = false;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      layer.dataset.phase = "entering";

      window.setTimeout(() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        layer.dataset.phase = "exiting";
        window.setTimeout(() => {
          layer.remove();
          html.classList.remove("hydra-launch-active", "hydra-splash-active");
          playing = false;
          clearLegacySplashLock();
        }, reduced ? 180 : 720);
      })), reduced ? 150 : 1250);
    };

    image.onload = start;
    image.onerror = start;
    center.append(image);
    layer.append(center);
    document.body.append(layer);
    image.src = artwork;
    if (image.complete) start();
  }

  if (document.body) play();
  else document.addEventListener("DOMContentLoaded", play, { once: true });
})();
