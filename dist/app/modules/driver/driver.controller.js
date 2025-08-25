"use strict";
/* eslint-disable @typescript-eslint/no-unused-vars */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverController = exports.updateRideStatus = exports.rejectRide = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const driver_service_1 = require("./driver.service");
const sendResponse_1 = require("../../utils/sendResponse");
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const AppError_1 = __importDefault(require("../../errorHelpers/AppError"));
const applyToBeDriver = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { userId } = user;
    const driver = yield driver_service_1.DriverService.applyToBeDriver(userId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        success: true,
        statusCode: http_status_codes_1.default.CREATED,
        message: "Driver application submitted successfully.",
        data: driver,
    });
}));
const getAvailableRides = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const rides = yield driver_service_1.DriverService.getAvailableRides();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Available ride requests retrieved successfully",
        data: rides,
    });
}));
const getMyRides = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const decodedToken = req.user;
    // console.log("decodedToken", decodedToken);
    const userDriver = yield driver_service_1.DriverService.getMeDriver(decodedToken.userId);
    // console.log("userDriver", userDriver);
    // console.log(userDriver.data?._id);
    const driverObjectId = (_a = userDriver === null || userDriver === void 0 ? void 0 : userDriver.data) === null || _a === void 0 ? void 0 : _a._id;
    const driverId = driverObjectId === null || driverObjectId === void 0 ? void 0 : driverObjectId.toString();
    // console.log(driverId);
    if (!driverId) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "No Driver Id Found");
    }
    const rides = yield driver_service_1.DriverService.getMyRides(driverId);
    // const rides = await DriverService.getMyRides();
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "My current rides retrieved successfully",
        data: rides,
    });
}));
const updateAvailability = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { userId } = user;
    const { availabilityStatus } = req.body;
    const driver = yield driver_service_1.DriverService.updateAvailability(userId, availabilityStatus);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Driver availability updated successfully",
        data: driver,
    });
}));
const getMeDriver = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const decodedToken = req.user;
    // console.log(decodedToken);
    const result = yield driver_service_1.DriverService.getMeDriver(decodedToken.userId);
    // console.log(result);
    (0, sendResponse_1.sendResponse)(res, {
        success: true,
        statusCode: http_status_codes_1.default.OK,
        message: "Your Profile Retrieved Successfully",
        data: result.data
    });
}));
const acceptRide = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const rideId = req.params.id;
    const user = req.user;
    const { userId } = user;
    const result = yield driver_service_1.DriverService.acceptRide(rideId, userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Ride accepted successfully",
        data: result,
    });
}));
exports.rejectRide = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = req.user;
    const { userId } = user;
    const result = yield driver_service_1.DriverService.rejectRide(id, userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Ride request rejected successfully",
        data: result,
    });
}));
exports.updateRideStatus = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const user = req.user;
    const { userId } = user;
    const result = yield driver_service_1.DriverService.updateRideStatus(id, userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Ride status updated successfully",
        data: result,
    });
}));
const getRideHistory = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { userId } = user;
    const result = yield driver_service_1.DriverService.getRideHistory(userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Ride history retrieved successfully",
        data: result,
    });
}));
const getDriverProfile = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { userId } = user;
    const result = yield driver_service_1.DriverService.getDriverProfile(userId);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Driver profile fetched successfully",
        data: result,
    });
}));
const updateDriverProfile = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { userId } = user;
    const result = yield driver_service_1.DriverService.updateDriverProfile(userId, req.body);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Driver profile updated successfully",
        data: result,
    });
}));
exports.DriverController = {
    applyToBeDriver,
    getAvailableRides,
    acceptRide,
    rejectRide: exports.rejectRide,
    updateRideStatus: exports.updateRideStatus,
    getRideHistory,
    updateAvailability,
    getMeDriver,
    getMyRides,
    getDriverProfile,
    updateDriverProfile,
};
