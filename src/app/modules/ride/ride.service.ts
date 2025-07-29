import { IRide, RideStatus } from './ride.interface';
import { Ride } from './ride.model';
import AppError from '../../errorHelpers/AppError';
import httpStatus from 'http-status-codes';
import { isValidObjectId } from 'mongoose';

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


const cancelRide = async (rideId: string, riderId: string) => {
  if (!isValidObjectId(rideId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid ride ID');
  }

  const ride = await Ride.findById(rideId);

  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, 'Ride not found');
  }

  if (ride.rider.toString() !== riderId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to cancel this ride');
  }

  if (
    ride.status !== RideStatus.REQUESTED &&
    ride.status !== RideStatus.ACCEPTED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel a ride at '${ride.status}' stage`
    );
  }

  ride.status = RideStatus.CANCELLED;
  ride.timestamps.cancelledAt = new Date();

  await ride.save();

  return ride;
};


const getMyRides = async (riderId: string) => {
  const rides = await Ride.find({ rider: riderId })
    .sort({ createdAt: -1 })
    .populate('driver', 'name email') // optional
    .lean();

  return rides;
};


const getSingleRide = async (rideId: string, riderId: string) => {
  if (!isValidObjectId(rideId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid ride ID');
  }

  const ride = await Ride.findById(rideId).populate('driver', 'name email');

  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, 'Ride not found');
  }

  if (ride.rider.toString() !== riderId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to view this ride');
  }

  return ride;
};

export const RideService = {
  createRide,
  cancelRide,
  getMyRides,
  getSingleRide,
};
