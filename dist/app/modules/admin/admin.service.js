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
exports.AdminService = exports.generateAdminReport = void 0;
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const AppError_1 = __importDefault(require("../../errorHelpers/AppError"));
const driver_model_1 = require("../driver/driver.model");
const driver_interface_1 = require("../driver/driver.interface");
const user_model_1 = require("../user/user.model");
const user_interface_1 = require("../user/user.interface");
const ride_model_1 = require("../ride/ride.model");
const ride_interface_1 = require("../ride/ride.interface");
const QueryBuilder_1 = require("../../utils/QueryBuilder");
const admin_constant_1 = require("./admin.constant");
const approveDriver = (driverId) => __awaiter(void 0, void 0, void 0, function* () {
    const existingDriver = yield driver_model_1.Driver.findById(driverId);
    if (!existingDriver) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Driver not found");
    }
    if (existingDriver.approvalStatus === driver_interface_1.IsApprove.APPROVED) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Driver is already approved");
    }
    existingDriver.approvalStatus = driver_interface_1.IsApprove.APPROVED;
    yield existingDriver.save();
    yield user_model_1.User.findByIdAndUpdate(existingDriver.user, { role: user_interface_1.Role.DRIVER });
    return existingDriver;
});
const suspendDriver = (driverId) => __awaiter(void 0, void 0, void 0, function* () {
    const existingDriver = yield driver_model_1.Driver.findById(driverId);
    if (!existingDriver) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Driver not found");
    }
    if (existingDriver.approvalStatus === driver_interface_1.IsApprove.SUSPENDED) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Driver is already suspended");
    }
    existingDriver.approvalStatus = driver_interface_1.IsApprove.SUSPENDED;
    yield existingDriver.save();
    // Revert user role back to RIDER
    yield user_model_1.User.findByIdAndUpdate(existingDriver.user, { role: user_interface_1.Role.RIDER });
    return existingDriver;
});
const blockUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const existingUser = yield user_model_1.User.findById(userId);
    if (!existingUser) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "User not found");
    }
    if (existingUser.isBlock === user_interface_1.IsBlock.BLOCK) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "User is already blocked");
    }
    existingUser.isBlock = user_interface_1.IsBlock.BLOCK;
    yield existingUser.save();
    return existingUser;
});
const unblockUser = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const existingUser = yield user_model_1.User.findById(userId);
    if (!existingUser) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "User not found");
    }
    if (existingUser.isBlock === user_interface_1.IsBlock.UNBLOCK) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "User is already unblocked");
    }
    existingUser.isBlock = user_interface_1.IsBlock.UNBLOCK;
    yield existingUser.save();
    return existingUser;
});
const getAllUsers = (query) => __awaiter(void 0, void 0, void 0, function* () {
    // return await User.find().select("-password");
    const queryBuilder = new QueryBuilder_1.QueryBuilder(user_model_1.User.find(), query);
    const users = yield queryBuilder.search(admin_constant_1.userSearchableFields).filter().sort().fields().paginate();
    const [data, meta] = yield Promise.all([
        users.build(),
        queryBuilder.getMeta()
    ]);
    return {
        data, meta
    };
});
const getAllDrivers = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield driver_model_1.Driver.find().populate("user", "-password");
});
const getAllRides = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const queryBuilder = new QueryBuilder_1.QueryBuilder(ride_model_1.Ride.find(), query);
    const rides = yield queryBuilder.search(admin_constant_1.ridesSearchableFields).filter().sort().fields().paginate();
    const [data, meta] = yield Promise.all([
        rides.build(),
        queryBuilder.getMeta()
    ]);
    return {
        data, meta
    };
});
// const getAllRides = async () => {
//   return await Ride.find().populate("rider", "-password").populate("driver")
// };
const generateAdminReport = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const [totalUsers, totalDrivers, totalRides, completedRides, ongoingRides, earningsData,] = yield Promise.all([
        user_model_1.User.countDocuments(),
        driver_model_1.Driver.countDocuments(),
        ride_model_1.Ride.countDocuments(),
        ride_model_1.Ride.countDocuments({ status: ride_interface_1.RideStatus.COMPLETED }),
        ride_model_1.Ride.countDocuments({
            status: { $in: [ride_interface_1.RideStatus.PICKED_UP, ride_interface_1.RideStatus.IN_TRANSIT] },
        }),
        ride_model_1.Ride.aggregate([
            { $match: { status: ride_interface_1.RideStatus.COMPLETED } },
            { $group: { _id: null, total: { $sum: "$fare" } } },
        ]),
    ]);
    return {
        totalUsers,
        totalDrivers,
        totalRides,
        completedRides,
        ongoingRides,
        totalEarnings: ((_a = earningsData[0]) === null || _a === void 0 ? void 0 : _a.total) || 0,
    };
});
exports.generateAdminReport = generateAdminReport;
exports.AdminService = {
    approveDriver,
    suspendDriver,
    blockUser,
    unblockUser,
    getAllUsers,
    getAllDrivers,
    getAllRides,
    generateAdminReport: exports.generateAdminReport,
};
