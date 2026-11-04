import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // The server-side face matcher loads TensorFlow (WASM) + model files from
  // node_modules at runtime; keep them out of the server bundle.
  serverExternalPackages: ["@vladmandic/human", "@tensorflow/tfjs-backend-wasm", "sharp"],
};

export default nextConfig;
