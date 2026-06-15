/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
  experimental: {
    serverBodySizeLimit: '500mb',
  },
};

module.exports = nextConfig;
