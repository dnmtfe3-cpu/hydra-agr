import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const iosDir = resolve(root, "ios");
const infoPlistPath = resolve(iosDir, "App", "App", "Info.plist");
const entitlementsPath = resolve(iosDir, "App", "App", "App.entitlements");
const projectPath = resolve(iosDir, "App", "App.xcodeproj", "project.pbxproj");
const iosPackagePath = resolve(root, "node_modules", "@capacitor", "ios", "package.json");
const launchStoryboardPath = resolve(iosDir, "App", "App", "Base.lproj", "LaunchScreen.storyboard");
const splashImageSetPath = resolve(iosDir, "App", "App", "Assets.xcassets", "Splash.imageset");
const hydraIconPath = resolve(root, "public", "icon-512.png");
const appId = "br.com.hydraagro.app";
const hydraGreen = { red: "0.0588", green: "0.2157", blue: "0.1529" };

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function ensureIosPackage() {
  if (existsSync(iosPackagePath)) return;
  console.log("Preparando suporte nativo do iOS...");
  run("npm", ["install", "--no-save", "--package-lock=false", "@capacitor/ios@8.5.0"]);
}

function configureInfoPlist() {
  if (!existsSync(infoPlistPath)) throw new Error(`Info.plist não encontrado em ${infoPlistPath}`);

  let content = readFileSync(infoPlistPath, "utf8");
  const block = [
    "\t<key>NFCReaderUsageDescription</key>",
    "\t<string>O Hydra Agro usa NFC para ler e gravar identificações eletrônicas dos animais.</string>",
  ].join("\n");

  if (content.includes("<key>NFCReaderUsageDescription</key>")) {
    content = content.replace(
      /\s*<key>NFCReaderUsageDescription<\/key>\s*<string>[\s\S]*?<\/string>/,
      `\n${block}`,
    );
  } else {
    content = content.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${block}\n</dict>\n</plist>\n`);
  }

  writeFileSync(infoPlistPath, content);
}

function configureEntitlements() {
  const block = [
    "\t<key>com.apple.developer.nfc.readersession.formats</key>",
    "\t<array>",
    "\t\t<string>NDEF</string>",
    "\t\t<string>TAG</string>",
    "\t</array>",
  ].join("\n");

  let content = existsSync(entitlementsPath)
    ? readFileSync(entitlementsPath, "utf8")
    : [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        "<dict>",
        "</dict>",
        "</plist>",
        "",
      ].join("\n");

  if (content.includes("<key>com.apple.developer.nfc.readersession.formats</key>")) {
    content = content.replace(
      /\s*<key>com\.apple\.developer\.nfc\.readersession\.formats<\/key>\s*<array>[\s\S]*?<\/array>/,
      `\n${block}`,
    );
  } else {
    content = content.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${block}\n</dict>\n</plist>\n`);
  }

  writeFileSync(entitlementsPath, content);
}

function configureProjectEntitlements() {
  if (!existsSync(projectPath)) throw new Error(`Projeto Xcode não encontrado em ${projectPath}`);

  const lines = readFileSync(projectPath, "utf8").split("\n");
  let matchedConfigurations = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes("PRODUCT_BUNDLE_IDENTIFIER") || !line.includes(appId)) continue;

    matchedConfigurations += 1;
    let blockStart = index;
    while (blockStart >= 0 && !lines[blockStart].includes("buildSettings = {")) blockStart -= 1;
    if (blockStart < 0) continue;

    const hasEntitlements = lines
      .slice(blockStart, index)
      .some((item) => item.includes("CODE_SIGN_ENTITLEMENTS"));

    if (!hasEntitlements) {
      const indent = line.match(/^\s*/)?.[0] ?? "\t\t\t\t";
      lines.splice(index, 0, `${indent}CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`);
      index += 1;
    }
  }

  if (matchedConfigurations === 0) {
    throw new Error(`Não encontrei o target iOS com bundle id ${appId}.`);
  }

  writeFileSync(projectPath, lines.join("\n"));
}

