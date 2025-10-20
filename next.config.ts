import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ビルド最適化
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-slider']
  },
  // メモリ使用量の最適化
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
