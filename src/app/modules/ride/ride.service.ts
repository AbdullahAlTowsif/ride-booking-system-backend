import { IRide, RideStatus } from './ride.interface';
import { Ride } from './ride.model';
import AppError from '../../errorHelpers/AppError';
import httpStatus from 'http-status-codes';

const createRide = async (
  riderId: string,
  payload: Pick<IRide, 'pickupLocation' | 'destinationLocation'>
) => {
  if (!riderId) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized access');
  }

  const existingRide = await Ride.findOne({
    rider: riderId,
    status: {
      $in: [
        RideStatus.REQUESTED,
        RideStatus.ACCEPTED,
        RideStatus.PICKED_UP,
        RideStatus.IN_TRANSIT,
      ],
    },
  });

  if (existingRide) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You already have an active ride in progress'
    );
  }

  const ride = await Ride.create({
    rider: riderId,
    pickupLocation: payload.pickupLocation,
    destinationLocation: payload.destinationLocation,
    status: RideStatus.REQUESTED,
    fare: 0,
    isPaid: false,
    timestamps: {
      requestedAt: new Date(),
    },
  });

  return ride;
};

export const RideService = {
  createRide,
};
