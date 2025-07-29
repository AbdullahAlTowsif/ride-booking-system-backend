import { Schema, model, Types } from 'mongoose';
import { IRide, RideStatus } from './ride.interface';

const rideSchema = new Schema(
  {
    rider: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driver: {
      type: Types.ObjectId,
      ref: 'User',
      default: null, // driver will be assigned after accepting
    },
    pickupLocation: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    destinationLocation: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    status: {
      type: String,
      enum: Object.values(RideStatus),
      default: RideStatus.REQUESTED,
    },
    fare: {
      type: Number,
      default: 0,
    },
    timestamps: {
      requestedAt: { type: Date, default: Date.now },
      acceptedAt: { type: Date },
      pickedUpAt: { type: Date },
      inTransitAt: { type: Date },
      completedAt: { type: Date },
      cancelledAt: { type: Date },
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // creates createdAt and updatedAt
    versionKey: false
  }
);

export const Ride = model<IRide>('Ride', rideSchema);
