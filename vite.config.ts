import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      // 增加 WebSocket 帧大小限制
      maxPayloadSize: 5242880, // 5MB
    },
    // 增加请求头大小限制
    headers: {
      'Access-Control-Allow-Headers': '*',
    },
  },
})
