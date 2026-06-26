import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (several lockfiles exist on this machine) so
  // Turbopack resolves modules and its cache from this project.
  turbopack: {
    root: process.cwd(),
  },
  // exceljs uses Node APIs / dynamic requires — keep it out of the bundle.
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
