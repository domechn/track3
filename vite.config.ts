import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: process.env.VITEST ? [] : [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri supports es2021
    target: ["es2021", "chrome100", "safari13"],
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/middlelayers/charts")) {
            return "app-charts";
          }
          if (!id.includes("/node_modules/")) {
            return;
          }
          if (id.includes("/@radix-ui/react-icons/")) {
            return "vendor-icons";
          }
          if (
            id.includes("/chart.js/") ||
            id.includes("/react-chartjs-2/") ||
            id.includes("/chartjs-plugin-datalabels/") ||
            id.includes("/@kurkle/color/")
          ) {
            return "vendor-charts";
          }
          if (id.includes("/framer-motion/")) {
            return "vendor-motion";
          }
          if (id.includes("/@tauri-apps/")) {
            return "vendor-tauri";
          }
          if (
            id.includes("/bluebird/") ||
            id.includes("/call-bind/") ||
            id.includes("/call-bound/") ||
            id.includes("/color-diff/") ||
            id.includes("/crypto-js/") ||
            id.includes("/d3-") ||
            id.includes("/date-fns/") ||
            id.includes("/dunder-proto/") ||
            id.includes("/es-errors/") ||
            id.includes("/function-bind/") ||
            id.includes("/get-intrinsic/") ||
            id.includes("/get-proto/") ||
            id.includes("/gopd/") ||
            id.includes("/has-symbols/") ||
            id.includes("/hasown/") ||
            id.includes("/math-intrinsics/") ||
            id.includes("/object-inspect/") ||
            id.includes("/qs/") ||
            id.includes("/query-string/") ||
            id.includes("/side-channel/") ||
            id.includes("/yaml/")
          ) {
            return "vendor-data";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [".agents/**", "**/.agents/**"],
    coverage: {
      provider: "v8",
      include: ["src/middlelayers/datafetch/coins/**/*.{ts,tsx}"],
      exclude: [
        "src/middlelayers/datafetch/coins/**/*.{test,spec}.{ts,tsx}",
        "src/middlelayers/datafetch/coins/**/__generated__/**",
        "src/middlelayers/datafetch/coins/**/*.generated.{ts,tsx}",
      ],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 50,
      },
    },
  },
});
