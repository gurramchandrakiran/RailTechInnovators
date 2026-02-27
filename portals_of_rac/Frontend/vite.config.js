import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'

// Auto-detect the machine's LAN IP address at startup
// so QR codes always embed the correct network URL
function getLanIP() {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return 'localhost'
}

const LAN_IP = getLanIP()
const PORT = 3000

console.log(`\n📱 QR codes will point to: http://${LAN_IP}:${PORT}\n`)

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: PORT,
        open: true,
        cors: true,
        host: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        'import.meta.env.VITE_QR_BASE_URL': JSON.stringify(`http://${LAN_IP}:${PORT}`),
    },
})
