# 🚗 Ride Booking API

A scalable and secure backend RESTful API for a Ride Booking System, built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**. This system manages users, drivers, and rides with support for role-based access control, ride lifecycle, driver onboarding, and admin control.

---

## 📌 Project Overview

The Ride Booking API supports the following features:

- ✅ User registration & login (JWT Auth)
- 🚖 Rider can request rides, view history
- 🚘 Drivers can apply, accept/reject rides, track earnings
- 🛡️ Admin can approve drivers, view all data
- 🕒 Auto-handled timestamps (pickup, completion)
- 🎯 Role-based authorization (Admin, Driver, Rider)
- 🔒 Secure route handling and error management

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, bcrypt
- **Validation**: Zod
- **Utilities**: dotenv, cookie-parser, cors
- **Dev Tools**: ts-node-dev, eslint, prettier

---

## ⚙️ Setup Instructions

1. **Clone the repo**
   ```bash
   git clone https://github.com/AbdullahAlTowsif/ride-booking-system-backend.git
   cd ride-booking-system-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```env
   PORT=5000
   DB_URL=mongodb://localhost:27017/rideBooking
   NODE_ENV=environment
   JWT_ACCESS_SECRET=your_jwt_secret
   JWT_ACCESS_EXPIRES=1d
   JWT_REFRESH_SECRET=your_refresh_secret
   JWT_REFRESH_EXPIRES=30d
   EXPRESS_SESSION_SECRET=your_express_session_secret
   BCRYPT_SALT_ROUND=100
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CALLBACK_URL=your_google_callback_url
   FRONTEND_URL=your_frontend_url
   ADMIN_EMAIL=your_admin_email
   ADMIN_PASSWORD=your_admin_password
   ```

4. **Run the server**
   ```bash
   npm run dev
   ```

---

## 📫 API Endpoints Summary (starts with `/api`)

### 🔐 Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Login and receive JWT |
| `POST` | `/auth/logout` | Logout and remove JWT |
| `POST` | `/auth/set-password` | Set Password for Google Auth User |

---

### 👤 User
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/user/register` | Register new user (default: rider) |
| `PATCH` | `/user/:id` | Update user profile |

---

### 👤 Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/users` | View all users |
| `GET` | `/admin/rides` | View all rides |
| `GET` | `/admin/drivers` | View all drivers |
| `PATCH` | `/admin/driver/approve/:id` | Approve driver application |
| `PATCH` | `/admin/driver/suspend/:id` | Suspend driver application |
| `PATCH` | `/admin/user/block/:id` | Block user |
| `PATCH` | `/admin/user/unblock/:id` | Unblock user |
| `GET` | `/admin/report` | Generate Report |

---

### 👷 Driver
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/driver/apply-driver` | Apply as driver |
| `GET` | `/driver/rides-available` | View unassigned ride requests |
| `GET` | `/driver/earning-history` | View own ride/earning history |
| `PATCH` | `/driver/rides/:id/accept` | Accept a ride |
| `PATCH` | `/driver/rides/:id/reject` | Reject a ride |
| `PATCH` | `/driver/rides/:id/status` | Progress ride: `picked_up` → `in_transit` → `completed` |

---

### 🛺 Ride
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/rides/request` | (Rider) Request a ride |
| `PATCH` | `/rides/:id/cancel` | (Rider) Cancel a ride |
| `GET` | `/rides/me` | (Rider) View all ride history |
| `GET` | `/rides/:id` | (Rider) View single ride history |

---

## 📁 Folder Structure

```
src/
│
├── app/
│   ├── modules/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── driver/
│   │   ├── admin/
│   │   ├── ride/
│   ├── middlewares/
│   ├── utils/
│   ├── config/
│   ├── routes/
│
├── app.ts
├── server.ts
```

---

## 🧩 Future Improvements

- Realtime location tracking with WebSockets
- OTP-based ride confirmation
- Payment gateway integration
- Admin dashboard with analytics

---

## 📜 Live Link

[Live Link Here](https://ride-booking-system-backend.vercel.app/)