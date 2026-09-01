import httpStatus from "http-status-codes";
import { isValidObjectId, Types } from "mongoose";
import AppError from "../../errorHelpers/AppError";
import { Payment } from "./payment.model";
import { PaymentStatus } from "./payment.interface";
import { Ride } from "../ride/ride.model";
import { RideStatus } from "../ride/ride.interface";
import { User } from "../user/user.model";
import { Driver } from "../driver/driver.model";
import { Role } from "../user/user.interface";
import {
  initiateSession,
  verifyTransaction,
  verifySignature,
} from "../../utils/sslcommerz";
import { envVars } from "../../config/env";
import {
  ACTIVE_PAYMENT_STATUSES,
  PAYMENT_AMOUNT_TOLERANCE,
} from "./payment.constant";

const generateTranId = (rideId: string): string => {
  const uniqueId = `RIDE${rideId}${Date.now()}`;
  return uniqueId.slice(0, 30);
};

const refineCusPayload = async (
  riderId: string
): Promise<Record<string, string>> => {
  const rider = await User.findById(riderId);

  const address = rider?.address || "Dhaka";
  const city = "Dhaka";
  const postcode = "1200";
  const country = "Bangladesh";

  return {
    cus_name: rider?.name || "Rider",
    cus_email: rider?.email || "",
    cus_phone: rider?.phone || "01700000000",
    cus_add1: address,
    cus_add2: address,
    cus_city: city,
    cus_state: city,
    cus_postcode: postcode,
    cus_country: country,
    cus_fax: "01600000000",
    ship_name: rider?.name || "Rider",
    ship_add1: address,
    ship_add2: address,
    ship_city: city,
    ship_state: city,
    ship_postcode: postcode,
    ship_country: country,
  };
};

const initiate = async (riderId: string, rideId: string) => {
  if (!riderId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized access");
  }

  if (!isValidObjectId(rideId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ride ID");
  }

  const ride = await Ride.findById(rideId);

  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, "Ride not found");
  }

  if (ride.rider.toString() !== riderId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to pay for this ride"
    );
  }

  if (ride.status !== RideStatus.COMPLETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment can only be initiated for a completed ride"
    );
  }

  if (ride.isPaid) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ride is already paid");
  }

  const existingActive = await Payment.findOne({
    ride: ride._id,
    status: { $in: ACTIVE_PAYMENT_STATUSES },
  });

  if (existingActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A payment is already in progress or completed for this ride"
    );
  }

  const cusPayload = await refineCusPayload(riderId);
  const tranId = generateTranId(ride._id.toString());

  const session = await initiateSession({
    total_amount: String(ride.fare),
    tran_id: tranId,
    success_url: envVars.SSL_SUCCESS_BACKEND_URL,
    fail_url: envVars.SSL_FAIL_BACKEND_URL,
    cancel_url: envVars.SSL_CANCEL_BACKEND_URL,
    ipn_url: envVars.SSL_IPN_URL,
    product_name: "Ride Booking",
    product_category: "Ride",
    product_profile: "general",
    value_a: ride._id.toString(),
    ...cusPayload,
  });
  // console.log(session);

  if (session.status !== "SUCCESS") {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      session.status_message || "Failed to create payment session"
    );
  }

  const payment = await Payment.create({
    rider: riderId,
    ride: ride._id,
    driver: ride.driver || null,
    amount: ride.fare,
    currency: "BDT",
    tranId,
    status: PaymentStatus.INITIATED,
    raw: session,
  });

  return {
    gatewayUrl: session.GatewayPageURL,
    tranId,
    paymentId: payment._id,
  };
};

const markValidAndSettle = async (payment: {
  _id: string | Types.ObjectId;
  ride: string | Types.ObjectId;
  valId?: string;
}) => {
  if (!isValidObjectId(payment._id)) {
    return;
  }

  const updated = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
    },
    {
      $set: {
        status: PaymentStatus.VALID,
        valId: payment.valId,
        paidAt: new Date(),
        verifiedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updated) {
    return;
  }

  const ride = await Ride.findById(payment.ride);

  if (!ride || ride.isPaid) {
    return;
  }

  ride.isPaid = true;
  ride.timestamps.completedAt = ride.timestamps.completedAt || new Date();
  await ride.save();

  if (ride.driver) {
    await Driver.findByIdAndUpdate(ride.driver, {
      $inc: { earnings: ride.fare },
    });
  }
};

const handleIpn = async (body: Record<string, string>) => {
  const tranId = body.tran_id;
  const valId = body.val_id;

  const signatureValid = verifySignature(
    body,
    body.verify_key,
    body.verify_sign
  );

  if (!tranId) {
    return;
  }

  const payment = await Payment.findOne({ tranId });

  if (!payment) {
    return;
  }

  if (payment.status === PaymentStatus.VALID) {
    return;
  }

  payment.raw = { ...payment.raw, ipn: body };
  payment.ipnReceivedAt = new Date();
  payment.status = PaymentStatus.PENDING;
  await payment.save();

  if (!signatureValid) {
    return;
  }

  if (!valId) {
    return;
  }

  const validation = await verifyTransaction(valId);

  const verified =
    (validation.status === "VALID" || validation.status === "VALIDATED") &&
    validation.tran_id === tranId &&
    Math.abs(
      parseFloat(validation.currency_amount || validation.amount || "0") -
        payment.amount
    ) < PAYMENT_AMOUNT_TOLERANCE;

  if (!verified) {
    payment.raw = { ...payment.raw, validation };
    payment.status = PaymentStatus.FAILED;
    await payment.save();
    return;
  }

  payment.valId = valId;
  payment.raw = { ...payment.raw, validation };
  await payment.save();

  await markValidAndSettle({ _id: payment._id, ride: payment.ride, valId });
};

const handleCallbackStatus = async (
  body: Record<string, string>,
  outcome: PaymentStatus
) => {
  const tranId = body.tran_id;

  if (!tranId) {
    return;
  }

  const payment = await Payment.findOne({ tranId });

  if (!payment) {
    return;
  }

  if (payment.status === PaymentStatus.VALID) {
    return;
  }

  payment.status = outcome;
  payment.ipnReceivedAt = payment.ipnReceivedAt || new Date();
  payment.raw = { ...payment.raw, callback: body };
  await payment.save();
};

const getRideStatus = async (
  rideId: string,
  userId: string,
  role?: string
) => {
  if (!isValidObjectId(rideId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ride ID");
  }

  const ride = await Ride.findById(rideId);

  if (!ride) {
    throw new AppError(httpStatus.NOT_FOUND, "Ride not found");
  }

  if (role !== Role.ADMIN && ride.rider.toString() !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to view this payment"
    );
  }

  const payment = await Payment.findOne({ ride: rideId }).sort({
    createdAt: -1,
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "No payment found for this ride");
  }

  return {
    status: payment.status,
    amount: payment.amount,
    tranId: payment.tranId,
    paidAt: payment.paidAt,
  };
};

const getMyPayments = async (userId: string) => {
  const payments = await Payment.find({ rider: userId }).sort({
    createdAt: -1,
  });

  return payments;
};

export const PaymentService = {
  initiate,
  handleIpn,
  handleCallbackStatus,
  getRideStatus,
  getMyPayments,
};
