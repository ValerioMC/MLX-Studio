import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  // Only the Vue frontend is linted here: the sidecar has ruff, the Rust core has clippy.
  { ignores: ["dist/", "src-tauri/", "sidecar/", "node_modules/"] },
  {
    files: ["**/*.{ts,vue}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...pluginVue.configs["flat/recommended"]],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      // `_name` marks a value that is destructured away on purpose.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
    },
  },
  {
    files: ["*.vue"],
    languageOptions: { parser: vueParser },
  },
  {
    // Config files run in Node, not the webview.
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
);
