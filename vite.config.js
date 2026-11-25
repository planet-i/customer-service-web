import { defineConfig } from 'vite';

// 浏览器只访问本地前端，由 Vite 将聊天请求转发给 Go 服务。
const proxy = {
  '/chat': { target: 'http://127.0.0.1:8888', timeout: 75000, proxyTimeout: 75000 },
};
export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
});
