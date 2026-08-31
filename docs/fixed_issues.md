# Fixed Issues — Implementation Plan

**Project**: Ride Booking System Backend
**Date**: 2026-08-31
**Status**: Planned (10 critical bugs to fix)

---

## Phase 1 — Quick One-Liners

### Fix #1: Missing `return` in Google OAuth blocked-user handler
- **File**: `src/app/config/passport.ts:102`
- **Before**:
  ```ts
  if (isUserExist && (isUserExist.isBlock === IsBlock.BLOCK)) {
    done(`User is Blocked`);
  }
  ```
- **After**:
  ```ts
  if (isUserExist && (isUserExist.isBlock === IsBlock.BLOCK)) {
    return done(`User is Blocked`);
  }
  ```
- **Why**: Without `return`, execution falls through to the user-creation block. A blocked user could be re-created or silently passed to `done(null, isUserExist)`.

---

### Fix #2: Missing `await` on `user.save()` in `changePassword`
- **File**: `src/app/modules/auth/auth.service.ts:76`
- **Before**:
  ```ts
  user!.save();
  ```
- **After**:
  ```ts
  await user!.save();
  ```
- **Why**: The password change is not guaranteed to persist before the response is sent.

---

### Fix #3: Null pointer risk in `changePassword`
- **File**: `src/app/modules/auth/auth.service.ts:62–76`
- **Before**:
  ```ts
  const user = await User.findById(decodedToken.userId);

  const isOldPasswordMatch = await bcryptjs.compare(
    oldPassword,
    user!.password as string
  );
  if (!isOldPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Old Password does not match");
  }

  user!.password = await bcryptjs.hash(
    newPassword,
    Number(envVars.BCRYPT_SALT_ROUND)
  );
  user!.save();
  ```
- **After**:
  ```ts
  const user = await User.findById(decodedToken.userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
  }

  const isOldPasswordMatch = await bcryptjs.compare(
    oldPassword,
    user.password as string
  );
  if (!isOldPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Old Password does not match");
  }

  user.password = await bcryptjs.hash(
    newPassword,
    Number(envVars.BCRYPT_SALT_ROUND)
  );
  await user.save();
  ```
- **Why**: If `User.findById` returns `null`, the non-null assertion `user!` crashes at runtime with a TypeError. Also removes the `/* eslint-disable @typescript-eslint/no-non-null-assertion */` at the top of the file.

---

### Fix #4: Validation middleware runs after controller on `apply-driver`
- **File**: `src/app/modules/driver/driver.route.ts:10`
- **Before**:
  ```ts
  router.post("/apply-driver", checkAuth(Role.RIDER), DriverController.applyToBeDriver, validateRequest(createDriverZodSchema));
  ```
- **After**:
  ```ts
  router.post("/apply-driver", checkAuth(Role.RIDER), validateRequest(createDriverZodSchema), DriverController.applyToBeDriver);
  ```
- **Why**: `validateRequest` was the third middleware — the controller already ran. Moving it before the controller ensures invalid data never reaches business logic.

---

### Fix #5: Race condition in ride acceptance
- **File**: `src/app/modules/driver/driver.service.ts:49–92`
- **Before**:
  ```ts
  const acceptRide = async (rideId: string, driverUserId: string) => {
    const driver = await Driver.findOne({ user: driverUserId });

    if (!driver) {
      throw new AppError(httpStatus.FORBIDDEN, "Driver profile not found");
    }

    if (driver.approvalStatus === IsApprove.SUSPENDED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are a SUSPENDED Driver. You cann't accept Request"
      );
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      throw new AppError(httpStatus.NOT_FOUND, "Ride not found");
    }

    if (ride.status !== RideStatus.REQUESTED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Ride is not available for acceptance"
      );
    }

    if (ride.driver) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Ride already assigned to a driver"
      );
    }

    ride.driver = driver._id;
    ride.status = RideStatus.ACCEPTED;
    ride.timestamps.acceptedAt = new Date();
    await ride.save();

    driver.availabilityStatus = IsAvailable.OFFLINE;
    await driver.save();

    return ride;
  };
  ```
