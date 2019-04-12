"use strict";

const path = require("path");

function getDataBasePath() {
  return path.resolve("./.use-cdn");
}

function getCacheBasePath() {
  return path.join(getDataBasePath(), "cache");
}

function getMetaPath() {
  return path.join(getDataBasePath(), "meta");
}

exports.getDataBasePath = getDataBasePath;
exports.getCacheBasePath = getCacheBasePath;
exports.getMetaPath = getMetaPath;
