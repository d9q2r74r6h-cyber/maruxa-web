import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: { colors: { maruxa: { rojo:'#A51F2B', vino:'#74151F', crema:'#FFF3DF', masa:'#F5D9A9', cafe:'#4B2818', chocolate:'#2A1710', dorado:'#C69245' } }, boxShadow:{premium:'0 24px 80px rgba(42,23,16,.18)'} } },
  plugins: [],
};
export default config;
