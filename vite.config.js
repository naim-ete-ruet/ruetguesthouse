import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import net from 'net'

function autoBackendPlugin() {
  return {
    name: 'auto-backend-server',
    configureServer() {
      // Check if backend port 5000 is open; auto-start if not
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        console.log('[auto-backend] Backend API server is active on port 5000.');
      });
      socket.on('error', () => {
        socket.destroy();
        console.log('[auto-backend] Starting local backend server on port 5000...');
        const child = spawn('node', ['backend/server.js'], {
          stdio: 'inherit',
          shell: true
        });
        child.on('error', (err) => console.warn('[auto-backend] Could not auto-start backend:', err.message));
        process.on('exit', () => child.kill());
      });
      socket.on('timeout', () => {
        socket.destroy();
      });
      socket.connect(5000, '127.0.0.1');
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoBackendPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@react-pdf')) {
            return 'pdf-vendor';
          }
          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'react-vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1200
  }
})
