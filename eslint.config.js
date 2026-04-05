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
    ignores: ["node_modules/", "dist/", ".next/"]
  },
  {
    files: ["**/*.mjs", "**/*.cjs", "**/scripts/*.mjs"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly"
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
  }
];
