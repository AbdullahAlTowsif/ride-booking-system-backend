/* eslint-disable @typescript-eslint/no-unused-vars */

import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { DriverService } from "./driver.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errorHelpers/AppError";
import { IsAvailable } from "./driver.interface";

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

const getMyRides = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;
  // console.log("decodedToken", decodedToken);
  const userDriver = await DriverService.getMeDriver(decodedToken.userId);
  // console.log("userDriver", userDriver);
  // console.log(userDriver.data?._id);
  const driverObjectId = userDriver?.data?._id;
  const driverId = driverObjectId?.toString();
  // console.log(driverId);

  if(!driverId) {
    throw new AppError(httpStatus.NOT_FOUND, "No Driver Id Found");
  }
  const rides = await DriverService.getMyRides(driverId);

  // const rides = await DriverService.getMyRides();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My current rides retrieved successfully",
    data: rides,
  });
});


const updateAvailability = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { userId } = user as JwtPayload;
  const { availabilityStatus } = req.body;

  const driver = await DriverService.updateAvailability(userId, availabilityStatus);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Driver availability updated successfully",
    data: driver,
  });
});


const getMeDriver = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    // console.log(decodedToken);
    const result = await DriverService.getMeDriver(decodedToken.userId);
    // console.log(result);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Your Profile Retrieved Successfully",
        data: result.data
    })
})

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


const getRideHistory = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;

  const {userId} = user as JwtPayload;

  const result = await DriverService.getRideHistory(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ride history retrieved successfully",
    data: result,
  });
});



export const DriverController = {
  applyToBeDriver,
  getAvailableRides,
  acceptRide,
  rejectRide,
  updateRideStatus,
  getRideHistory,
  updateAvailability,
  getMeDriver,
  getMyRides,
};
