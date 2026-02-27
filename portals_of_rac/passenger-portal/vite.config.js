import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import os from "os";

// Auto-detect the machine's LAN IP address at startup
// so QR codes always embed the correct network URL — no manual .env editing needed.
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip loopback and non-IPv4
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost"; // fallback
}

const LAN_IP = getLanIP();
const PORT = 5175;
const QR_BASE_URL = `http://${LAN_IP}:${PORT}`;

console.log(`\n📱 QR codes will point to: ${QR_BASE_URL}\n`);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    strictPort: true,
    host: true,
    open: true,
  },
  define: {
    // Inject as a global constant so the app can use it without an .env file.
    // Access in code via: import.meta.env.VITE_QR_BASE_URL
    "import.meta.env.VITE_QR_BASE_URL": JSON.stringify(QR_BASE_URL),
  },
});
