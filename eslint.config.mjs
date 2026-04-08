import { createRequire } from "module";
const require = createRequire(import.meta.url);

import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactNative from "eslint-plugin-react-native";

const react = require("eslint-plugin-react");
const prettier = require("eslint-config-prettier");

export default [
  js.configs.recommended,
  ...typescript.configs["flat/recommended"],
  {
    plugins: {
      react: react
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off"
    }
  },
  {
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {}
  },
  {
    plugins: {
      "react-native": reactNative
    },
    rules: {
      "react-native/no-color-literals": "warn",
      "react-native/no-inline-styles": "warn",
      "react-native/no-raw-text": "off"
    }
  },
  {
    plugins: {
      prettier: prettier
    },
    rules: prettier.rules
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  },
   {
     ignores: [
       "**/node_modules/**",
       "**/dist/**",
       "**/.next/**",
       "**/build/**",
       "**/out/**",
       "**/.turbo/**",
       "**/.expo/**",
       "**/tailwind.config.js",
       "**/tailwind.config.ts"
     ]
   },
   {
     files: ["**/*.mjs", "**/*.cjs", "**/scripts/*.mjs"],
     languageOptions: {
       ecmaVersion: 2020,
       sourceType: "commonjs",
       globals: {
         console: "readonly",
       }
     },
     rules: {
       "@typescript-eslint/no-require-imports": "off"
     }
   },
  {
    files: ["**/metro.config.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module"
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  },
  {
    files: [
      "apps/mobile/app/**/*.{ts,tsx}",
      "apps/mobile/components/server-unavailable-banner.tsx",
      "apps/mobile/smoke-root.tsx"
    ],
    rules: {
      "react-native/no-color-literals": "off",
      "react-native/no-inline-styles": "off"
    }
  }
];

