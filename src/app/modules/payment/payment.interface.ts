import { Types } from "mongoose";

export enum PaymentStatus {
  INITIATED = "INITIATED",
  PENDING = "PENDING",
  VALID = "VALID",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  REFUNDED = "REFUNDED",
}

export interface IPayment {
  _id?: Types.ObjectId;
  rider: Types.ObjectId;
  ride: Types.ObjectId;
  driver?: Types.ObjectId | null;
  amount: number;
  currency: "BDT";
  tranId: string;
  valId?: string;
  status: PaymentStatus;
  paidAt?: Date;
  ipnReceivedAt?: Date;
  verifiedAt?: Date;
  raw: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}
