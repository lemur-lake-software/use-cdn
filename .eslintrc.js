module.exports = {
  extends: [
    "lddubeau-base"
  ],
  env: {
    node: true,
  },
  rules: {
    // The monorepo structure causes a lot of false positives.
    "import/no-extraneous-dependencies": "off",
  }
};
