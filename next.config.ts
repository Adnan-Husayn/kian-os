import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg loads pg-cloudflare (TCP sockets on Workers) through a runtime require
  // that file tracing misses; ship it with every server route.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pg-cloudflare/**/*"],
  },
  // Leave Prisma unbundled so OpenNext resolves its "workerd" export (a
  // precompiled Wasm module): Workers forbid compiling Wasm at runtime.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
