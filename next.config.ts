import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a phone on the same network (or through a tunnel) load dev assets,
  // which is the only way to test a controller against a laptop screen.
  allowedDevOrigins: ["*.trycloudflare.com", "*.loca.lt", "192.168.*.*"],
};

export default nextConfig;
