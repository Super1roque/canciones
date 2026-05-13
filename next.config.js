/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
};

module.exports = nextConfig;
