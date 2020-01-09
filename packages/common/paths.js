"use strict";

const path = require("path");

const getDataBasePath = () => path.resolve("./.use-cdn");

const getCacheBasePath = () => path.join(getDataBasePath(), "cache");

const getMetaPath = () => path.join(getDataBasePath(), "meta");

exports.getDataBasePath = getDataBasePath;
exports.getCacheBasePath = getCacheBasePath;
exports.getMetaPath = getMetaPath;
