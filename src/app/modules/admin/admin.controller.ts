/* eslint-disable @typescript-eslint/no-unused-vars */

import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";
import { JwtPayload } from "jsonwebtoken";

const approveDriver = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const driverId = req.params.id;
  const result = await AdminService.approveDriver(driverId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Driver approved successfully!",
    data: result,
  });
});

const suspendDriver = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const driverId = req.params.id;
  const result = await AdminService.suspendDriver(driverId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Driver suspended successfully!",
    data: result,
  });
});

const blockUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;

  const result = await AdminService.blockUser(userId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User Blocked successfully!",
    data: result,
  });
});

const unblockUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;

  const result = await AdminService.unblockUser(userId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User Unblocked successfully!",
    data: result,
  });
});

export const AdminController = {
  approveDriver,
  suspendDriver,
  blockUser,
  unblockUser,
};
