import { Schema, model } from "mongoose";
import { IPayment, PaymentStatus } from "./payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    rider: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ride: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["BDT"],
      default: "BDT",
    },
    tranId: {
      type: String,
      required: true,
      unique: true,
    },
    valId: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.INITIATED,
    },
    paidAt: {
      type: Date,
    },
    ipnReceivedAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    raw: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ ride: 1 });
paymentSchema.index({ ride: 1, status: 1 });

export const Payment = model<IPayment>("Payment", paymentSchema);
