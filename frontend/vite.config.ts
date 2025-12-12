import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: proxyTarget
        ? {
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
              // Strip leading /api before forwarding to API Gateway
              rewrite: (path) => path.replace(/^\/api/, ""),
            },
          }
        : undefined,
    },
    test: {
      environment: "jsdom",
      setupFiles: "src/test/setup.ts",
    },
  };
});
