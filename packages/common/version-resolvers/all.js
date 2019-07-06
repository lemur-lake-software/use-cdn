"use strict";

const { NPMVersionResolver } = require("./npm");
const { NullVersionResolver } = require("./null");

exports.resolverFactories = {
  npm: NPMVersionResolver,
  null: NullVersionResolver,
};
