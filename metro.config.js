// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-pdf reaches into React Native internals that do not exist on
// web, which breaks `npm run web`. Web is only used to preview layout during
// development, so alias it to a placeholder there. Native builds are untouched.
const webAliases = {
  'react-native-pdf': path.resolve(__dirname, 'src/shims/pdf-web.tsx'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webAliases[moduleName]) {
    return { type: 'sourceFile', filePath: webAliases[moduleName] };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
