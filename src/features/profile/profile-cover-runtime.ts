const HERO_SELECTOR = ".profile-screen .profile-hero";

function lockCover(hero: HTMLElement) {
  const inlineImage = hero.style.backgroundImage;
  if (!inlineImage || inlineImage === "none") return;

  const currentPriority = hero.style.getPropertyPriority("background-image");
  if (currentPriority !== "important") {
    hero.style.setProperty("background-image", inlineImage, "important");
  }
  if (hero.style.getPropertyPriority("background-size") !== "important") {
    hero.style.setProperty("background-size", "cover", "important");
  }
  if (hero.style.getPropertyPriority("background-position") !== "important") {
    hero.style.setProperty("background-position", "center", "important");
  }
  if (hero.style.getPropertyPriority("background-repeat") !== "important") {
    hero.style.setProperty("background-repeat", "no-repeat", "important");
  }
}

function syncProfileCovers(root: ParentNode = document) {
  if (root instanceof HTMLElement && root.matches(HERO_SELECTOR)) lockCover(root);
  root.querySelectorAll<HTMLElement>(HERO_SELECTOR).forEach(lockCover);
}

function startProfileCoverGuard() {
  syncProfileCovers();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLElement && mutation.target.matches(HERO_SELECTOR)) {
        lockCover(mutation.target);
        continue;
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) syncProfileCovers(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
}

if (typeof document !== "undefined") {
  if (document.body) startProfileCoverGuard();
  else window.addEventListener("DOMContentLoaded", startProfileCoverGuard, { once: true });
}
