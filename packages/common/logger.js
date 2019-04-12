"use strict";

const log4js = require("log4js");

function setup(level) {
  log4js.configure({
    appenders: {
      console: {
        type: "console",
      },
    },
    categories: {
      default: {
        appenders: ["console"],
        level,
      },
    },
  });
}

const loggerCache = Object.create(null);

function getLogger(name) {
  let logger = loggerCache[name];
  if (logger === undefined) {
    loggerCache[name] = logger = log4js.getLogger(name);
  }

  return logger;
}

exports.getLogger = getLogger;
exports.setup = setup;
