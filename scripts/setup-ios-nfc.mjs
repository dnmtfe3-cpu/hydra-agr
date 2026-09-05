import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const iosDir = resolve(root, "ios");
const infoPlistPath = resolve(iosDir, "App", "App", "Info.plist");
const entitlementsPath = resolve(iosDir, "App", "App", "App.entitlements");
const projectPath = resolve(iosDir, "App", "App.xcodeproj", "project.pbxproj");
const iosPackagePath = resolve(root, "node_modules", "@capacitor", "ios", "package.json");
const launchStoryboardPath = resolve(iosDir, "App", "App", "Base.lproj", "LaunchScreen.storyboard");
const appId = "br.com.hydraagro.app";

function run(command, args) { const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false }); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status ?? 1); }
function ensureIosPackage() { if (!existsSync(iosPackagePath)) run("npm", ["install", "--no-save", "--package-lock=false", "@capacitor/ios@8.5.0"]); }
function configureInfoPlist() { let content = readFileSync(infoPlistPath, "utf8"); const block = "\t<key>NFCReaderUsageDescription</key>\n\t<string>O Hydra Agro usa NFC para ler e gravar identificações eletrônicas dos animais.</string>"; if (content.includes("<key>NFCReaderUsageDescription</key>")) content = content.replace(/\s*<key>NFCReaderUsageDescription<\/key>\s*<string>[\s\S]*?<\/string>/, `\n${block}`); else content = content.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${block}\n</dict>\n</plist>\n`); writeFileSync(infoPlistPath, content); }
function configureEntitlements() { const block = "\t<key>com.apple.developer.nfc.readersession.formats</key>\n\t<array>\n\t\t<string>NDEF</string>\n\t\t<string>TAG</string>\n\t</array>"; let content = existsSync(entitlementsPath) ? readFileSync(entitlementsPath,"utf8") : '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n</dict>\n</plist>\n'; if (content.includes("com.apple.developer.nfc.readersession.formats")) content=content.replace(/\s*<key>com\.apple\.developer\.nfc\.readersession\.formats<\/key>\s*<array>[\s\S]*?<\/array>/,`\n${block}`); else content=content.replace(/\n<\/dict>\s*<\/plist>\s*$/,`\n${block}\n</dict>\n</plist>\n`); writeFileSync(entitlementsPath,content); }
function configureProjectEntitlements() { const lines=readFileSync(projectPath,"utf8").split("\n"); for(let i=0;i<lines.length;i++){if(!lines[i].includes("PRODUCT_BUNDLE_IDENTIFIER")||!lines[i].includes(appId))continue;let s=i;while(s>=0&&!lines[s].includes("buildSettings = {"))s--;if(s<0)continue;if(!lines.slice(s,i).some(x=>x.includes("CODE_SIGN_ENTITLEMENTS"))){const ind=lines[i].match(/^\s*/)?.[0]??"\t\t\t\t";lines.splice(i,0,`${ind}CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`);i++;}} writeFileSync(projectPath,lines.join("\n")); }
function configureMinimalLaunchScreen() {
  // iOS requires a launch screen. Keep it visually neutral and instant-looking:
  // no Hydra logo, no Capacitor artwork, just a plain system background until React renders.
  writeFileSync(launchStoryboardPath, `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" targetRuntime="iOS.CocoaTouch" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES">
<device id="retina6_12" orientation="portrait" appearance="light"/>
<scenes><scene sceneID="launch"><objects><viewController id="launch-vc" sceneMemberID="viewController"><view key="view" contentMode="scaleToFill" id="launch-view"><rect key="frame" x="0" y="0" width="393" height="852"/><viewLayoutGuide key="safeArea" id="safe"/><color key="backgroundColor" systemColor="systemBackgroundColor"/></view></viewController><placeholder placeholderIdentifier="IBFirstResponder" id="first" sceneMemberID="firstResponder"/></objects></scene></scenes>
<resources><systemColor name="systemBackgroundColor"><color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/></systemColor></resources>
</document>\n`);
  console.log("iOS launch screen neutralizada: sem splash/logo; reload web permanece inalterado.");
}
function configureNativeIos(){configureInfoPlist();configureEntitlements();configureProjectEntitlements();configureMinimalLaunchScreen();}
if(process.platform!=="darwin"){console.error("A preparação do app iOS precisa ser executada em um Mac com Xcode instalado.");process.exit(1);} ensureIosPackage(); if(!existsSync(iosDir))run("npx",["cap","add","ios","--packagemanager","SPM"]); run("npm",["run","build"]); run("npx",["cap","sync","ios"]); configureNativeIos(); console.log("iOS configurado sem splash personalizada + Core NFC.");