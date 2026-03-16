import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/p/:date",
        destination: "/?date=:date",
      },
    ];
  },
};

export default nextConfig;
