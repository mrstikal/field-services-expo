const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Explicitly set projectRoot for Expo CLI
config.projectRoot = projectRoot;
config.resolver.disableHierarchicalLookup = true;

config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  react: path.resolve(monorepoRoot, 'node_modules/react'),
  'react-dom': path.resolve(monorepoRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
  scheduler: path.resolve(monorepoRoot, 'node_modules/scheduler'),
};

module.exports = withNativeWind(config, {
  input: './global.css',
});
