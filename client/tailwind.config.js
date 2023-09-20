/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  blocklist: [
    'outline', // this is overriding a semantic-ui icon class
    'fixed' // overriding semantic-ui tables, block for now
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

