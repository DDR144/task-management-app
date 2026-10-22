import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const config = [
  {
    ignores: ["node_modules/**", ".next/**", "drizzle/**", ".agents/**", ".opencode/**"],
  },
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
];

export default config;
