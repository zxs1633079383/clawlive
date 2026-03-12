const os = require('os');

// Collect all local network IPs so any device on LAN can access dev server
function getAllLocalIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (!info.internal) {
        ips.push(info.address);
      }
    }
  }
  return ips;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@clawlive/shared'],
  allowedDevOrigins: [
    // Allow all local IPs with all port variants
    ...getAllLocalIPs().flatMap(ip => [
      ip,
      `http://${ip}`,
      `https://${ip}`,
      `http://${ip}:3000`,
      `http://${ip}:3001`,
      `https://${ip}:3443`,
      `https://${ip}:3444`,
    ]),
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
