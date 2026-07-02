import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.172"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