function configureHydraLaunchScreen() {
  if (!existsSync(hydraIconPath)) throw new Error(`Ícone Hydra Agro não encontrado em ${hydraIconPath}`);

  mkdirSync(splashImageSetPath, { recursive: true });
  const splash1x = resolve(splashImageSetPath, "splash-512.png");
  const splash2x = resolve(splashImageSetPath, "splash-1024.png");
  const splash3x = resolve(splashImageSetPath, "splash-1536.png");

  copyFileSync(hydraIconPath, splash1x);
  run("sips", ["-z", "1024", "1024", hydraIconPath, "--out", splash2x]);
  run("sips", ["-z", "1536", "1536", hydraIconPath, "--out", splash3x]);

  writeFileSync(resolve(splashImageSetPath, "Contents.json"), JSON.stringify({
    images: [
      { idiom: "universal", filename: "splash-512.png", scale: "1x" },
      { idiom: "universal", filename: "splash-1024.png", scale: "2x" },
      { idiom: "universal", filename: "splash-1536.png", scale: "3x" },
    ],
    info: { author: "xcode", version: 1 },
  }, null, 2));

  if (!existsSync(launchStoryboardPath)) {
    mkdirSync(dirname(launchStoryboardPath), { recursive: true });
    writeFileSync(launchStoryboardPath, `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23094" targetRuntime="iOS.CocoaTouch" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies><plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23084"/><capability name="Safe area layout guides" minToolsVersion="9.0"/></dependencies>
    <scenes><scene sceneID="hydra-scene"><objects><viewController id="hydra-vc" sceneMemberID="viewController"><view key="view" contentMode="scaleToFill" id="hydra-view"><rect key="frame" x="0.0" y="0.0" width="393" height="852"/><subviews><imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="Splash" translatesAutoresizingMaskIntoConstraints="NO" id="hydra-logo"><rect key="frame" x="116.5" y="346" width="160" height="160"/></imageView></subviews><viewLayoutGuide key="safeArea" id="hydra-safe"/><color key="backgroundColor" red="${hydraGreen.red}" green="${hydraGreen.green}" blue="${hydraGreen.blue}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/><constraints><constraint firstItem="hydra-logo" firstAttribute="centerX" secondItem="hydra-view" secondAttribute="centerX" id="cx"/><constraint firstItem="hydra-logo" firstAttribute="centerY" secondItem="hydra-view" secondAttribute="centerY" id="cy"/><constraint firstItem="hydra-logo" firstAttribute="width" constant="160" id="w"/><constraint firstItem="hydra-logo" firstAttribute="height" constant="160" id="h"/></constraints></view></viewController><placeholder placeholderIdentifier="IBFirstResponder" id="first" userLabel="First Responder" sceneMemberID="firstResponder"/></objects></scene></scenes>
    <resources><image name="Splash" width="512" height="512"/></resources>
</document>\n`);
  } else {
    let storyboard = readFileSync(launchStoryboardPath, "utf8");
    storyboard = storyboard.replace(/image="[^\"]+"(?=\s+translatesAutoresizingMaskIntoConstraints)/g, 'image="Splash"');
    storyboard = storyboard.replace(/<color key="backgroundColor"[^>]*\/>/g, `<color key="backgroundColor" red="${hydraGreen.red}" green="${hydraGreen.green}" blue="${hydraGreen.blue}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`);
    storyboard = storyboard.replace(/<image name="[^\"]+"[^>]*\/>/g, '<image name="Splash" width="512" height="512"/>');
    writeFileSync(launchStoryboardPath, storyboard);
  }

  console.log("LaunchScreen iOS trocada para Hydra Agro; asset padrão do Capacitor removido.");
}

function configureNativeIos() {
  configureInfoPlist();
  configureEntitlements();
  configureProjectEntitlements();
  configureHydraLaunchScreen();
}

if (process.platform !== "darwin") {
  console.error("A preparação do app iOS precisa ser executada em um Mac com Xcode instalado.");
  process.exit(1);
}

ensureIosPackage();

if (!existsSync(iosDir)) {
  run("npx", ["cap", "add", "ios", "--packagemanager", "SPM"]);
}

run("npm", ["run", "build"]);
run("npx", ["cap", "sync", "ios"]);
configureNativeIos();

console.log("iOS configurado com splash Hydra Agro + Core NFC.");
console.log("Abra o projeto com: npm run ios:open");
