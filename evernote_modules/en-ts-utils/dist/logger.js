"use strict";
/*
 * Copyright 2019 Evernote Corporation. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.createLogger = exports.getLogLevel = exports.setLogLevel = exports.LoggerWrapper = exports.LogLevel = void 0;
const DebugSettings_1 = require("./DebugSettings");
const Errors_1 = require("./Errors");
const index_1 = require("./index");
// tslint:disable:no-console
const LOGGER_UNINIT_PREPEND = 'LoggerBackend for en-ts-utils not set: ';
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = 10] = "TRACE";
    LogLevel[LogLevel["DEBUG"] = 20] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 30] = "INFO";
    LogLevel[LogLevel["WARN"] = 40] = "WARN";
    LogLevel[LogLevel["ERROR"] = 50] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 60] = "FATAL";
    LogLevel[LogLevel["OFF"] = 100] = "OFF";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
const existingLoggers = {};
class UninitializedLogger {
    trace(...args) {
        const message = args.join(' ');
        console.trace(`${LOGGER_UNINIT_PREPEND}${message}`);
    }
    info(...args) {
        const message = args.join(' ');
        console.info(`${LOGGER_UNINIT_PREPEND}${message}`);
    }
    debug(...args) {
        const message = args.join(' ');
        console.debug(`${LOGGER_UNINIT_PREPEND}${message}`);
    }
    warn(...args) {
        const message = args.join(' ');
        console.warn(`${LOGGER_UNINIT_PREPEND}${message}`);
    }
    error(...args) {
        const message = args.join(' ');
        console.error(`${LOGGER_UNINIT_PREPEND}${message}`);
    }
    fatal(...args) {
        const message = args.join(' ');
        console.error(`${LOGGER_UNINIT_PREPEND}${message}`);
    }
}
function isInTest() {
    try {
        if (global.it && global.describe) {
            return true;
        }
    }
    catch (e) {
        return false;
    }
    return false;
}
function fixupLoggerArgs(arg, depth = 0) {
    let res = arg;
    const type = index_1.getTypeOf(res);
    if (res instanceof Errors_1.UnloggableError) {
        res = '';
    }
    else if (res instanceof Error) {
        let stack = res.stack;
        if (stack && res.message && !stack.includes(res.message)) {
            stack = res.message + '\n' + stack;
        }
        res = stack || res.message || res.name || index_1.safeStringify(res) || 'Error';
    }
    else if (type === 'array') {
        for (let i = 0; i < res.length; ++i) {
            const child = fixupLoggerArgs(res[i], depth + 1);
            if (child !== res[i]) {
                if (res === arg) {
                    // shallow clone
                    res = res.slice();
                }
                res[i] = child;
            }
        }
        if (depth === 1) {
            res = index_1.safeStringify(res);
        }
    }
    else if (type === 'object') {
        for (const key in res) {
            const child = fixupLoggerArgs(res[key], depth + 1);
            if (child !== res[key]) {
                if (res === arg) {
                    // shallow clone
                    res = Object.assign({}, res);
                }
                res[key] = child;
            }
        }
        if (depth === 1) {
            res = index_1.safeStringify(res);
        }
    }
    return res;
}
let loggerConfig;
let createLoggerBackend;
let gLogLevel = LogLevel.INFO;
let gOverrideLogLevel = DebugSettings_1.registerDebugSetting('LogLevel', null, lv => {
    gOverrideLogLevel = lv;
    setLogLevel(gLogLevel);
});
function processLogLevel(lv) {
    switch (gOverrideLogLevel) {
        case 'trace':
        case 'TRACE':
            return LogLevel.TRACE;
        case 'debug':
        case 'DEBUG':
            return LogLevel.DEBUG;
        case 'info':
        case 'INFO':
            return LogLevel.INFO;
        case 'warn':
        case 'WARN':
            return LogLevel.WARN;
        case 'error':
        case 'ERROR':
            return LogLevel.ERROR;
        case 'off':
        case 'OFF':
            return LogLevel.OFF;
    }
    return lv;
}
class LoggerWrapper {
    constructor(loggerBackend, topicName) {
        // ideally we shouldn't need this but removing this
        // will lead to a breaking change.
        this.TRACE = LogLevel.TRACE;
        this.DEBUG = LogLevel.DEBUG;
        this.INFO = LogLevel.INFO;
        this.WARN = LogLevel.WARN;
        this.ERROR = LogLevel.ERROR;
        this.FATAL = LogLevel.FATAL;
        this.OFF = LogLevel.OFF;
        this.perfLogCache = {};
        this.logLevel = LogLevel.OFF; // off entirely until configured
        this.loggerBackend = loggerBackend || new UninitializedLogger();
        this.isConfigured = !!loggerBackend;
        this.topicName = topicName;
        // for child loggers, default to global logger's log level.
        this.handleLogLevel(exports.logger && exports.logger.logLevel || LogLevel.OFF);
    }
    handleLogLevel(logLevel) {
        if (this !== exports.logger) {
            gLogLevel = logLevel;
        }
        this.logLevel = processLogLevel(logLevel);
        this.setLogLevel = level => {
            if (this !== exports.logger) {
                gLogLevel = logLevel;
            }
            level = processLogLevel(level);
            this.logLevel = level;
            this.loggerBackend.setLogLevel && this.loggerBackend.setLogLevel(level);
        };
        this.getLogLevel = () => {
            return this.logLevel || gLogLevel;
        };
    }
    trace(message, ...args) {
        if (this.logLevel <= LogLevel.TRACE) {
            return this.loggerBackend.trace(this.getMessage(message), ...fixupLoggerArgs(args));
        }
    }
    info(message, ...args) {
        if (this.logLevel <= LogLevel.INFO) {
            return this.loggerBackend.info(this.getMessage(message), ...fixupLoggerArgs(args));
        }
    }
    debug(message, ...args) {
        if (this.logLevel <= LogLevel.DEBUG) {
            return this.loggerBackend.debug(this.getMessage(message), ...fixupLoggerArgs(args));
        }
    }
    warn(message, ...args) {
        if (this.logLevel <= LogLevel.WARN) {
            return this.loggerBackend.warn(this.getMessage(message), ...fixupLoggerArgs(args));
        }
    }
    perf(message, ...args) {
        if (this.logLevel > LogLevel.WARN) {
            return;
        }
        const fixedArgs = fixupLoggerArgs(args);
        const idString = message + index_1.safeStringify(fixedArgs);
        if (!this.perfLogCache[idString]) {
            this.perfLogCache[idString] = true;
            return this.loggerBackend.warn(this.getMessage('Performance:' + message), ...fixedArgs);
        }
    }
    error(message, ...args) {
        if (this.logLevel <= LogLevel.ERROR) {
            return this.loggerBackend.error(this.getMessage(message), ...fixupLoggerArgs(args));
        }
    }
    fatal(message, ...args) {
        if (this.logLevel <= LogLevel.FATAL) {
            return this.loggerBackend.fatal(this.getMessage(message), ...fixupLoggerArgs(args));
        }
    }
    configure(config, createLoggerFn) {
        if (this.isConfigured && !isInTest()) {
            console.warn(`(!) Reinitializing logger ${this.topicName || ''}!`);
            this.warn(`(!) Reinitializing logger ${this.topicName || ''}!`);
        }
        this.isConfigured = true;
        this.loggerBackend = createLoggerFn(config);
        let logLevel = this.logLevel;
        if (config.console) {
            logLevel = config.console.level;
        }
        if (config.file && config.file.level < this.logLevel) {
            logLevel = config.file.level;
        }
        this.handleLogLevel(logLevel);
        if (this !== exports.logger) {
            // rest of the logic is to be executed on global logger only.
            return;
        }
        loggerConfig = config;
        createLoggerBackend = createLoggerFn;
        this.createChildLogger = this.loggerBackend && this.loggerBackend.createChildLogger ? this.loggerBackend.createChildLogger.bind(this.loggerBackend) : undefined;
        for (const topicName in existingLoggers) {
            // reconfigure logger backend for all existing loggers.
            const childLogger = existingLoggers[topicName];
            if (exports.logger.createChildLogger) {
                childLogger.loggerBackend = exports.logger.createChildLogger(topicName);
                // child logger backend should take care of printing topicName in log. Remove here.
                childLogger.topicName = undefined;
            }
            else {
                childLogger.configure(config, createLoggerFn);
                childLogger.topicName = topicName;
            }
            // default to global logger's log level.
            childLogger.handleLogLevel(logLevel);
        }
        this.trace('Logger initialized.');
    }
    safetyCheckLevels(levelFromName) {
        this.checkLevel(levelFromName, 'TRACE');
        this.checkLevel(levelFromName, 'DEBUG');
        this.checkLevel(levelFromName, 'INFO');
        this.checkLevel(levelFromName, 'WARN');
        this.checkLevel(levelFromName, 'ERROR');
        this.checkLevel(levelFromName, 'FATAL');
    }
    checkLevel(levelFromName, level) {
        if (this[level] !== levelFromName[level.toLowerCase()]) {
            throw new Error(`Mismatch between log level ${level} value in Conduit (${this[level]}) and Bunyan (${levelFromName[level]})`);
        }
    }
    getMessage(message) {
        return this.topicName ? `${this.topicName} ${message}` : message;
    }
}
exports.LoggerWrapper = LoggerWrapper;
function setLogLevel(level) {
    exports.logger.setLogLevel(level);
    for (const topicName in existingLoggers) {
        existingLoggers[topicName].setLogLevel(level);
    }
}
exports.setLogLevel = setLogLevel;
function getLogLevel() {
    return exports.logger.getLogLevel();
}
exports.getLogLevel = getLogLevel;
function createLogger(topicName) {
    if (existingLoggers[topicName]) {
        return existingLoggers[topicName];
    }
    let childLogger;
    if (!exports.logger.isConfigured) {
        // logger not yet configured. Return uninitialized logger for now.
        // loggerBackend will be filled up during logger configuration.
        childLogger = new LoggerWrapper(undefined, topicName);
    }
    else if (exports.logger.createChildLogger) {
        const loggerBackend = exports.logger.createChildLogger(topicName);
        childLogger = new LoggerWrapper(loggerBackend);
    }
    else if (loggerConfig && createLoggerBackend) {
        childLogger = new LoggerWrapper(undefined, topicName);
        childLogger.configure(loggerConfig, createLoggerBackend);
    }
    if (childLogger) {
        existingLoggers[topicName] = childLogger;
        return childLogger;
    }
    return exports.logger;
}
exports.createLogger = createLogger;
// Logger frontend
exports.logger = new LoggerWrapper();
//# sourceMappingURL=logger.js.map