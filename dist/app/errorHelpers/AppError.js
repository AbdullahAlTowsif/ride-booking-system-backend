"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AppError extends Error {
    constructor(statusCode, message, stack = '') {
        super(message); // throw new Error("Something went wrong")
        this.statusCode = statusCode;
        // this is our stack
        if (stack) {
            this.stack = stack;
        }
        // this is default stack from Error class
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.default = AppError;
