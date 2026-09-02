const AUTH_ANIMALS = [
  { kind: "bovino", label: "Bovinos", emoji: "🐄" },
  { kind: "caprino", label: "Caprinos", emoji: "🐐" },
  { kind: "ovino", label: "Ovinos", emoji: "🐑" },
  { kind: "equino", label: "Equinos", emoji: "🐎" },
  { kind: "suino", label: "Suínos", emoji: "🐖" },
  { kind: "ave", label: "Aves", emoji: "🐓" },
];

function buildCarousel(shell: HTMLElement) {
  if (shell.querySelector(".auth-animal-carousel")) return;
  const hero = document.createElement("div");
  hero.className = "auth-animal-carousel";
  hero.setAttribute("aria-label", "Animais gerenciados pelo Hydra Agro");
  hero.innerHTML = `<div class="auth-animal-track">${AUTH_ANIMALS.map((animal, index) => `<figure class="auth-animal-card animal-${animal.kind}" data-animal-index="${index}"><div class="auth-animal-scene"><span class="auth-animal-emoji" aria-hidden="true">${animal.emoji}</span><span class="auth-animal-ground"></span></div><figcaption>${animal.label}</figcaption></figure>`).join("")}</div><div class="auth-animal-dots">${AUTH_ANIMALS.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("")}</div>`;
  shell.prepend(hero);

  const cards = Array.from(hero.querySelectorAll<HTMLElement>(".auth-animal-card"));
  const dots = Array.from(hero.querySelectorAll<HTMLElement>(".auth-animal-dots span"));
  let active = 0;
  const paint = () => {
    cards.forEach((card, index) => {
      const delta = (index - active + cards.length) % cards.length;
      card.dataset.position = delta === 0 ? "active" : delta === 1 ? "next" : delta === cards.length - 1 ? "prev" : "far";
    });
    dots.forEach((dot, index) => dot.classList.toggle("active", index === active));
  };
  paint();
  const timer = window.setInterval(() => { active = (active + 1) % cards.length; paint(); }, 3200);
  hero.dataset.timer = String(timer);
}

function mount() {
  const shells = Array.from(document.querySelectorAll<HTMLElement>(".auth-reference-shell:not(.auth-code-shell)"));
  shells.forEach(buildCarousel);
}

const observer = new MutationObserver(mount);
observer.observe(document.documentElement, { childList: true, subtree: true });
mount();
