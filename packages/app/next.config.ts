import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal packages ship TypeScript source, so Next.js must compile them.
  transpilePackages: ["@easyrms/core", "@easyrms/db", "@easyrms/ui"],
};

export default nextConfig;
