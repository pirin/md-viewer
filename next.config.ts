import type { NextConfig } from "next";

const contentDirs = (process.env.CONTENT_DIRS || "reports,plans")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": contentDirs.map((dir) => `../${dir}/**/*`),
  },
};

export default nextConfig;
