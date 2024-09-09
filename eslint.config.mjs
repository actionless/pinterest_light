import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {
      files: ["**/*.js"],
      languageOptions: {sourceType: "script"},
      rules: {
        "no-unused-vars": [
          "warn",
          {
            "argsIgnorePattern": "^_[^_].*$|^_$",
            "varsIgnorePattern": "^_[^_].*$|^_$",
            "caughtErrorsIgnorePattern": "^_[^_].*$|^_$"
          }
        ]
      }
  },
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
];
