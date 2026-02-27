import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3001,
        open: true,
        cors: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    },
    define: {
        // For compatibility with libraries that check process.env.NODE_ENV
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }
})
