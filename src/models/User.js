const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "driver"], required: true, default: "user" },
    // location: {
    //   type: { type: String, enum: ["Point"], required: true },
    //   coordinates: { type: [Number], required: true },
    // },
  },
  { timestamps: true },
);

// userSchema.index({ location: "2dsphere" });
const User = mongoose.model("User", userSchema);
module.exports = User;
