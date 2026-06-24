# UberApp API

Express + MongoDB API documentation.

## Base URL
- `http://localhost:5000` (or `process.env.PORT`)

## Auth
JWT is expected in the header:

`Authorization: Bearer <token>`

The auth middleware decodes the token and sets:
- `req.userId`

All ride endpoints are protected (they apply `authMiddleware` via `router.use(authMiddleware)`).

---

## Endpoints

### Root
#### `GET /`
- **Description**: Health/test endpoint
- **Response**: `"Hello World!"`

---

## Auth API (`/api/auth`)

### `POST /api/auth/register`
- **Auth**: No
- **Request body**:
  - `name` (string, required)
  - `email` (string, required, email format)
  - `password` (string, required, min length 6)
  - `role` (string, optional)
    - Stored as:
      - `"driver"` if `role === "driver"`
      - otherwise `"user"`
- **Response (200)**:
  - `token` (JWT)
  - `message`
  - `user` (user object without `password`)
- **Possible errors**:
  - `400` validation errors / missing fields / user already exists
  - `500` server error

### `POST /api/auth/login`
- **Auth**: No
- **Request body**:
  - `email`
  - `password`
- **Response (200)**:
  - `success: true`
  - `message`
  - `token` (JWT)
  - `user` (user object without `password`)
- **Possible errors**:
  - `400` missing fields / invalid credentials
  - `500` server error

### `GET /api/auth/me`
Defined **twice** in `src/routes/auth.js`.

**Latest definition wins** (the second `router.get("/me"...`).
- **Auth**: Yes (`authMiddleware`)
- **Response (200)**:
  - `{ "userId": "<decoded userId>" }`
- **Possible errors**:
  - `401` invalid/missing token
  - `500` server error (middleware-level depends)

> Note: There is an earlier definition that attempts to return the full user (with `-password`). Because `/me` is declared twice, behavior depends on Express route ordering; in Express, the later route handler will match for the same path/method.

### `PUT /api/auth/me`
- **Auth**: Yes (`authMiddleware`)
- **Request body** (any subset):
  - `name`
  - `email` (must be unique)
  - `role` (`"user"` or `"driver"`)
    - If switching to `"driver"` and driver profile doesn’t exist, it creates one.
  - `password` (min length 6)
- **Response (200)**:
  - `success: true`
  - `message`
  - `user` (user object without `password`)
- **Possible errors**:
  - `400` invalid inputs / invalid role / email already in use
  - `404` user not found
  - `500` server error

---

## Rides API (`/api/rides`)

All endpoints in `src/routes/rides.js` use `authMiddleware` via:
- `router.use(authMiddleware);`

So you must send a valid JWT for any `/api/rides/*` request.

### `POST /api/rides/`
- **Description**: Create a new ride request
- **Auth**: Yes
- **Request body**:
  - `pickupLocation` (string, required)
  - `dropoffLocation` (string, required)
- **Response (201)**:
  - Ride document (includes `passengerId` from `req.userId`)
- **Possible errors**:
  - `400` validation errors / invalid input
  - `500` server error

### `GET /api/rides/`
- **Description**: Get all rides for the authenticated user
- **Auth**: Yes
- **Returns**: Rides where:
  - `passengerId == req.userId` OR `driverId == req.userId`
- **Response (200)**: array of rides, sorted by `createdAt desc`
- **Notes**:
  - Populates:
    - `passengerId` with `name email`
    - `driverId` with `name email`
- **Possible errors**:
  - `500` server error

### `GET /api/rides/:id`
- **Description**: Get a specific ride by id
- **Auth**: Yes
- **Response (200)**:
  - Ride document
- **Access control**:
  - Allowed if user is either:
    - the passenger (`ride.passengerId == req.userId`) OR
    - the assigned driver (`ride.driverId == req.userId`)
- **Possible errors**:
  - `404` Ride not found
  - `403` Access denied
  - `500` server error

### `PUT /api/rides/accept/:id`
- **Description**: Driver accepts a ride request
- **Auth**: Yes
- **Access rules** (enforced by code):
  - User must be a driver profile (`Driver.findOne({ userId: req.userId })`)
  - `driver.isAvailable` must be `true`
  - Ride status must be `"requested"`
  - Driver cannot accept their own ride request
  - Ride must not already have `driverId`
- **Response (200)**:
  - Updated ride (populated passenger/driver)
- **Possible errors**:
  - `403` Only drivers can accept rides
  - `400` driver not available / ride cannot be accepted / already assigned
  - `404` Ride not found
  - `500` server error

### `PUT /api/rides/start/:id`
- **Description**: Start a ride (driver)
- **Auth**: Yes
- **Access rules**:
  - Only the assigned driver can start
  - Ride status must be `"accepted"`
- **Side effects**:
  - `ride.status = "started"`
  - `ride.StartedAt = new Date()`
- **Response (200)**:
  - Updated ride (populated)
- **Possible errors**:
  - `404` Ride not found
  - `403` Only assigned driver can start
  - `400` Ride cannot be started
  - `500` server error

### `PUT /api/rides/complete/:id`
- **Description**: Complete a ride (driver)
- **Auth**: Yes
- **Access rules**:
  - Only the assigned driver can complete
  - Ride status must be `"started"`
- **Request body**:
  - `fare` (number, required and must be > 0)
- **Side effects**:
  - `ride.status = "completed"`
  - `ride.completedAt = new Date()` (note: schema uses `CompletedAt`; field name mismatch may occur)
  - `ride.fare = fare`
  - If driver profile exists: `driver.isAvailable = true`
- **Response (200)**:
  - Updated ride (populated)
- **Possible errors**:
  - `404` Ride not found
  - `403` Only assigned driver can complete
  - `400` Ride cannot be completed / invalid fare
  - `500` server error

### `PUT /api/rides/cancel/:id`
- **Description**: Cancel a ride (passenger)
- **Auth**: Yes
- **Access rules**:
  - Only the passenger can cancel
  - Drivers cannot cancel
  - Cannot cancel if ride status is any of:
    - `"completed"`, `"started"`, or `"cancelled"`
- **Side effects**:
  - `ride.status = "cancelled"`
  - If there is a driver profile matching `ride.driverId`: sets `driver.isAvailable = true`
- **Response (200)**:
  - Updated ride (populated)
- **Possible errors**:
  - `404` Ride not found
  - `403` Only passenger can cancel / Drivers cannot cancel
  - `400` Cannot cancel a completed or started ride
  - `500` server error

---

## Data Model (fields overview)

### User (`User`)
- `name` (string, required)
- `email` (string, required, unique)
- `password` (string, required)
- `role` (`"user"` | `"driver"`, default `"user"`)
- Timestamps enabled: `createdAt`, `updatedAt`

### Driver (`Driver`)
- `userId` (ObjectId, ref `User`, required, unique)
- `carInfo` (string, default `""`)
- `licenseNumber` (string, default `""`)
- `isAvailable` (boolean, default `true`)
- Timestamps enabled: `createdAt`, `updatedAt`

### Ride (`Ride`)
- `passengerId` (ObjectId, ref `User`, required)
- `driverId` (ObjectId, ref `User`, default `null`)
- `pickupLocation` (string, required)
- `dropoffLocation` (string, required)
- `status` (`requested|accepted|started|completed|cancelled`, default `requested`)
- `fare` (number, default `null`)
- `StartedAt` (Date, default `null`)
- `CompletedAt` (Date, default `null`)
- Timestamps enabled: `createdAt`, `updatedAt`
