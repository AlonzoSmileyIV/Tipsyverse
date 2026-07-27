import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const jsxInJavaScript = () => ({
  name: "tipsyverse-jsx-in-javascript",
  enforce: "pre",
  async transform(source, id) {
    if (!id.includes("/src/") || !id.endsWith(".js")) return null;
    return transformWithEsbuild(source, id, {
      loader: "jsx",
      jsx: "automatic",
    });
  },
});

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, process.cwd(), "");
  const clientEnvironment = Object.fromEntries(
    Object.entries(loaded).filter(([key]) => key.startsWith("REACT_APP_"))
  );
  clientEnvironment.NODE_ENV = mode === "production" ? "production" : "development";

  return {
    plugins: [jsxInJavaScript(), react({ include: /\.[jt]sx?$/ })],
    define: {
      "process.env": JSON.stringify(clientEnvironment),
      global: "globalThis",
    },
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.js$/,
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: { ".js": "jsx" },
      },
    },
    server: {
      port: 3000,
      strictPort: true,
    },
    preview: {
      port: 3000,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      sourcemap: process.env.SOURCE_MAPS === "true" ? "hidden" : false,
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (
              /node_modules\/(react|react-dom|react-router|react-router-dom|react-redux|@reduxjs\/toolkit)\//.test(
                id
              )
            ) {
              return "vendor-react";
            }
            if (/node_modules\/@mui\/x-data-grid\//.test(id)) {
              return "vendor-data-grid";
            }
            if (/node_modules\/@mui\/icons-material\//.test(id)) {
              return "vendor-mui-icons";
            }
            if (/node_modules\/(@mui|@emotion)\//.test(id)) {
              return "vendor-mui";
            }
            if (/node_modules\/(@stripe|@sentry)\//.test(id)) {
              return "vendor-integrations";
            }
            return undefined;
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.js",
      exclude: ["e2e/**", "node_modules/**", "dist/**"],
      css: true,
      cache: false,
    },
  };
});
