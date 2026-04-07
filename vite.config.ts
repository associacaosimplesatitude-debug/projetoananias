import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "CG Digital",
        short_name: "CG Digital",
        description: "Sistema de gestão Central Gospel",
        theme_color: "#1B3A5C",
        background_color: "#1B3A5C",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/login/ebd",
        icons: [
          {
            src: "/icons/icone-central.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icone-central.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
