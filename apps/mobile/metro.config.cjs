const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const webidlShimPath = path.resolve(projectRoot, "shims", "webidl-conversions", "index.js");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.resolver.disableHierarchicalLookup = true;

config.watchFolders = [
  path.resolve(monorepoRoot, "packages"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(projectRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  react: path.resolve(monorepoRoot, "node_modules/react"),
  "react-dom": path.resolve(monorepoRoot, "node_modules/react-dom"),
  "react-native": path.resolve(monorepoRoot, "node_modules/react-native"),
  scheduler: path.resolve(monorepoRoot, "node_modules/scheduler"),
  "webidl-conversions": path.resolve(projectRoot, "shims/webidl-conversions"),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "webidl-conversions") {
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

