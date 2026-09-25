/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    // Bundle the build-time opencode binary into the API functions
    outputFileTracingIncludes: {
      "/api/chat": [".opencode/bin/**"],
      "/api/autonomous": [".opencode/bin/**"],
      "/api/opencode/install": [".opencode/bin/**"],
      "/api/opencode/agents": [".opencode/bin/**"],
      "/api/opencode/mcp": [".opencode/bin/**"],
      "/api/opencode/auth": [".opencode/bin/**"],
    },
  },
};

module.exports = nextConfig;
