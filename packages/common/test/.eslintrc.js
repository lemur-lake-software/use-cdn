module.exports = {
  extends: "../../../.eslintrc.js",
  env: {
    mocha: true,
  },
  rules: {
    "no-unused-expressions": ["off", "False positives with chai."],
    "max-lines-per-function": ["off", "describe blocks often fail this test."],
  },
};
