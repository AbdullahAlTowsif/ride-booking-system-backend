/* eslint-disable @typescript-eslint/no-explicit-any */

import { TErrorSources, TGenericResponse } from "../interfaces/error.types";

export const handleZodError = (error: any): TGenericResponse => {
  const errorSources: TErrorSources[] = [];
  error.issues.forEach((issue: any) => {
    errorSources.push({
      path: issue.path[issue.path.length - 1],
      message: issue.message,
    });
  });

  return {
    statusCode: 400,
    message: "Zode Error",
    errorSources,
  };
};