/* eslint-disable no-console */
import { envVars } from "../config/env";
import { IAuthProvider, Role } from "../modules/user/user.interface";
import { User } from "../modules/user/user.model";
import bcryptjs from "bcryptjs";

export const seedAdmin = async () => {
    try {
        const isSuperAdminExist = await User.findOne({email: envVars.ADMIN_EMAIL})
        if(isSuperAdminExist) {
            console.log("Admin Already Exists!");
            return;
        }

        console.log("Trying to create admin...");

        const hashedPassword = await bcryptjs.hash(envVars.ADMIN_PASSWORD, Number(envVars.BCRYPT_SALT_ROUND));
        
        const authProvider: IAuthProvider = {
            provider: "credentials",
            providerId: envVars.ADMIN_EMAIL
        }

        const payload = {
            name: "Admin",
            role: Role.ADMIN,
            email: envVars.ADMIN_EMAIL,
            password: hashedPassword,
            isVerified: true,
            auths: [authProvider]
        }

        const superadmin = await User.create(payload)
        console.log("Admin created Successfully! \n");
        console.log(superadmin);

    } catch (error) {
        console.log(error);
    }
}
