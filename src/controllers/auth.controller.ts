// controllers/auth.controller.ts
import { Request, Response } from "express";
import User from "../models/user.model"; // ← default import
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_TOKEN_SECRET, JWT_SECRET } from "../config/global.config";
import { generateCode } from "../utils/generate-code"; // ← we'll create this
import { IUser } from "../interfaces/app.interface";
import { Types } from "mongoose";

// Response types
interface AuthResponse {
  accessToken: string;
  message: string;
  user: Omit<IUser, "password"> & { _id: string };
}

const sendUserResponse = (user: any, res: Response): Response => {
  const accessToken = jwt.sign(
    {
      _id: user._id.toString(),
      email: user.email,
      username: user.username,
    },
    JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign({ _id: user._id.toString() }, JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set refresh token in httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Remove password + convert _id to string
  const { password, ...safeUser } = user.toObject();
  safeUser._id = safeUser._id.toString();

  const response: AuthResponse = {
    accessToken,
    message: user.isNew ? "User registered successfully" : "Login successful",
    user: safeUser as any,
  };

  return res.json(response);
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email or username already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique 6-digit code
    const code = await generateCode();

    // Create user
    const newUser = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      code,
      isOnline: false,
      lastSeen: new Date(),
    });

    const savedUser = await newUser.save();

    // Mark as new for message
    savedUser.isNew = true;

    return sendUserResponse(savedUser, res);
  } catch (error: any) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    return sendUserResponse(user, res);
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Optional: Get current user (for frontend reload)
export const me = async (req: Request, res: Response) => {
  try {
    // @ts-ignore – assuming you have auth middleware that sets req.user
    const user = await User.findById(req.user?._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const { password, ...safeUser } = user.toObject();
    safeUser._id = new Types.ObjectId(safeUser._id.toString());

    return res.json({ user: safeUser });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
