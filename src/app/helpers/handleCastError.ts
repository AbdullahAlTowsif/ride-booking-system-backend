/* eslint-disable @typescript-eslint/no-unused-vars */

import mongoose from "mongoose";
import { TGenericResponse } from "../interfaces/error.types";

export const handleCastError = (error: mongoose.Error.CastError): TGenericResponse => {
  return {
    statusCode: 400,
    message: "Invalid MongoDB ObjectID. Please provide a valid id.",
  };
};