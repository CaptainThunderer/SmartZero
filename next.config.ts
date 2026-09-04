import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Excalidraw uses client-only APIs
  serverExternalPackages: ["@excalidraw/excalidraw"],
};

export default nextConfig;
