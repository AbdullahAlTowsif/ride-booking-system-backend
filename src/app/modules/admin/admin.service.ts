import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import { Driver } from "../driver/driver.model";
import { IsApprove } from "../driver/driver.interface";
import { User } from "../user/user.model";
import { IsBlock, Role } from "../user/user.interface";
import { Ride } from "../ride/ride.model";
import { IAdminReport } from "./admin.interface";
import { RideStatus } from "../ride/ride.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { userSearchableFields } from "./admin.constant";

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

const getAllUsers = async (query: Record<string, string>) => {
  // return await User.find().select("-password");
  const queryBuilder = new QueryBuilder(User.find(), query)
  const users = await queryBuilder.search(userSearchableFields).filter().sort().fields().paginate()

  const [data, meta] = await Promise.all([
    users.build(),
    queryBuilder.getMeta()
  ])

  return {
    data, meta
  }
};

const getAllDrivers = async () => {
  return await Driver.find().populate("user", "-password");
};

const getAllRides = async () => {
  return await Ride.find().populate("rider", "-password").populate("driver");
};

export const generateAdminReport = async (): Promise<IAdminReport> => {
  const [
    totalUsers,
    totalDrivers,
    totalRides,
    completedRides,
    ongoingRides,
    earningsData,
  ] = await Promise.all([
    User.countDocuments(),
    Driver.countDocuments(),
    Ride.countDocuments(),
    Ride.countDocuments({ status: RideStatus.COMPLETED }),
    Ride.countDocuments({
      status: { $in: [RideStatus.PICKED_UP, RideStatus.IN_TRANSIT] },
    }),
    Ride.aggregate([
      { $match: { status: RideStatus.COMPLETED } },
      { $group: { _id: null, total: { $sum: "$fare" } } },
    ]),
  ]);

  return {
    totalUsers,
    totalDrivers,
    totalRides,
    completedRides,
    ongoingRides,
    totalEarnings: earningsData[0]?.total || 0,
  };
};

export const AdminService = {
  approveDriver,
  suspendDriver,
  blockUser,
  unblockUser,
  getAllUsers,
  getAllDrivers,
  getAllRides,
  generateAdminReport,
};
