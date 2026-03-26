const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve modules from the shared folder
const sharedDir = path.resolve(__dirname, '..', 'shared');

config.watchFolders = [sharedDir];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', 'node_modules'),
];

// Ensure shared folder JS files are handled
config.resolver.extraNodeModules = {
  '@shared': sharedDir,
};

module.exports = config;
