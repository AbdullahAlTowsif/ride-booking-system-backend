/* eslint-disable @typescript-eslint/no-explicit-any */

import { TGenericResponse } from "../interfaces/error.types";

export const handleDuplicateError = (error: any): TGenericResponse => {
  const matchedArray = error.message.match(/"([^"]*)"/);
  return {
    statusCode: 400,
    message: `${matchedArray[1]} already exists`,
  };
};