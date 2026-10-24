import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal packages ship TypeScript source, so Next.js must compile them.
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
