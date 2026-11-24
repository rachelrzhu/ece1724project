import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async redirects() {
    const authURL = process.env.BETTER_AUTH_URL;
    if (process.env.NODE_ENV !== "development" || !authURL || !URL.canParse(authURL)) return [];
    const { hostname, port, origin } = new URL(authURL);
    if (hostname !== "localhost" && hostname !== "127.0.0.1") return [];

    // Use one cookie host from sign-up through Google's registered callback.
    const alias = hostname === "localhost" ? "127\\.0\\.0\\.1" : "localhost";
    const host = port ? `${alias}:${port}` : alias;
    return ["/", "/account", "/recipes/:path*", "/users/:path*"].map(source => ({
      source,
      has: [{ type: "header" as const, key: "host", value: host }],
      destination: origin + source,
      permanent: false,
    }));
  },
};
export default nextConfig;
