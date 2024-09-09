import globals from "globals";

import js from "@eslint/js";


export default [
  js.configs.all,
  {
      languageOptions: { globals: globals.browser }
  },
  {
      files: ["**/*.js"],
      languageOptions: {sourceType: "script"},
      rules: {
        "capitalized-comments": ["off"],
        "no-console": ["off"],
        "no-inline-comments": ["off"],
        "no-ternary": ["off"],
        "no-unused-vars": [
          "warn",
          {
            "argsIgnorePattern": "^_[^_].*$|^_$",
            "caughtErrorsIgnorePattern": "^_[^_].*$|^_$",
            "varsIgnorePattern": "^_[^_].*$|^_$"
          }
        ],
        "sort-vars": ["off"]
      }
  },
];