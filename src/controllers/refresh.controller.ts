import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_TOKEN_SECRET, JWT_SECRET } from "../config/global.config";
import { RefreshTokenPayload } from "../interfaces/app.interface";
import { Types } from "mongoose";
import { getUserById } from "../utils/users.utils";

export const refreshToken = async (req: Request, res: Response) => {
  const token = req.cookies.refreshToken;

  console.log(token);

  if (!token) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
    const userId = new Types.ObjectId(decoded._id);

    const user = await getUserById(userId);

    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }
    const newAccessToken = jwt.sign(
      { id: userId, email: user.email, username: user.username },
      JWT_ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      }
    );

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    return res
      .status(403)
      .json({ message: "Invalid or expired refresh token" });
  }
};
