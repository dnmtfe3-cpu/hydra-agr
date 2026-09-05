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

function run(command, args) { const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false }); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status ?? 1); }
function ensureIosPackage() { if (!existsSync(iosPackagePath)) run("npm", ["install", "--no-save", "--package-lock=false", "@capacitor/ios@8.5.0"]); }
function configureInfoPlist() { let content = readFileSync(infoPlistPath, "utf8"); const block = "\t<key>NFCReaderUsageDescription</key>\n\t<string>O Hydra Agro usa NFC para ler e gravar identificações eletrônicas dos animais.</string>"; if (content.includes("<key>NFCReaderUsageDescription</key>")) content = content.replace(/\s*<key>NFCReaderUsageDescription<\/key>\s*<string>[\s\S]*?<\/string>/, `\n${block}`); else content = content.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${block}\n</dict>\n</plist>\n`); writeFileSync(infoPlistPath, content); }
function configureEntitlements() { const block = "\t<key>com.apple.developer.nfc.readersession.formats</key>\n\t<array>\n\t\t<string>NDEF</string>\n\t\t<string>TAG</string>\n\t</array>"; let content = existsSync(entitlementsPath) ? readFileSync(entitlementsPath,"utf8") : '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n</dict>\n</plist>\n'; if (content.includes("com.apple.developer.nfc.readersession.formats")) content=content.replace(/\s*<key>com\.apple\.developer\.nfc\.readersession\.formats<\/key>\s*<array>[\s\S]*?<\/array>/,`\n${block}`); else content=content.replace(/\n<\/dict>\s*<\/plist>\s*$/,`\n${block}\n</dict>\n</plist>\n`); writeFileSync(entitlementsPath,content); }
function configureProjectEntitlements() { const lines=readFileSync(projectPath,"utf8").split("\n"); for(let i=0;i<lines.length;i++){if(!lines[i].includes("PRODUCT_BUNDLE_IDENTIFIER")||!lines[i].includes(appId))continue;let s=i;while(s>=0&&!lines[s].includes("buildSettings = {"))s--;if(s<0)continue;if(!lines.slice(s,i).some(x=>x.includes("CODE_SIGN_ENTITLEMENTS"))){const ind=lines[i].match(/^\s*/)?.[0]??"\t\t\t\t";lines.splice(i,0,`${ind}CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`);i++;}} writeFileSync(projectPath,lines.join("\n")); }
function configureHydraLaunchScreen(){
 if(!existsSync(hydraIconPath)) throw new Error(`Ícone Hydra Agro não encontrado em ${hydraIconPath}`);
 mkdirSync(splashImageSetPath,{recursive:true});
 const s1=resolve(splashImageSetPath,"splash-512.png"),s2=resolve(splashImageSetPath,"splash-1024.png"),s3=resolve(splashImageSetPath,"splash-1536.png");
 copyFileSync(hydraIconPath,s1); run("sips",["-z","1024","1024",hydraIconPath,"--out",s2]); run("sips",["-z","1536","1536",hydraIconPath,"--out",s3]);
 writeFileSync(resolve(splashImageSetPath,"Contents.json"),JSON.stringify({images:[{idiom:"universal",filename:"splash-512.png",scale:"1x"},{idiom:"universal",filename:"splash-1024.png",scale:"2x"},{idiom:"universal",filename:"splash-1536.png",scale:"3x"}],info:{author:"xcode",version:1}},null,2));
 mkdirSync(dirname(launchStoryboardPath),{recursive:true});
 writeFileSync(launchStoryboardPath,`<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" targetRuntime="iOS.CocoaTouch" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES">
<device id="retina6_12" orientation="portrait" appearance="light"/>
<scenes><scene sceneID="hydra-scene"><objects><viewController id="hydra-vc" sceneMemberID="viewController"><view key="view" contentMode="scaleToFill" id="hydra-view"><rect key="frame" x="0" y="0" width="393" height="852"/><subviews><imageView clipsSubviews="NO" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="Splash" translatesAutoresizingMaskIntoConstraints="NO" id="hydra-logo"><rect key="frame" x="136.5" y="371.5" width="120" height="120"/></imageView></subviews><viewLayoutGuide key="safeArea" id="hydra-safe"/><color key="backgroundColor" red="${hydraGreen.red}" green="${hydraGreen.green}" blue="${hydraGreen.blue}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/><constraints><constraint firstItem="hydra-logo" firstAttribute="centerX" secondItem="hydra-view" secondAttribute="centerX"/><constraint firstItem="hydra-logo" firstAttribute="centerY" secondItem="hydra-view" secondAttribute="centerY"/><constraint firstItem="hydra-logo" firstAttribute="width" constant="120"/><constraint firstItem="hydra-logo" firstAttribute="height" constant="120"/></constraints></view></viewController><placeholder placeholderIdentifier="IBFirstResponder" id="first" sceneMemberID="firstResponder"/></objects></scene></scenes><resources><image name="Splash" width="512" height="512"/></resources></document>\n`);
 console.log("Splash Hydra Agro: logo 120pt, aspect-fit, centralizada e sem corte.");
}
function configureNativeIos(){configureInfoPlist();configureEntitlements();configureProjectEntitlements();configureHydraLaunchScreen();}
if(process.platform!=="darwin"){console.error("A preparação do app iOS precisa ser executada em um Mac com Xcode instalado.");process.exit(1);} ensureIosPackage(); if(!existsSync(iosDir))run("npx",["cap","add","ios","--packagemanager","SPM"]); run("npm",["run","build"]); run("npx",["cap","sync","ios"]); configureNativeIos(); console.log("iOS configurado com splash Hydra Agro + Core NFC.");