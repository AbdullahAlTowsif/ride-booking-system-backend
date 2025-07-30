import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import { Driver } from "../driver/driver.model";
import { IsApprove } from "../driver/driver.interface";
import { User } from "../user/user.model";
import { IsBlock, Role } from "../user/user.interface";
import { Ride } from "../ride/ride.model";

const approveDriver = async (driverId: string) => {
  const existingDriver = await Driver.findById(driverId);

  if (!existingDriver) {
    throw new AppError(httpStatus.NOT_FOUND, "Driver not found");
  }

  if (existingDriver.approvalStatus === IsApprove.APPROVED) {
    throw new AppError(httpStatus.BAD_REQUEST, "Driver is already approved");
  }

  existingDriver.approvalStatus = IsApprove.APPROVED;
  await existingDriver.save();

  await User.findByIdAndUpdate(existingDriver.user, { role: Role.DRIVER });

  return existingDriver;
};

const suspendDriver = async (driverId: string) => {
  const existingDriver = await Driver.findById(driverId);

  if (!existingDriver) {
    throw new AppError(httpStatus.NOT_FOUND, "Driver not found");
  }

  if (existingDriver.approvalStatus === IsApprove.SUSPENDED) {
    throw new AppError(httpStatus.BAD_REQUEST, "Driver is already suspended");
  }

  existingDriver.approvalStatus = IsApprove.SUSPENDED;
  await existingDriver.save();

  return existingDriver;
};

const blockUser = async (userId: string) => {
  const existingUser = await User.findById(userId);

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (existingUser.isBlock === IsBlock.BLOCK) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already blocked");
  }

  existingUser.isBlock = IsBlock.BLOCK;
  await existingUser.save();

  return existingUser;
};

const unblockUser = async (userId: string) => {
  const existingUser = await User.findById(userId);

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (existingUser.isBlock === IsBlock.UNBLOCK) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already unblocked");
  }

  existingUser.isBlock = IsBlock.UNBLOCK;
  await existingUser.save();

  return existingUser;
};

const getAllUsers = async () => {
  return await User.find().select("-password");
};

const getAllDrivers = async () => {
  return await Driver.find().populate("user", "-password");
};

const getAllRides = async () => {
  return await Ride.find()
    .populate("rider", "-password")
    .populate("driver");
};

export const AdminService = {
  approveDriver,
  suspendDriver,
  blockUser,
  unblockUser,
  getAllUsers,
  getAllDrivers,
  getAllRides,
};
