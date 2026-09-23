// Flat config. The only rule on is no-undef: after the module split, an
// identifier that used to be a closure var in the IIFE but was not imported
// into its new module is a crash on a path the harness never reaches
// (rotate overlay, settings actions, image upload, reset, share). src/ is
// checked against browser globals only, so a stray Node global there is
// caught too; the harness is a Node script whose page.evaluate callbacks
// run in the browser, so it gets both sets.
import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['test/harness.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { 'no-undef': 'error' },
  },
];
