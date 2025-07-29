/* eslint-disable @typescript-eslint/no-explicit-any */

import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import { envVars } from "./env";
import { User } from "../modules/user/user.model";
import { Strategy as LocalStrategy } from "passport-local";
import bcryptjs from "bcryptjs";
import { IsApprove, Role } from "../modules/user/user.interface";

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email: string, password: string, done) => {
      try {
        const isUserExist = await User.findOne({ email });

        if (!isUserExist) {
          return done("User doesn't Exists");
        }

        if (!isUserExist.isVerified) {
          return done("User is not Verified");
        }

        if (
          isUserExist.isApprove === IsApprove.BLOCKED ||
          isUserExist.isApprove === IsApprove.SUSPENDED
        ) {

          return done(`User is ${isUserExist.isApprove}`);
        }

        if (isUserExist.isDeleted) {
          return done("User is Deleted");
        }

        const isGoogleAuthenticated = isUserExist.auths.some(
          (providerObjects) => providerObjects.provider == "google"
        );

        if (isGoogleAuthenticated && !isUserExist.password) {
          return done(null, false, {
            message:
              "You have authenticated via Google. If you want to login with credentials, then at first login with goolge and set a password for your Gmail and then you can login with email and password",
          });
        }

        const isPasswordMatched = await bcryptjs.compare(
          password as string,
          isUserExist.password as string
        );

        if (!isPasswordMatched) {
          return done(null, false, { message: "Password doesn't Match" });
        }

        return done(null, isUserExist);
      } catch (error) {
        console.log("LocalStrategy Error", error);
        done(error);
      }
    }
  )
);

passport.use(
  new GoogleStrategy(
    {
      clientID: envVars.GOOGLE_CLIENT_ID,
      clientSecret: envVars.GOOGLE_CLIENT_SECRET,
      callbackURL: envVars.GOOGLE_CALLBACK_URL,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(null, false, { message: "No email found" });
        }

        let isUserExist = await User.findOne({ email });

        if (isUserExist && !isUserExist.isVerified) {
          // throw new AppError(httpStatus.BAD_REQUEST, "User is not Verified");
          // done("User is not Verified");
          return done(null, false, {message: "User is not Verified"})
        }

        if (
          isUserExist &&
          (isUserExist.isApprove === IsApprove.BLOCKED || isUserExist.isApprove === IsApprove.SUSPENDED)
        ) {
          done(`User is ${isUserExist.isApprove}`);
        }

        if (isUserExist && isUserExist.isDeleted) {
          return done(null, false, {message: "User is deleted"});
        }

        if (!isUserExist) {
          isUserExist = await User.create({
            email,
            name: profile.displayName,
            picture: profile.photos?.[0].value,
            role: Role.USER,
            isVerified: true,
            auths: [
              {
                provider: "google",
                providerId: profile.id,
              },
            ],
          });
        }
        return done(null, isUserExist);
      } catch (error) {
        console.log("Google Strategy Error", error);
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done: any) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    // console.log(error);
    done(error);
  }
});