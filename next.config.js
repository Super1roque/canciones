/** @type {import('next').NextConfig} */
const nextConfig = {
  // whatsapp-web.js y puppeteer son librerías puramente Node.js.
  // Next.js no debe intentar bundlearlas — se usan solo en el servidor.
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'fluent-ffmpeg', '@ffmpeg-installer/ffmpeg'],
};

module.exports = nextConfig;
