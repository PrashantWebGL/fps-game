import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        // Optimize chunk size for CrazyGames requirements
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split Three.js into separate chunk
                    three: ['three']
                }
            }
        },
        // Ensure proper asset handling
        assetsInlineLimit: 4096, // Inline assets smaller than 4kb
        // Optimize for production
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false, // Keep console for debugging
                drop_debugger: true
            }
        }
    },
    // Base path for assets
    base: './',
    // Preview server configuration
    preview: {
        port: 4173,
        strictPort: false,
        open: true
    }
})
