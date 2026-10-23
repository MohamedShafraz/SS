/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Server-side filesystem access causes Next's tracer to conservatively include
  // files from the repository root. Never copy generated installers or the
  // separately packaged Store IAP bridge into the standalone server bundle.
  outputFileTracingExcludes: {
    "/*": [
      "./release/**/*",
      "./native/**/*",
      "./client-build/**/*",
      "./marketing-assets/**/*",
      "./qa/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
