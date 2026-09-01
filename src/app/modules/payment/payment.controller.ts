/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";
import { PaymentStatus } from "./payment.interface";
import { envVars } from "../../config/env";

const initiate = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rider = req.user as JwtPayload;
    const userId = rider.userId;
    const { rideId } = req.body;

    const result = await PaymentService.initiate(userId, rideId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Payment session created successfully",
      data: result,
    });
  }
);

const handleIpn = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await PaymentService.handleIpn(req.body as Record<string, string>);
    res.status(200).send("OK");
  }
);

const handleSuccess = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await PaymentService.handleIpn(req.body as Record<string, string>);
    res.redirect(302, buildFrontendUrl(req.body));
  }
);

const handleFail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await PaymentService.handleCallbackStatus(
      req.body as Record<string, string>,
      PaymentStatus.FAILED
    );
    res.redirect(302, buildFrontendUrl(req.body));
  }
);

const handleCancel = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    await PaymentService.handleCallbackStatus(
      req.body as Record<string, string>,
      PaymentStatus.CANCELLED
    );
    res.redirect(302, buildFrontendUrl(req.body));
  }
);

const getRideStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rider = req.user as JwtPayload;
    const userId = rider.userId;
    const role = rider.role;
    const rideId = req.params.rideId;

    const result = await PaymentService.getRideStatus(rideId, userId, role);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Payment status fetched successfully",
      data: result,
    });
  }
);

const getMyPayments = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rider = req.user as JwtPayload;
    const userId = rider.userId;

    const result = await PaymentService.getMyPayments(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Payment history fetched successfully",
      data: result,
    });
  }
);

const buildFrontendUrl = (body: Record<string, string>): string => {
  const status = (body.status || "").toUpperCase();
  const tranId = body.tran_id || "";
  const rideId = body.value_a || "";

  let baseUrl = envVars.SSL_SUCCESS_FRONTEND_URL;
  if (status === "FAILED") {
    baseUrl = envVars.SSL_FAIL_FRONTEND_URL;
  } else if (status === "CANCELLED") {
    baseUrl = envVars.SSL_CANCEL_FRONTEND_URL;
  }

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (tranId) params.set("tranId", tranId);
  if (rideId) params.set("rideId", rideId);

  return `${baseUrl}?${params.toString()}`;
};

export const PaymentController = {
  initiate,
  handleIpn,
  handleSuccess,
  handleFail,
  handleCancel,
  getRideStatus,
  getMyPayments,
};
