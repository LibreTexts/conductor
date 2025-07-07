/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}'
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
        "primary-hover": "#0F6FA2",
        "primary-dark": "#0b4a76",
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
        muted: '#F9FAFB',
      },
      transitionProperty: {
        width: 'width',
      },
      boxShadow: {
        // light
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        // dark
        'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {'tremor-small': '0.375rem', 'tremor-default': '0.5rem', 'tremor-full': '9999px',},
      fontSize: {
        'tremor-label': ['0.75rem', {lineHeight: '1rem'}],
        'tremor-default': ['0.875rem', {lineHeight: '1.25rem'}],
        'tremor-title': ['1.125rem', {lineHeight: '1.75rem'}],
        'tremor-metric': ['1.875rem', {lineHeight: '2.25rem'}],
      },
    },
  },
  safelist: [
    {
      pattern: /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected'],
    }, {
      pattern: /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected'],
    }, {
      pattern: /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ['hover', 'ui-selected'],
    }, {
      pattern: /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    }, {
      pattern: /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    }, {
      pattern: /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],
  plugins: [
    require('@tailwindcss/typography'), // for prose (markdown)
    require('@tailwindcss/forms'),
    require('@headlessui/tailwindcss'),
  ],
}

