import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings available during `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hrovkahgsbiygaymeovu.supabase.co",
        pathname: "/storage/v1/object/public/place-photos/**",
      },
    ],
  },
};

export default nextConfig;
