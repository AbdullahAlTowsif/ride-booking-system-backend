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
    availabilityStatus: IsAvailable.ONLINE,
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


const acceptRide = async (rideId: string, driverUserId: string) => {
  const driver = await Driver.findOne({ user: driverUserId });

  if (!driver) {
    throw new AppError(httpStatus.FORBIDDEN, "Driver profile not found");
  }

  const ride = await Ride.findById(rideId);

  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, "Ride not found");
  }

  if (ride.status !== RideStatus.REQUESTED) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ride is not available for acceptance");
  }

  if (ride.driver) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ride already assigned to a driver");
  }

  ride.driver = driver._id;
  ride.status = RideStatus.ACCEPTED;
  await ride.save();

  driver.availabilityStatus = IsAvailable.OFFLINE;
  await driver.save();

  return ride;
};


const rejectRide = async (rideId: string, driverUserId: string) => {
  const driver = await Driver.findOne({ user: driverUserId });

  if (!driver) {
    throw new AppError(httpStatus.FORBIDDEN, "Driver profile not found");
  }

  const ride = await Ride.findById(rideId);

  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, "Ride not found");
  }

  if (ride.status === RideStatus.REJECTED || ride.status === RideStatus.COMPLETED) {
    throw new AppError(httpStatus.BAD_REQUEST, `Ride cannot be rejected`);
  }

  if (ride.driver?.toString() !== driver._id.toString() && ride.driver !== null) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not assigned to this ride");
  }

  ride.status = RideStatus.REJECTED;
  ride.driver = null;
  await ride.save();

  driver.availabilityStatus = IsAvailable.ONLINE;
  await driver.save();

  return ride;
};


export const DriverService = {
  applyToBeDriver,
  getAvailableRides,
  acceptRide,
  rejectRide,
};
