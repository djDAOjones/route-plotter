/**
 * Vitest configuration for Route Plotter v3
 */

import { defineConfig } from 'vite';

import MinCountReporter from './tests/helpers/minCountReporter.js';

export default defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Global test APIs
    globals: true,
    
    // Setup files
    setupFiles: ['./tests/setup.js'],

    // Clear mock call history between tests, so one test cannot read another's
    // calls. Implementations set with mockImplementation survive.
    clearMocks: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'build.js',
        '*.config.js'
      ]
    },
    
    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs}'],
    
    // Exclude patterns
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    
    // Watch mode
    watchExclude: ['node_modules', 'dist'],
    
    // Reporters. The min-count reporter fails a run that is too small to be
    // the real suite (TST-10).
    reporters: ['verbose', new MinCountReporter()],

    // The app narrates itself to the console, which buried real signal in
    // hundreds of lines a run. Its own debug output is dropped; anything a
    // test prints is kept, and console.error/warn are judged by the guard in
    // tests/helpers/consoleGuard.js (TST-10).
    onConsoleLog(log) {
      return !/^\s*(📐|🎬|🚀|✅|📦|📥|🔧|🛤️|📍|⏱️|🏃|🎛️|📷|💾|🧭|🎚️|🖼️|↩️|⏭️|🔁)/u.test(log);
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Hooks timeout
    hookTimeout: 10000
  },
  
  // Resolve aliases (matching your app structure)
  resolve: {
    alias: {
      '@': '/src',
      '@services': '/src/services',
      '@models': '/src/models',
      '@utils': '/src/utils',
      '@controllers': '/src/controllers',
      '@handlers': '/src/handlers',
      '@config': '/src/config'
    }
  }
});
