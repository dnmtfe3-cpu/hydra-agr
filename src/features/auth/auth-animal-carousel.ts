export {};

const AUTH_ANIMALS = [
  { kind: "bovino", label: "Bovinos", image: "https://images.unsplash.com/photo-1723044492961-0913923479b5?auto=format&fit=crop&w=1100&q=82" },
  { kind: "caprino", label: "Caprinos", image: "https://images.unsplash.com/photo-1737121462781-c3732d00bd2e?auto=format&fit=crop&w=1100&q=82" },
  { kind: "ovino", label: "Ovinos", image: "https://images.unsplash.com/photo-1763902200205-bbcf21b46b1b?auto=format&fit=crop&w=1100&q=82" },
  { kind: "equino", label: "Equinos", image: "https://images.unsplash.com/photo-1749181165661-502af04d5cab?auto=format&fit=crop&w=1100&q=82" },
  { kind: "suino", label: "Suínos", image: "https://images.unsplash.com/photo-1728303945545-d6ab21432ea9?auto=format&fit=crop&w=1100&q=82" },
  { kind: "ave", label: "Aves", image: "https://images.unsplash.com/photo-1773137634962-53b125523e95?auto=format&fit=crop&w=1100&q=82" },
] as const;

const mountedShells = new WeakSet<HTMLElement>();

function buildCarousel(shell: HTMLElement) {
  if (mountedShells.has(shell) || shell.querySelector(".auth-animal-carousel")) return;
  mountedShells.add(shell);

  const hero = document.createElement("div");
  hero.className = "auth-animal-carousel";
  hero.setAttribute("aria-label", "Animais gerenciados pelo Hydra Agro");
  hero.innerHTML = `
    <div class="auth-animal-track">
      ${AUTH_ANIMALS.map((animal, index) => `
        <figure class="auth-animal-card animal-${animal.kind}" data-animal-index="${index}">
          <img src="${animal.image}" alt="${animal.label}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
          <span class="auth-animal-shade" aria-hidden="true"></span>
          <figcaption>${animal.label}</figcaption>
        </figure>`).join("")}
    </div>
    <div class="auth-animal-dots" aria-hidden="true">${AUTH_ANIMALS.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("")}</div>`;

  shell.prepend(hero);

  const cards = Array.from(hero.querySelectorAll<HTMLElement>(".auth-animal-card"));
  const dots = Array.from(hero.querySelectorAll<HTMLElement>(".auth-animal-dots span"));
  let active = 0;
  let timer = 0;

  const paint = () => {
    cards.forEach((card, index) => {
      const delta = (index - active + cards.length) % cards.length;
      card.dataset.position = delta === 0 ? "active" : delta === 1 ? "next" : delta === cards.length - 1 ? "prev" : "far";
    });
    dots.forEach((dot, index) => dot.classList.toggle("active", index === active));
  };

  const start = () => {
    window.clearInterval(timer);
    timer = window.setInterval(() => {
      if (!document.documentElement.contains(hero)) {
        window.clearInterval(timer);
        return;
      }
      active = (active + 1) % cards.length;
      paint();
    }, 2850);
  };

  hero.addEventListener("pointerenter", () => window.clearInterval(timer));
  hero.addEventListener("pointerleave", start);
  paint();
  start();
}

function mount() {
  document.querySelectorAll<HTMLElement>(".auth-reference-shell:not(.auth-code-shell)").forEach(buildCarousel);
}

let scheduled = false;
const scheduleMount = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    mount();
  });
};

const authCarouselObserver = new MutationObserver(scheduleMount);
authCarouselObserver.observe(document.documentElement, { childList: true, subtree: true });
mount();
