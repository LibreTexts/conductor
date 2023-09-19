/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  blocklist: [
    'outline', // this is overriding a semantic-ui icon class
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

