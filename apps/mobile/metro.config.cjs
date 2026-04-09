/* global __dirname */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const appNodeModules = path.resolve(projectRoot, "node_modules");
const workspaceNodeModules = path.resolve(projectRoot, "..", "..", "node_modules");
const webidlShimPath = path.resolve(projectRoot, "shims", "webidl-conversions", "index.js");
const forcedModulePaths = new Map([
  ["react", require.resolve("react", { paths: [appNodeModules] })],
  ["react/jsx-runtime", require.resolve("react/jsx-runtime", { paths: [appNodeModules] })],
  ["react/jsx-dev-runtime", require.resolve("react/jsx-dev-runtime", { paths: [appNodeModules] })],
  ["react-native", require.resolve("react-native", { paths: [appNodeModules] })],
  ["scheduler", require.resolve("scheduler", { paths: [appNodeModules] })],
]);

const config = getDefaultConfig(projectRoot, { isCSSEnabled: false });
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [appNodeModules, workspaceNodeModules];

config.resolver.extraNodeModules = {
  "webidl-conversions": path.resolve(projectRoot, "shims/webidl-conversions"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedModulePath = forcedModulePaths.get(moduleName);
  if (forcedModulePath) {
    return {
      filePath: forcedModulePath,
      type: "sourceFile",
    };
  }

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
  input: path.resolve(projectRoot, "global.css"),
  configPath: path.resolve(projectRoot, "tailwind.config.cjs"),
  projectRoot,
});
