/** @type {import('next').NextConfig} */
const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
const nextConfig = {
  poweredByHeader: false,
  // The public marketing site is plain HTML in /public (built from /site). "/" serves its homepage untouched.
  async rewrites() { return { beforeFiles: [{ source: '/', destination: '/index.html' }] }; },
  async headers() {
    return [
      { source: '/(.*)', headers: security },
      { source: '/(portal|admin|login|auth)(.*)', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/assets/fonts/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};
export default nextConfig;
