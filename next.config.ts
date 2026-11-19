import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 배포 종류(production/preview)를 브라우저 코드에서도 알 수 있게 한다. 로컬은 빈 값.
  env: { NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? "" },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // CSS Modules(*.module.css)는 제외해야 클래스 이름이 해시된 지역 스코프로 유지된다.
        // (COMPASS MobileAppShell, GlassTabBar 등이 CSS Modules를 사용)
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
