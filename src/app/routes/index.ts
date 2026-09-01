import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { RideRoutes } from "../modules/ride/ride.route";
import { DriverRoutes } from "../modules/driver/driver.route";
import { AdminRoutes } from "../modules/admin/admin.route";
import { AlertRoutes } from "../modules/alert/alert.route";
import { SafetyContactRoutes } from "../modules/safetyContact/safetyContact.route";
import { PaymentRoutes } from "../modules/payment/payment.route";

export const router = Router();

const moduleRoutes = [
    {
        path: "/user",
        route: UserRoutes
    },
    {
        path: "/auth",
        route: AuthRoutes
    },
    {
        path: "/rides",
        route: RideRoutes
    },
    {
        path: "/driver",
        route: DriverRoutes
    },
    {
        path: "/admin",
        route: AdminRoutes
    },
    {
        path: "/alert",
        route: AlertRoutes
    },
    {
        path: "/safetyContact",
        route: SafetyContactRoutes
    },
    {
        path: "/payments",
        route: PaymentRoutes
    }
];

moduleRoutes.forEach((route) => {
    router.use(route.path, route.route);
})
