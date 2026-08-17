/**
 * Vitest configuration for Route Plotter v3
 */

import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Global test APIs
    globals: true,
    
    // Setup files
    setupFiles: ['./tests/setup.js'],
    
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
    
    // Reporters
    reporters: ['verbose'],
    
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