- **After**:
  ```ts
  const acceptRide = async (rideId: string, driverUserId: string) => {
    const driver = await Driver.findOne({ user: driverUserId });

    if (!driver) {
      throw new AppError(httpStatus.FORBIDDEN, "Driver profile not found");
    }

    if (driver.approvalStatus === IsApprove.SUSPENDED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are a SUSPENDED Driver. You cannot accept Request"
      );
    }

    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, status: RideStatus.REQUESTED, driver: null },
      {
        $set: {
          driver: driver._id,
          status: RideStatus.ACCEPTED,
          "timestamps.acceptedAt": new Date(),
        },
      },
      { new: true }
    );

    if (!ride) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Ride is not available for acceptance"
      );
    }

    driver.availabilityStatus = IsAvailable.OFFLINE;
    await driver.save();

    return ride;
  };
  ```
- **Why**: `Ride.findById` + `ride.save()` is not atomic. Two drivers can accept the same ride simultaneously. `findOneAndUpdate` with status + null-driver filter is atomic at the MongoDB level.
- **Tradeoff**: We lose granular "already assigned" vs "wrong status" error messages, but gain data integrity. The single error message is sufficient.

---

### Fix #6: `getMeta()` counts unfiltered documents
- **File**: `src/app/utils/QueryBuilder.ts`
- **Before**:
  ```ts
  export class QueryBuilder<T> {
      public modelQuery: Query<T[], T>;
      public readonly query: Record<string, string>

      constructor(modelQuery: Query<T[], T>, query: Record<string, string>) {
          this.modelQuery = modelQuery;
          this.query = query;
      }

      filter(): this {
          const filter = { ...this.query }

          for (const field of excludeField) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete filter[field]
          }

          this.modelQuery = this.modelQuery.find(filter)

          return this;
      }

      search(searchableField: string[]): this {
          const searchTerm = this.query.searchTerm || ""
          const searchQuery = {
              $or: searchableField.map(field => ({ [field]: { $regex: searchTerm, $options: "i" } }))
          }
          this.modelQuery = this.modelQuery.find(searchQuery)
          return this
      }

      // ... sort, fields, paginate unchanged ...

      async getMeta() {
          const totalDocuments = await this.modelQuery.model.countDocuments()

          const page = Number(this.query.page) || 1
          const limit = Number(this.query.limit) || 10

          const totalPage = Math.ceil(totalDocuments / limit)

          return { page, limit, total: totalDocuments, totalPage }
      }
  }
  ```
- **After**:
  ```ts
  export class QueryBuilder<T> {
      public modelQuery: Query<T[], T>;
      public readonly query: Record<string, string>
      private _filterConditions: Record<string, unknown> = {};

      constructor(modelQuery: Query<T[], T>, query: Record<string, string>) {
          this.modelQuery = modelQuery;
          this.query = query;
      }

      filter(): this {
          const filter = { ...this.query }

          for (const field of excludeField) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete filter[field]
          }

          this._filterConditions = { ...filter };
          this.modelQuery = this.modelQuery.find(filter)

          return this;
      }

      search(searchableField: string[]): this {
          const searchTerm = this.query.searchTerm || ""
          const searchQuery = {
              $or: searchableField.map(field => ({ [field]: { $regex: searchTerm, $options: "i" } }))
          }
          this._filterConditions = { ...this._filterConditions, ...searchQuery };
          this.modelQuery = this.modelQuery.find(searchQuery)
          return this
      }

      // ... sort, fields, paginate unchanged ...

      async getMeta() {
          const totalDocuments = await this.modelQuery.model.countDocuments(this._filterConditions)

          const page = Number(this.query.page) || 1
          const limit = Number(this.query.limit) || 10

          const totalPage = Math.ceil(totalDocuments / limit)

          return { page, limit, total: totalDocuments, totalPage }
      }
  }
  ```
- **Why**: `countDocuments()` with no filter returns total collection size, not filtered count. Pagination metadata is wrong when filters/search are applied.

---

### Fix #7: Type mismatches in `IUser`
- **File**: `src/app/modules/user/user.interface.ts:27–28`
- **Before**:
  ```ts
  isDeleted?: string;
  isBlock?: string;
  ```
