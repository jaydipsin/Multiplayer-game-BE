import mongoose from "mongoose";

const user = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    code: { type: String, unique: true, required: true }, // 6-digit friend code
    socketId: { type: String, default: null }, // current socket
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("User", user);
