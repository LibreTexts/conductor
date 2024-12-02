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
    extend: {
      height: {
        "screen-content": "calc(100vh - 4.25rem)",
      },
      colors: {
        primary: "#127BC4",
        secondary: "#8553FE",
        accent: "#5F65F5",
        neutral: "#18181B",
        "base-100": "#2A303C",
        info: "#38BDF8",
        save: "#22c55e",
        success: "#338650",
        warning: "#BB5C21",
        error: "#DC3838",
        blue: {
          750: '#0B34D9',
        },
        sky: {
          550: '#179AEB',
        },
      },
      transitionProperty: {
        width: 'width',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography') // for prose (markdown)
  ],
}

