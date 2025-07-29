/* eslint-disable @typescript-eslint/no-explicit-any */

import mongoose from "mongoose";
import { TErrorSources, TGenericResponse } from "../interfaces/error.types";

export const hanldeValidationError = ( error: mongoose.Error.ValidationError ): TGenericResponse => {
  const errorSources: TErrorSources[] = [];

  const errors = Object.values(error.errors);

  errors.forEach((errObj: any) =>
    errorSources.push({
      path: errObj.path,
      message: errObj.message,
    })
  );
  // message = error.message;

  return {
    statusCode: 400,
    message: "Validation Error",
    errorSources,
  };
};