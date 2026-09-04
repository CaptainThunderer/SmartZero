import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Packages that must not be bundled by webpack on the server
  serverExternalPackages: ["@excalidraw/excalidraw", "node-edge-tts", "ws"],
};

export default nextConfig;
