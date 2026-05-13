/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/lipsync/**/*.{js,jsx,ts,tsx}'],
  corePlugins: { preflight: false }, // don't reset existing page styles
  theme: { extend: {} },
  plugins: [],
};
