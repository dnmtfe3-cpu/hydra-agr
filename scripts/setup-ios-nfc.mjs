import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const iosDir = resolve(root, "ios");
const infoPlistPath = resolve(iosDir, "App", "App", "Info.plist");
const entitlementsPath = resolve(iosDir, "App", "App", "App.entitlements");
const projectPath = resolve(iosDir, "App", "App.xcodeproj", "project.pbxproj");
const iosPackagePath = resolve(root, "node_modules", "@capacitor", "ios", "package.json");
const launchStoryboardPath = resolve(iosDir, "App", "App", "Base.lproj", "LaunchScreen.storyboard");
const launchImageSetPath = resolve(iosDir, "App", "App", "Assets.xcassets", "LaunchLogo.imageset");
const hydraIconPath = resolve(root, "public", "icon-512.png");
const appId = "br.com.hydraagro.app";

function run(command, args) { const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false }); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status ?? 1); }
function ensureIosPackage() { if (!existsSync(iosPackagePath)) run("npm", ["install", "--no-save", "--package-lock=false", "@capacitor/ios@8.5.0"]); }
function configureInfoPlist() { let content = readFileSync(infoPlistPath, "utf8"); const block = "\t<key>NFCReaderUsageDescription</key>\n\t<string>O Hydra Agro usa NFC para ler e gravar identificações eletrônicas dos animais.</string>"; if (content.includes("<key>NFCReaderUsageDescription</key>")) content = content.replace(/\s*<key>NFCReaderUsageDescription<\/key>\s*<string>[\s\S]*?<\/string>/, `\n${block}`); else content = content.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${block}\n</dict>\n</plist>\n`); writeFileSync(infoPlistPath, content); }
function configureEntitlements() { const block = "\t<key>com.apple.developer.nfc.readersession.formats</key>\n\t<array>\n\t\t<string>NDEF</string>\n\t\t<string>TAG</string>\n\t</array>"; let content = existsSync(entitlementsPath) ? readFileSync(entitlementsPath,"utf8") : '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n</dict>\n</plist>\n'; if (content.includes("com.apple.developer.nfc.readersession.formats")) content=content.replace(/\s*<key>com\.apple\.developer\.nfc\.readersession\.formats<\/key>\s*<array>[\s\S]*?<\/array>/,`\n${block}`); else content=content.replace(/\n<\/dict>\s*<\/plist>\s*$/,`\n${block}\n</dict>\n</plist>\n`); writeFileSync(entitlementsPath,content); }
function configureProjectEntitlements() { const lines=readFileSync(projectPath,"utf8").split("\n"); for(let i=0;i<lines.length;i++){if(!lines[i].includes("PRODUCT_BUNDLE_IDENTIFIER")||!lines[i].includes(appId))continue;let s=i;while(s>=0&&!lines[s].includes("buildSettings = {"))s--;if(s<0)continue;if(!lines.slice(s,i).some(x=>x.includes("CODE_SIGN_ENTITLEMENTS"))){const ind=lines[i].match(/^\s*/)?.[0]??"\t\t\t\t";lines.splice(i,0,`${ind}CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`);i++;}} writeFileSync(projectPath,lines.join("\n")); }
function configureCompactLaunchLogo() {
  if (!existsSync(hydraIconPath)) throw new Error(`Ícone Hydra Agro não encontrado em ${hydraIconPath}`);
  mkdirSync(launchImageSetPath, { recursive: true });
  const oneX = resolve(launchImageSetPath, "launch-logo-96.png");
  const twoX = resolve(launchImageSetPath, "launch-logo-192.png");
  const threeX = resolve(launchImageSetPath, "launch-logo-288.png");
  run("sips", ["-z", "96", "96", hydraIconPath, "--out", oneX]);
  run("sips", ["-z", "192", "192", hydraIconPath, "--out", twoX]);
  run("sips", ["-z", "288", "288", hydraIconPath, "--out", threeX]);
  writeFileSync(resolve(launchImageSetPath, "Contents.json"), JSON.stringify({
    images: [
      { idiom: "universal", filename: "launch-logo-96.png", scale: "1x" },
      { idiom: "universal", filename: "launch-logo-192.png", scale: "2x" },
      { idiom: "universal", filename: "launch-logo-288.png", scale: "3x" }
    ],
    info: { author: "xcode", version: 1 }
  }, null, 2));

  writeFileSync(launchStoryboardPath, `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" targetRuntime="iOS.CocoaTouch" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES">
<device id="retina6_12" orientation="portrait" appearance="light"/>
<scenes><scene sceneID="launch"><objects><viewController id="launch-vc" sceneMemberID="viewController"><view key="view" contentMode="scaleToFill" id="launch-view"><rect key="frame" x="0" y="0" width="393" height="852"/><subviews><imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="LaunchLogo" translatesAutoresizingMaskIntoConstraints="NO" id="launch-logo"><rect key="frame" x="148.5" y="378" width="96" height="96"/></imageView></subviews><viewLayoutGuide key="safeArea" id="safe"/><color key="backgroundColor" red="0.0353" green="0.1529" blue="0.1059" alpha="1" colorSpace="custom" customColorSpace="sRGB"/><constraints><constraint firstItem="launch-logo" firstAttribute="centerX" secondItem="launch-view" secondAttribute="centerX"/><constraint firstItem="launch-logo" firstAttribute="centerY" secondItem="launch-view" secondAttribute="centerY"/><constraint firstItem="launch-logo" firstAttribute="width" constant="96"/><constraint firstItem="launch-logo" firstAttribute="height" constant="96"/></constraints></view></viewController><placeholder placeholderIdentifier="IBFirstResponder" id="first" sceneMemberID="firstResponder"/></objects></scene></scenes><resources><image name="LaunchLogo" width="96" height="96"/></resources>
</document>\n`);
  console.log("Logo anterior à splash ajustada para 96pt e aspect-fit. Splash web do Hydra não foi alterada.");
}
function configureNativeIos(){configureInfoPlist();configureEntitlements();configureProjectEntitlements();configureCompactLaunchLogo();}
if(process.platform!=="darwin"){console.error("A preparação do app iOS precisa ser executada em um Mac com Xcode instalado.");process.exit(1);} ensureIosPackage(); if(!existsSync(iosDir))run("npx",["cap","add","ios","--packagemanager","SPM"]); run("npm",["run","build"]); run("npx",["cap","sync","ios"]); configureNativeIos(); console.log("iOS configurado com logo inicial compacta + splash Hydra intacta + Core NFC.");