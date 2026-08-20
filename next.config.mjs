/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so this can be deployed straight to Cloudflare Pages
  // as static assets. The app now talks to a separate Cloudflare Worker
  // (see NEXT_PUBLIC_API_URL) instead of Next.js API routes.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
