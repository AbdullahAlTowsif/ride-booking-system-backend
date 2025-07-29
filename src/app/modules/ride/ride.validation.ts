import { z } from "zod";

export const createRideZodSchema = z.object({
  pickupLocation: z.object({
    address: z.string({ message: "Pickup address is required" }),
    coordinates: z.object({
      lat: z.number({ message: "Pickup latitude is required" }),
      lng: z.number({ message: "Pickup longitude is required" }),
    }),
  }),
  destinationLocation: z.object({
    address: z.string({ message: "Destination address is required" }),
    coordinates: z.object({
      lat: z.number({ message: "Destination latitude is required" }),
      lng: z.number({ message: "Destination longitude is required" }),
    }),
  }),
});
