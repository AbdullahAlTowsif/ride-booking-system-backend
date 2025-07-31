"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hanldeValidationError = void 0;
const hanldeValidationError = (error) => {
    const errorSources = [];
    const errors = Object.values(error.errors);
    errors.forEach((errObj) => errorSources.push({
        path: errObj.path,
        message: errObj.message,
    }));
    return {
        statusCode: 400,
        message: "Validation Error",
        errorSources,
    };
};
exports.hanldeValidationError = hanldeValidationError;
