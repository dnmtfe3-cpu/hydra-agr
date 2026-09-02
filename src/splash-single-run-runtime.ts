import { Capacitor } from "@capacitor/core";

const html = document.documentElement;

if (Capacitor.isNativePlatform()) {
  // Android/iOS já possuem splash nativa. A splash React não deve tocar por cima dela.
  html.classList.add("hydra-native-platform");
} else {
  let splashSeen = false;
  let splashFinished = false;

  const sync = () => {
    const hasSplash = Boolean(document.querySelector(".splash-screen"));
    if (hasSplash && !splashFinished) splashSeen = true;
    if (splashSeen && !hasSplash && !splashFinished) {
      splashFinished = true;
      html.classList.add("hydra-web-splash-finished");
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sync();
}
