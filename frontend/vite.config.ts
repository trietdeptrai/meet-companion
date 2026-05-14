import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/videos": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
