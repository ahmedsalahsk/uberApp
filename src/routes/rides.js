const express = require("express");
const router = express.Router();
const Ride = require("../models/Ride");
const Driver = require("../models/Driver");
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");

// Request a ride
router.use(authMiddleware);

// Validator for ride request
const rideRequestValidator = [
  body("pickupLocation").notEmpty().trim().withMessage("Pickup location is required"),
  body("dropoffLocation").notEmpty().trim().withMessage("Dropoff location is required")
];



// create a new ride request
router.post("/", rideRequestValidator, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { pickupLocation, dropoffLocation } = req.body;
    if (
      !pickupLocation ||
      typeof pickupLocation !== "string" ||
      !dropoffLocation ||
      typeof dropoffLocation !== "string"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const ride = new Ride({
      passengerId: req.userId,
      pickupLocation: pickupLocation.trim(),
      dropoffLocation: dropoffLocation.trim(),
      status: "requested",
    });
    await ride.save();
    res.status(201).json(ride);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// get all rides for the authenticated user (either as a passenger or driver)
router.get("/", async (req, res) => {
  try {
    const rides = await Ride.find({
      $or: [{ passengerId: req.userId }, { driverId: req.userId }],
    })
      .sort({ createdAt: -1 })
      .populate("passengerId", "name email")
      .populate("driverId", "name email");
    res.status(200).json(rides);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// get a specific ride by ID
router.get("/:id", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate("passengerId", "name email")
      .populate("driverId", "name email");
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    const isPassenger = ride.passengerId._id.toString() === req.userId;
    const isDriver =
      ride.driverId && ride.driverId._id.toString() === req.userId;
    if (!isPassenger && !isDriver) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Accept a ride request (only for drivers)
router.put("/accept/:id", async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.userId });
    if (!driver) {
      return res.status(403).json({ message: "Only drivers can accept rides" });
    }
    if (!driver.isAvailable) {
      return res.status(400).json({ message: "Driver is not available" });
    }
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    if (ride.status !== "requested") {
      return res.status(400).json({ message: "Ride cannot be accepted" });
    }
    if (ride.passengerId.toString() === req.userId) {
      return res
        .status(400)
        .json({ message: "You cannot accept your own ride request" });
    }
    if (ride.driverId) {
      return res
        .status(400)
        .json({ message: "Ride has already been accepted by another driver" });
    }
    ride.driverId = req.userId;
    ride.status = "accepted";
    await ride.save();
    driver.isAvailable = false;
    await driver.save();
    const updatedRide = await Ride.findById(ride._id)
      .populate("passengerId", "name email")
      .populate("driverId", "name email");
    res.status(200).json(updatedRide);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Start a ride (only for drivers)
router.put("/start/:id", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    if (ride.driverId?.toString() !== req.userId) {
      return res
        .status(403)
        .json({ message: "Only the assigned driver can start the ride" });
    }
    if (ride.status !== "accepted") {
      return res.status(400).json({ message: "Ride cannot be started" });
    }
    ride.status = "started";
    ride.StartedAt = new Date();
    await ride.save();
    const updatedRide = await Ride.findById(ride._id)
      .populate("passengerId", "name email")
      .populate("driverId", "name email");
    res.status(200).json(updatedRide);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Complete a ride (only for drivers)
router.put("/complete/:id", async (req, res) => {
try {
  const ride = await Ride.findById(req.params.id);
  if (!ride) {
    return res.status(404).json({ message: "Ride not found" });
  }
  if (ride.driverId?.toString() !== req.userId.toString()) {
    return res
      .status(403)
      .json({ message: "Only the assigned driver can complete the ride" });
  }
  if (ride.status !== "started") {
    return res.status(400).json({ message: "Ride cannot be completed" });
  }
  const fare = req.body.fare != null ? Number(req.body.fare) : null;
  if (typeof fare !== "number" || fare <= 0) {
    return res.status(400).json({ message: "Invalid fare amount" });
  }
  ride.status = "completed";
  ride.completedAt = new Date();
  ride.fare = fare;
  await ride.save();
  const driver = await Driver.findOne({ userId: req.userId });
  if (driver) {
    driver.isAvailable = true;
    await driver.save();
  }
  const updatedRide = await Ride.findById(ride._id)
    .populate("passengerId", "name email")
    .populate("driverId", "name email");
  res.status(200).json(updatedRide);
} catch (error) {
  res.status(500).json({ message: "Server error", error: error.message });
}
});

// Cancel a ride (only for passengers)
router.put("/cancel/:id", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    const isPassenger = ride.passengerId?.toString() === req.userId;
    if (!isPassenger) {
      return res
        .status(403)
        .json({ message: "Only the passenger can cancel the ride" });
    }
    const isDriver = ride.driverId?.toString() === req.userId;
    if (isDriver) {
      return res
        .status(403)
        .json({ message: "Drivers cannot cancel the ride" });
    }
    if (ride.status === "completed" || ride.status === "started" || ride.status === "cancelled") {
      return res.status(400).json({ message: "Cannot cancel a completed or started ride" });
    }
    ride.status = "cancelled";
    await ride.save();
    const driver = await Driver.findOne({ userId: ride.driverId });
    if (driver) {
      driver.isAvailable = true;
      await driver.save();
    }
    const updatedRide = await Ride.findById(ride._id)
      .populate("passengerId", "name email")
      .populate("driverId", "name email");
    res.status(200).json(updatedRide);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router;
