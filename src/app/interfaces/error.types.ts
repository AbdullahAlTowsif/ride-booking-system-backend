export interface TErrorSources {
  path: string;
  message: string;
}

export interface TGenericResponse {
  statusCode: number;
  message: string;
  errorSources?: TErrorSources[];
}
