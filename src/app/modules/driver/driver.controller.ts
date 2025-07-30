/* eslint-disable @typescript-eslint/no-unused-vars */

import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { DriverService } from "./driver.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";

const applyToBeDriver = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  const {userId} = user as JwtPayload;

  const driver = await DriverService.applyToBeDriver(userId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: "Driver application submitted successfully.",
    data: driver,
  });
});

const getAvailableRides = catchAsync(async (req: Request, res: Response) => {
  const rides = await DriverService.getAvailableRides();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Available ride requests retrieved successfully",
    data: rides,
  });
});


const acceptRide = catchAsync(async (req: Request, res: Response) => {
  const rideId = req.params.id;
  const user = req.user;

  const {userId} = user as JwtPayload;

  const result = await DriverService.acceptRide(rideId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ride accepted successfully",
    data: result,
  });
});


export const rejectRide = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  const {userId} = user as JwtPayload;

  const result = await DriverService.rejectRide(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ride request rejected successfully",
    data: result,
  });
});


export const updateRideStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  const {userId} = user as JwtPayload;

  const result = await DriverService.updateRideStatus(id, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ride status updated successfully",
    data: result,
  });
});


export const DriverController = {
  applyToBeDriver,
  getAvailableRides,
  acceptRide,
  rejectRide,
  updateRideStatus,
};
