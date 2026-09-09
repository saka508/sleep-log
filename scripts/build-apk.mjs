#!/usr/bin/env node
/**
 * Builds a sideloadable release APK.
 *
 *   pnpm apk
 *
 * The generated `android/` directory is gitignored, so this regenerates it when
 * it is missing and then runs Gradle. Requires a JDK 17+ and an Android SDK
 * (set ANDROID_HOME, or install to the default ~/Android/Sdk).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const androidDir = join(root, "android");
const sdkDir = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(homedir(), "Android", "Sdk");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    console.error(`\n✖ ${command} ${args.join(" ")} failed`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(sdkDir)) {
  console.error(`✖ Android SDK not found at ${sdkDir}`);
  console.error("  Install it, or point ANDROID_HOME at an existing SDK.");
  process.exit(1);
}

if (!existsSync(androidDir)) {
  console.log("→ android/ is missing, running expo prebuild");
  run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"]);
}

writeFileSync(join(androidDir, "local.properties"), `sdk.dir=${sdkDir}\n`);

console.log("→ gradle assembleRelease");
run("./gradlew", ["assembleRelease", "--no-daemon"], {
  cwd: androidDir,
  env: { ...process.env, ANDROID_HOME: sdkDir },
});

const built = join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(built)) {
  console.error(`✖ Expected APK at ${built}`);
  process.exit(1);
}

mkdirSync(join(root, "build"), { recursive: true });
const output = join(root, "build", "sleep-log.apk");
copyFileSync(built, output);
console.log(`\n✔ APK ready: ${output}`);
