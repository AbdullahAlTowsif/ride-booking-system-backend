import { Driver } from "./driver.model";
import { IDriver, IsApprove, IsAvailable } from "./driver.interface";
import AppError from "../../errorHelpers/AppError";
import httpStatus from "http-status-codes";

const applyToBeDriver = async (userId: string, payload: Partial<IDriver>) => {
  const isAlreadyDriver = await Driver.findOne({ user: userId });

  if (isAlreadyDriver) {
    throw new AppError(httpStatus.BAD_REQUEST, "You have already applied or are already a driver.");
  }

  const newDriver = await Driver.create({
    user: userId,
    vehicleType: payload.vehicleType,
    vehicleNumber: payload.vehicleNumber,
    approvalStatus: IsApprove.PENDING,
    availabilityStatus: IsAvailable.OFFLINE,
  });

  return newDriver;
};


export const DriverService = {
  applyToBeDriver,
};