- **After**:
  ```ts
  isDeleted?: boolean;
  isBlock?: IsBlock;
  ```
- **Why**: The model treats `isBlock` as `IsBlock` enum and `isDeleted` as `Boolean`, but the interface declares both as `string`. This hides type errors across the codebase. All existing comparison sites already use `IsBlock.BLOCK` so no downstream breakage.

---

### Fix #8: Zod schema field name mismatch
- **File**: `src/app/modules/user/user.validation.ts:54`
- **Before**:
  ```ts
  IsBlock: z
      .enum(Object.values(IsBlock) as [string])
      .optional(),
  ```
- **After**:
  ```ts
  isBlock: z
      .enum(Object.values(IsBlock) as [string])
      .optional(),
  ```
- **Why**: The field is `IsBlock` (capital I) but the actual model field is `isBlock`. The validation never matches the real field name, so any update payload with `isBlock` bypasses this check.

---

### Fix #9: Ride cancellation doesn't restore driver availability
- **File**: `src/app/modules/ride/ride.service.ts`
- **Add imports**:
  ```ts
  import { Driver } from "../driver/driver.model";
  import { IsAvailable } from "../driver/driver.interface";
  ```
- **Before** (inside `cancelRide`, after line 75):
  ```ts
  ride.status = RideStatus.CANCELLED;
  ride.timestamps.cancelledAt = new Date();

  await ride.save();
  ```
- **After**:
  ```ts
  ride.status = RideStatus.CANCELLED;
  ride.timestamps.cancelledAt = new Date();

  await ride.save();

  // Restore driver availability if a driver was assigned
  if (ride.driver) {
    await Driver.findOneAndUpdate(
      { user: ride.driver },
      { $set: { availabilityStatus: IsAvailable.ONLINE } }
    );
  }
  ```
- **Why**: When a rider cancels an `ACCEPTED` ride (driver assigned), the driver's `availabilityStatus` was never restored. The driver stays offline until manually toggled.

---

### Fix #10: Driver suspension should revert user role
- **File**: `src/app/modules/admin/admin.service.ts:43–44`
- **Before**:
  ```ts
  existingDriver.approvalStatus = IsApprove.SUSPENDED;
  await existingDriver.save();

  return existingDriver;
  ```
- **After**:
  ```ts
  existingDriver.approvalStatus = IsApprove.SUSPENDED;
  await existingDriver.save();

  // Revert user role back to RIDER
  await User.findByIdAndUpdate(existingDriver.user, { role: Role.RIDER });

  return existingDriver;
  ```
- **Why**: `approveDriver` sets `role: DRIVER` (line 27). `suspendDriver` never reverts it, so a suspended driver retains `DRIVER` role and role-based permissions. `Role` is already imported at line 6.

---

## Execution Order

| Step | Fixes | Estimated Time |
|------|-------|----------------|
| 1 | #1, #2, #4, #8 (one-liners) | 1 min |
| 2 | #3, #7 (null check + type fix) | 2 min |
| 3 | #9, #10 (business logic additions) | 3 min |
| 4 | #6 (QueryBuilder refactor) | 3 min |
| 5 | #5 (race condition refactor) | 3 min |
| 6 | `npm run lint && npm run build` | 30 sec |

**Total estimated time**: ~12 minutes

---

## Files Touched

| File | Fixes |
|------|-------|
| `src/app/config/passport.ts` | #1 |
| `src/app/modules/auth/auth.service.ts` | #2, #3 |
| `src/app/modules/driver/driver.route.ts` | #4 |
| `src/app/modules/driver/driver.service.ts` | #5 |
| `src/app/utils/QueryBuilder.ts` | #6 |
| `src/app/modules/user/user.interface.ts` | #7 |
| `src/app/modules/user/user.validation.ts` | #8 |
| `src/app/modules/ride/ride.service.ts` | #9 |
| `src/app/modules/admin/admin.service.ts` | #10 |

**9 files modified, 0 files created, 0 files deleted.**

---

## Verification

After all fixes:
```bash
npm run lint    # must pass (existing no-console warning is pre-existing)
npm run build   # must pass with zero errors
```
