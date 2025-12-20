
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 載入環境變數 (Vercel 會在建置時自動提供 API_KEY)
  // Fix: Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error in TypeScript.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 確保前端代碼可以透過 process.env.API_KEY 存取到金鑰
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    server: {
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
