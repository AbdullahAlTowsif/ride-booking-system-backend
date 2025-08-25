import httpStatus from "http-status-codes";
import { SafetyContactService } from "./safetyContact.service";
import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const getContacts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  
  if (!user) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Authentication required",
      data: null,
    });
  }

  const { userId: riderId } = user as JwtPayload;
//   console.log("Fetching contacts for riderId:", riderId);
  
  const result = await SafetyContactService.getContacts(riderId);
//   console.log("Service result:", result);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Safety contacts fetched successfully",
    data: result,
  });
});

const saveContacts = catchAsync(async (req: Request, res: Response) => {
  const rider = req.user;
//   console.log("rider", rider);
  const { userId: riderId } = rider as JwtPayload;

  const contacts = req.body;
//   console.log(contacts);
  const result = await SafetyContactService.saveContacts( riderId, contacts);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Safety contacts saved successfully",
    data: result,
  });
});

export const SafetyContactController = {
  getContacts,
  saveContacts,
};
