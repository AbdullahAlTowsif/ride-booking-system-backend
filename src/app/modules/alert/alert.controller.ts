import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AlertService } from "./alert.service";
import { StatusCodes } from "http-status-codes";

const createAlert = catchAsync(async (req, res) => {
  const result = await AlertService.sendAlerts(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Alerts sent successfully",
    data: result,
  });
});

export const AlertController = {
  createAlert,
};
