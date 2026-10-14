const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
// Install the pinned builder in a separate tooling directory, not the web runtime.
const toolingRoot = process.env.MOMENTUM_ANDROID_TOOLS || path.join(__dirname, ".tooling");
const requireTool = createRequire(path.join(toolingRoot, "package.json"));
const { TwaGenerator, TwaManifest, ConsoleLog } = requireTool("@bubblewrap/core");

(async () => {
  const manifest = new TwaManifest(JSON.parse(fs.readFileSync(path.join(__dirname, "twa-manifest.json"), "utf8")));
  const error = manifest.validate();
  if (error) throw new Error(error);
  const generator = new TwaGenerator();
  // Generate icons from the reviewed local source; no live-site dependency at build time.
  generator.imageHelper.fetchIcon = async url => {
    if (url !== "https://momentumvelo.app/icons/icon-512.png") throw new Error("Unexpected icon URL");
    return { url, data: fs.readFileSync(path.join(__dirname, "../icons/icon-512.png")) };
  };
  await generator.createTwaProject(__dirname, manifest, new ConsoleLog("MomentumVelo"));
  const buildFile = path.join(__dirname, "build.gradle");
  fs.writeFileSync(buildFile, fs.readFileSync(buildFile, "utf8").replaceAll("jcenter()", "mavenCentral()"));
  const appBuild = path.join(__dirname, "app/build.gradle");
  fs.writeFileSync(appBuild, fs.readFileSync(appBuild, "utf8")
    .replace("com.google.androidbrowserhelper:androidbrowserhelper:2.+", "com.google.androidbrowserhelper:androidbrowserhelper:2.7.4"));
  const androidManifest = path.join(__dirname, "app/src/main/AndroidManifest.xml");
  fs.writeFileSync(androidManifest, fs.readFileSync(androidManifest, "utf8").replace('package="app.momentumvelo"', ""));
  console.log("Proyecto Android generado para momentumvelo.app.");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
