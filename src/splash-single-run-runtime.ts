import { Capacitor } from "@capacitor/core";

const html = document.documentElement;
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

function keepSplashGreen() {
  if (themeMeta && themeMeta.content.toLowerCase() !== "#174c36") themeMeta.content = "#174c36";
}

if (Capacitor.isNativePlatform()) {
  // Android/iOS já possuem splash nativa. A splash React não deve tocar por cima dela.
  html.classList.add("hydra-native-platform");
  keepSplashGreen();
} else {
  let splashSeen = false;
  let splashFinished = false;

  const sync = () => {
    const hasSplash = Boolean(document.querySelector(".splash-screen"));
    if (hasSplash && !splashFinished) {
      splashSeen = true;
      keepSplashGreen();
    }
    if (splashSeen && !hasSplash && !splashFinished) {
      splashFinished = true;
      html.classList.add("hydra-web-splash-finished");
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (themeMeta) observer.observe(themeMeta, { attributes: true, attributeFilter: ["content"] });
  sync();
}
