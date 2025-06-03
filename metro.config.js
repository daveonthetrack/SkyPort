const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json', 'mjs', 'cjs'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ttf', 'otf'];

// Enhanced Node.js polyfills for Supabase
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('crypto-browserify'),
  buffer: require.resolve('buffer/'),
  util: require.resolve('util/'),
  process: require.resolve('process/browser'),
  zlib: require.resolve('browserify-zlib'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  os: require.resolve('os-browserify/browser'),
  path: require.resolve('path-browserify'),
  url: require.resolve('url/'),
  querystring: require.resolve('querystring-es3'),
  // WebSocket polyfills
  ws: false,
  net: false,
  tls: false,
  fs: false,
  child_process: false,
};

// Add watchFolders
config.watchFolders = [
  path.resolve(__dirname, 'node_modules'),
];

// Enhanced resolver to handle WebSocket and other Node modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle WebSocket imports
  if (moduleName === 'ws' || moduleName.startsWith('ws/')) {
    return {
      filePath: require.resolve('react-native-url-polyfill/auto'),
      type: 'sourceFile',
    };
  }
  
  // Handle URL imports
  if (moduleName === 'url') {
    return {
      filePath: require.resolve('react-native-url-polyfill/auto'),
      type: 'sourceFile',
    };
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config; 