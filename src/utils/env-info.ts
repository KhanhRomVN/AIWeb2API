import path from 'path';

/**
 * Detects the current runtime environment
 * Distinguishes between npm package mode and standalone (dev, binary, bundle).
 */
export const getEnvInfo = () => {
  const isBinary = !!(process as any).pkg;
  const isDev =
    process.env.NODE_ENV === 'development' || __filename.endsWith('.ts');

  // npm Package detection:
  // Must be a JS file (not .ts) and located inside node_modules
  const isNpmPackage =
    !isDev && !isBinary && __dirname.includes('node_modules');

  return {
    isNpmPackage,
    isStandalone: !isNpmPackage,
    isBinary, // Internal check still useful for DB native bindings
    isDev,
    // Helper to get the mode name
    getMode: () => (isNpmPackage ? 'npm-package' : 'standalone'),
    // The base path where the package/source resides
    baseDir: path.resolve(__dirname, isDev ? '../..' : '..'),
  };
};

export const envInfo = getEnvInfo();
