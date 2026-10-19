import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // keep these as real node_modules at runtime — they ship worker assets and
  // native-ish code that breaks when bundled into a route handler
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@google/genai"],
};

export default nextConfig;
