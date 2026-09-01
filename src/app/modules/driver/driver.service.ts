import { Driver } from "./driver.model";
import { IDriver, IsApprove, IsAvailable } from "./driver.interface";
import AppError from "../../errorHelpers/AppError";
import httpStatus from "http-status-codes";
import { Ride } from "../ride/ride.model";
import { RideStatus } from "../ride/ride.interface";
import { User } from "../user/user.model";

const applyToBeDriver = async (userId: string, payload: Partial<IDriver>) => {
  const isAlreadyDriver = await Driver.findOne({ user: userId });

  if (isAlreadyDriver) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already applied or are already a driver."
    );
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
    status: RideStatus.REQUESTED,
  }).sort({ createdAt: -1 });

  return availableRides;
};

const getMyRides = async (userId: string) => {
  const driver = await Driver.findById(userId);
  // console.log(driver?._id);
  const myRides = await Ride.find({
    driver: driver?._id,
  }).sort({ createdAt: -1 });

  return myRides;
};

const acceptRide = async (rideId: string, driverUserId: string) => {
  const driver = await Driver.findOne({ user: driverUserId });

  if (!driver) {
    throw new AppError(httpStatus.FORBIDDEN, "Driver profile not found");
  }

  if (driver.approvalStatus === IsApprove.SUSPENDED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You are a SUSPENDED Driver. You cannot accept Request"
    );
  }

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: RideStatus.REQUESTED, driver: null },
    {
      $set: {
        driver: driver._id,
        status: RideStatus.ACCEPTED,
        "timestamps.acceptedAt": new Date(),
      },
    },
    { new: true }
  );

  if (!ride) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Ride is not available for acceptance"
    );
  }

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

  if (
    ride.status === RideStatus.REJECTED ||
    ride.status === RideStatus.COMPLETED
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, `Ride cannot be rejected`);
  }

  if (
    ride.driver?.toString() !== driver._id.toString() &&
    ride.driver !== null
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not assigned to this ride"
    );
  }

  ride.status = RideStatus.REJECTED;
  ride.driver = null;
  await ride.save();

  driver.availabilityStatus = IsAvailable.ONLINE;
  await driver.save();

  return ride;
};

const updateRideStatus = async (rideId: string, driverUserId: string) => {
  const driver = await Driver.findOne({ user: driverUserId });
  if (!driver) {
    throw new AppError(httpStatus.NOT_FOUND, "Driver profile not found");
  }

  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, "Ride not found");
  }

  if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not assigned to this ride"
    );
  }

  let newStatus: typeof ride.status;

  if (ride.status === RideStatus.ACCEPTED) {
    newStatus = RideStatus.PICKED_UP;
    ride.timestamps.pickedUpAt = new Date();
  } else if (ride.status === RideStatus.PICKED_UP) {
    newStatus = RideStatus.IN_TRANSIT;
    ride.timestamps.inTransitAt = new Date();
  } else if (ride.status === RideStatus.IN_TRANSIT) {
    newStatus = RideStatus.COMPLETED;
    ride.timestamps.completedAt = new Date();
  } else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid ride status transition from ${ride.status}`
    );
  }

  ride.status = newStatus;
  await ride.save();

  if (newStatus === RideStatus.COMPLETED) {
    driver.availabilityStatus = IsAvailable.ONLINE;
    await driver.save();
  }

  return ride;
};

const updateAvailability = async (userId: string, status: IsAvailable) => {
  const driver = await Driver.findOne({ user: userId });

  if (!driver) {
    throw new AppError(httpStatus.NOT_FOUND, "Driver profile not found");
  }

  if (
    driver.approvalStatus === IsApprove.SUSPENDED ||
    driver.approvalStatus === IsApprove.BLOCKED ||
    driver.approvalStatus === IsApprove.PENDING
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `You're ${driver.approvalStatus} Driver. You're not allowed to do this.`
    );
  }

  driver.availabilityStatus = status;
  await driver.save();

  return driver;
};

const getMeDriver = async (userId: string) => {
  // console.log(userId);
  const driver = await Driver.findOne({ user: userId });
  return {
    data: driver,
  };
};

const getRideHistory = async (userId: string) => {
  const driver = await Driver.findOne({ user: userId });

  if (!driver) {
    throw new AppError(httpStatus.NOT_FOUND, "Driver not found");
  }

  const rides = await Ride.find({ driver: driver._id }).sort({ createdAt: -1 });

  const totalEarnings = driver.earnings;

  return {
    totalRides: rides.length,
    totalEarnings,
    rides,
  };
};

const getDriverProfile = async (userId: string) => {
  const driver = await Driver.findOne({ user: userId }).populate("user");
  if (!driver)
    throw new AppError(httpStatus.NOT_FOUND, "Driver profile not found");
  return driver;
};

const updateDriverProfile = async (
  userId: string,
  payload: {
    name?: string;
    phone?: string;
    address?: string;
    vehicleType?: string;
    vehicleNumber?: string;
  }
) => {
  const driver = await Driver.findOne({ user: userId });
  if (!driver) throw new AppError(httpStatus.NOT_FOUND, "Driver not found");

  const user = await User.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  // Update user fields
  if (payload.name) user.name = payload.name;
  if (payload.phone) user.phone = payload.phone;
  if (payload.address) user.address = payload.address;

  // Update driver fields
  if (payload.vehicleType) driver.vehicleType = payload.vehicleType;
  if (payload.vehicleNumber) driver.vehicleNumber = payload.vehicleNumber;

  await user.save();
  await driver.save();

  return { user, driver };
};

export const DriverService = {
  applyToBeDriver,
  getAvailableRides,
  acceptRide,
  rejectRide,
  updateRideStatus,
  getRideHistory,
  updateAvailability,
  getMeDriver,
  getMyRides,
  getDriverProfile,
  updateDriverProfile,
};
