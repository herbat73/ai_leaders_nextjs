import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal packages ship TypeScript source, so Next.js must compile them.
  // Native module (libvips): it must be loaded from node_modules, never bundled.
  serverExternalPackages: ["sharp"],
  experimental: { agentUpgrade: "security" },
  // Dev only: lets the dev server be opened via 127.0.0.1 (not just localhost) without blocking HMR/dev assets.
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@easyrms/core", "@easyrms/db", "@easyrms/ui"],
  // The order lookup moved from `/returns/lookup` to `/`; old links and bookmarks keep working (308).
  redirects() {
    return Promise.resolve([{ source: "/returns/lookup", destination: "/", permanent: true }]);
  },
  // The invite token is part of the path, so the page must never leak it through a `Referer` header.
  headers() {
    return Promise.resolve([
      { source: "/admin/invite/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ]);
  },
};

export default nextConfig;
