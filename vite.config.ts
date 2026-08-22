import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Split big third-party libs into their own long-lived chunks so the app
    // shell stays small and browsers can cache vendors across deploys.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // Charts / PDF / spreadsheet libs are intentionally NOT split here so
          // they stay inside the lazy route chunks that use them.

          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("react-router") ||
            id.includes("@tanstack")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
}));
