import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 输出优化：standalone 模式可大幅减少 Docker 镜像大小
  output: 'standalone',

  // 编译优化
  compiler: {
    // 移除 console.log (生产环境)
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 性能优化
  reactStrictMode: true,

  // 压缩优化
  compress: true,

  // 图片优化
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60,
  },

  // 实验性功能
  experimental: {
    // 优化包导入
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', 'date-fns'],
  },

  // 安全 Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 防止点击劫持攻击
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // 防止 MIME 类型嗅探
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // XSS 保护
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // 引用策略
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 内容安全策略 (CSP)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // 权限策略
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          // API 端点的 CORS 配置
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || '*', // 生产环境应设置特定域名
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-API-Key',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
