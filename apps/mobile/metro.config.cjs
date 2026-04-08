/* global __dirname */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const webidlShimPath = path.resolve(projectRoot, "shims", "webidl-conversions", "index.js");

const config = getDefaultConfig(projectRoot);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.extraNodeModules = {
  "webidl-conversions": path.resolve(projectRoot, "shims/webidl-conversions"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "webidl-conversions" || moduleName.startsWith("webidl-conversions/")) {
    return {
      filePath: webidlShimPath,
      type: "sourceFile",
    };
  }

  if (typeof defaultResolveRequest === "function") {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: "./tailwind.config.cjs",
});
