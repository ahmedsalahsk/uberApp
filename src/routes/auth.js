const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");
const { body, validationResult } = require("express-validator");


// Validator for registration
const registerValidator = [
  body("name").notEmpty().trim().withMessage("Name is required"),
  body("email").isEmail().trim().withMessage("Invalid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
];

// Register
router.post("/register", registerValidator, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { name, email, password, role } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password is required and must be at least 6 characters long" });
    }
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });
    user = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role : role === "driver" ? "driver" : "user"
    });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    // If the user is a driver, create a new Driver document
    if (user.role === "driver") {
      const Driver = require("../models/Driver");
      const driver = new Driver({ userId: user._id });
      await driver.save();
    }
    const userResponse = user.toObject();
    delete userResponse.password;
    const payload = { userId: user.id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token, message: "User registered successfully" , user: userResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({
    message: "Server error",
    error: err.message
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    const payload = { userId: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(200).json({ success : true , message :"login successfully" ,token , user: userResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update User Profile
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { name, email, role, password } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update Name
    if (name) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Invalid name" });
      }
      user.name = name.trim();
    }

    // Update Email
    if (email) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ message: "Invalid email" });
      }

      const existingUser = await User.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          message: "Email already in use",
        });
      }

      user.email = email.trim().toLowerCase();
    }

    // Update Role
    if (role) {
      if (!["user", "driver"].includes(role)) {
        return res.status(400).json({
          message: "Invalid role",
        });
      }

      user.role = role;

      // لو اتحول لسواق وماعندوش Driver Profile
      if (role === "driver") {
        const Driver = require("../models/Driver");

        const driverExists = await Driver.findOne({
          userId: user._id,
        });

        if (!driverExists) {
          await Driver.create({
            userId: user._id,
          });
        }
      }
    }

    // Update Password
    if (password) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          message:
            "Password must be at least 6 characters long",
        });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  res.json({ userId: req.userId });
}); 

module.exports = router;