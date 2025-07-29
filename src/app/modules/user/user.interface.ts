import { Types } from "mongoose"

export enum Role {
    ADMIN = "ADMIN",
    RIDER = "RIDER",
    DRIVER = "DRIVER"
}

export interface IAuthProvider {
    provider: "google" | "credentials",
    providerId: string
}

export enum IsApprove {
    APPROVED = "APPROVED",
    SUSPENDED = "SUSPENDED",
    BLOCKED = "BLOCKED"
}

export interface IUser {
    _id?: Types.ObjectId
    name: string;
    email: string;
    password?: string;
    phone?: string;
    picture?: string;
    address?: string;
    isDeleted?: string;
    isApprove?: IsApprove;
    isVerified?: boolean;
    role: Role;
    auths: IAuthProvider[];
    rides?: Types.ObjectId[];
    createdAt?: Date
}