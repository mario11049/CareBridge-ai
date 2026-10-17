import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse must run as a plain Node module on the server, not be bundled.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
