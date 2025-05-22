const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ttf', 'otf'];

// Ensure proper React resolution
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
};

// Add watchFolders
config.watchFolders = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config; 