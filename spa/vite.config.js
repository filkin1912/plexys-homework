import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "/tickets/",
  server: {
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:18080",
      "/auth": "http://127.0.0.1:18080",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
  },
});
