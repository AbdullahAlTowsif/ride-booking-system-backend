import { Request, Response, NextFunction } from 'express';
import { RideService } from './ride.service';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import httpStatus from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createRide = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

  const rider = req.user;
  const { userId } = rider as JwtPayload;
//   console.log(rider);
  const rideData = req.body;

  const result = await RideService.createRide(userId, rideData);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: 'Ride requested successfully!',
    data: result,
  });
});

export const RideController = {
  createRide,
};
