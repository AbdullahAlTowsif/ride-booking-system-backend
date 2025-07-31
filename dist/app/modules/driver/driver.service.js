"use strict";
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
exports.DriverService = void 0;
const driver_model_1 = require("./driver.model");
const driver_interface_1 = require("./driver.interface");
const AppError_1 = __importDefault(require("../../errorHelpers/AppError"));
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const ride_model_1 = require("../ride/ride.model");
const ride_interface_1 = require("../ride/ride.interface");
const applyToBeDriver = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isAlreadyDriver = yield driver_model_1.Driver.findOne({ user: userId });
    if (isAlreadyDriver) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "You have already applied or are already a driver.");
    }
    const newDriver = yield driver_model_1.Driver.create({
        user: userId,
        vehicleType: payload.vehicleType,
        vehicleNumber: payload.vehicleNumber,
        approvalStatus: driver_interface_1.IsApprove.PENDING,
        availabilityStatus: driver_interface_1.IsAvailable.ONLINE,
    });
    return newDriver;
});
const getAvailableRides = () => __awaiter(void 0, void 0, void 0, function* () {
    const availableRides = yield ride_model_1.Ride.find({
        driver: null,
        status: ride_interface_1.RideStatus.REQUESTED,
    }).sort({ createdAt: -1 });
    return availableRides;
});
const acceptRide = (rideId, driverUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const driver = yield driver_model_1.Driver.findOne({ user: driverUserId });
    if (!driver) {
        throw new AppError_1.default(http_status_codes_1.default.FORBIDDEN, "Driver profile not found");
    }
    if (driver.approvalStatus === driver_interface_1.IsApprove.SUSPENDED) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "You are a SUSPENDED Driver. You cann't accept Request");
    }
    const ride = yield ride_model_1.Ride.findById(rideId);
    if (!ride) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Ride not found");
    }
    if (ride.status !== ride_interface_1.RideStatus.REQUESTED) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Ride is not available for acceptance");
    }
    if (ride.driver) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Ride already assigned to a driver");
    }
    ride.driver = driver._id;
    ride.status = ride_interface_1.RideStatus.ACCEPTED;
    ride.timestamps.acceptedAt = new Date();
    yield ride.save();
    driver.availabilityStatus = driver_interface_1.IsAvailable.OFFLINE;
    yield driver.save();
    return ride;
});
const rejectRide = (rideId, driverUserId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const driver = yield driver_model_1.Driver.findOne({ user: driverUserId });
    if (!driver) {
        throw new AppError_1.default(http_status_codes_1.default.FORBIDDEN, "Driver profile not found");
    }
    const ride = yield ride_model_1.Ride.findById(rideId);
    if (!ride) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Ride not found");
    }
    if (ride.status === ride_interface_1.RideStatus.REJECTED ||
        ride.status === ride_interface_1.RideStatus.COMPLETED) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, `Ride cannot be rejected`);
    }
    if (((_a = ride.driver) === null || _a === void 0 ? void 0 : _a.toString()) !== driver._id.toString() &&
        ride.driver !== null) {
        throw new AppError_1.default(http_status_codes_1.default.FORBIDDEN, "You are not assigned to this ride");
    }
    ride.status = ride_interface_1.RideStatus.REJECTED;
    ride.driver = null;
    yield ride.save();
    driver.availabilityStatus = driver_interface_1.IsAvailable.ONLINE;
    yield driver.save();
    return ride;
});
const updateRideStatus = (rideId, driverUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const driver = yield driver_model_1.Driver.findOne({ user: driverUserId });
    if (!driver) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Driver profile not found");
    }
    const ride = yield ride_model_1.Ride.findById(rideId);
    if (!ride) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Ride not found");
    }
    if (!ride.driver || ride.driver.toString() !== driver._id.toString()) {
        throw new AppError_1.default(http_status_codes_1.default.FORBIDDEN, "You are not assigned to this ride");
    }
    let newStatus;
    if (ride.status === ride_interface_1.RideStatus.ACCEPTED) {
        newStatus = ride_interface_1.RideStatus.PICKED_UP;
        ride.timestamps.pickedUpAt = new Date();
    }
    else if (ride.status === ride_interface_1.RideStatus.PICKED_UP) {
        newStatus = ride_interface_1.RideStatus.IN_TRANSIT;
        ride.timestamps.inTransitAt = new Date();
    }
    else if (ride.status === ride_interface_1.RideStatus.IN_TRANSIT) {
        newStatus = ride_interface_1.RideStatus.COMPLETED;
        ride.timestamps.completedAt = new Date();
        driver.earnings += ride.fare;
        ride.isPaid = true;
    }
    else {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, `Invalid ride status transition from ${ride.status}`);
    }
    ride.status = newStatus;
    yield ride.save();
    if (newStatus === ride_interface_1.RideStatus.COMPLETED) {
        driver.availabilityStatus = driver_interface_1.IsAvailable.ONLINE;
        yield driver.save();
    }
    return ride;
});
const getRideHistory = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const driver = yield driver_model_1.Driver.findOne({ user: userId });
    if (!driver) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Driver not found");
    }
    const rides = yield ride_model_1.Ride.find({ driver: driver._id }).sort({ createdAt: -1 });
    const totalEarnings = driver.earnings;
    return {
        totalRides: rides.length,
        totalEarnings,
        rides,
    };
});
exports.DriverService = {
    applyToBeDriver,
    getAvailableRides,
    acceptRide,
    rejectRide,
    updateRideStatus,
    getRideHistory,
};
