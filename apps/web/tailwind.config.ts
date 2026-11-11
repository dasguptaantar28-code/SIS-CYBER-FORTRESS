import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        sis: {
          bg: '#050B18',
          secondary: '#0B1730',
          card: '#10213F',
          border: '#1B335E',
          blue: '#087BFF',
          cyan: '#00D4FF',
          success: '#00D69A',
          warning: '#FFB547',
          danger: '#FF4560',
          text: '#F3F7FF',
          muted: '#96A8C5',
        },
      },
      boxShadow: {
        'sis-glow': '0 0 24px rgba(0, 212, 255, 0.14)',
        'sis-card': '0 10px 30px rgba(2, 8, 22, 0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
