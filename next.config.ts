import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  }
  // Removimos eslint porque ya no es soportado en Next.js 15+
};

export default nextConfig;
