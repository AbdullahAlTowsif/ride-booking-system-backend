import { Driver } from "./driver.model";
import { IDriver, IsApprove, IsAvailable } from "./driver.interface";
import AppError from "../../errorHelpers/AppError";
import httpStatus from "http-status-codes";
import { Ride } from "../ride/ride.model";
import { RideStatus } from "../ride/ride.interface";

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

const getAvailableRides = async () => {
  const availableRides = await Ride.find({
    driver: null,
    status: RideStatus.REQUESTED
  }).sort({ createdAt: -1 });

  return availableRides;
};



export const DriverService = {
  applyToBeDriver,
  getAvailableRides,
};
