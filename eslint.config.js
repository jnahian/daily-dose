const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "web/**",
      "public/**",
      "coverage/**",
      "prisma/migrations/**",
      "logs/**",
      "temp/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      "no-console": "off",
      eqeqeq: ["error", "always"],
      "prefer-const": "warn",
      "no-var": "error",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
