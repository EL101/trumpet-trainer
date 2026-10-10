import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import unusedImports from "eslint-plugin-unused-imports";

// Colours live in src/theme/palette.ts; everything else uses semantic tokens.
const HEX = "/(^|[^&\\w])#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\\w-])/";
const noHexMessage =
  'Don\'t hard-code colours. Use a semantic token (e.g. color="fg.muted") or add it to src/theme/palette.ts.';

export default defineConfig([
  globalIgnores(["dist", "src/components/ui"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { "unused-imports": unusedImports },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true, extraHOCs: ["chakra"] },
      ],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/theme/palette.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${HEX}]`, message: noHexMessage },
        { selector: `TemplateElement[value.raw=${HEX}]`, message: noHexMessage },
      ],
    },
  },
]);
