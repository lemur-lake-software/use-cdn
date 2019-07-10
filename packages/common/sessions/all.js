"use strict";

const { CdnjsSession } = require("./cdnjs");
const { UnpkgSession } = require("./unpkg");

exports.sessionFactories = {
  unpkg: UnpkgSession,
  cdnjs: CdnjsSession,
};
