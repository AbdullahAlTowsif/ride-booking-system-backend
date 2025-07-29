/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextFunction, Request, Response, urlencoded } from "express";
import { envVars } from "../config/env";
import { TErrorSources } from "../interfaces/error.types";
import { handleDuplicateError } from "../helpers/handleDuplicateError";
import { handleCastError } from "../helpers/handleCastError";
import { handleZodError } from "../helpers/handleZodError";
import { hanldeValidationError } from "../helpers/handleValidationError";
import AppError from "../errorHelpers/AppError";


export const globalErrorHandler = async (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {

  if(envVars.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(error);
  }

  let errorSources: TErrorSources[] = [];
  let statusCode = 500;
  let message = `Something Went Wrong!`;

  // duplicate error
  if (error.code === 11000) {
    const simplifiedError = handleDuplicateError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  }
  // cast error / objectId error
  else if (error.name === "CastError") {
    const simplifiedError = handleCastError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
  }
  // zod error
  else if (error.name === "ZodError") {
    const simplifiedError = handleZodError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;

    errorSources = simplifiedError.errorSources as TErrorSources[];
  }
  // Mongoose Validation Error
  else if (error.name === "ValidationError") {
    const simplifiedError = hanldeValidationError(error);
    statusCode = simplifiedError.statusCode;
    errorSources = simplifiedError.errorSources as TErrorSources[];
    message = simplifiedError.message;
  }

  else if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } 

  else if (error instanceof Error) {
    statusCode = 500;
    message = error.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    error: envVars.NODE_ENV === "development" ? error : null,
    stack: envVars.NODE_ENV === "development" ? error.stack : null,
  });
};