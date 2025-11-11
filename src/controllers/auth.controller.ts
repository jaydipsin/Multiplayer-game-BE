import { Request, Response } from "express";
import userModel from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_TOKEN_SECRET, JWT_SECRET } from "../config/global.config";
import { LoginResponse, SignupResponse } from "./models/auth.model";
import { IUser } from "../app.interface";
import { getUserByEmailAndUsername } from "../utils/users.utils";
import { setTokenToCookies } from "../utils/setcookies.utils";

const sendUser = (user: IUser, res: Response) => {
  const accessToken = jwt.sign(
    {
      _id: user._id,
      email: user.email,
      username: user.username,
    },
    JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    {
      _id: user._id,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  // Setting the refresh token to cookies
  setTokenToCookies(refreshToken, res);

  const userToReturn = user.toObject();
  delete userToReturn.password;

  const response: SignupResponse = {
    accessToken,
    message: "User registered successfully",
    user: userToReturn,
  };

  return res.json(response);
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // check user exsist or not
    let user: IUser | null = await getUserByEmailAndUsername(email, username);
    if (user) {
      return res.status(400).json({ message: "User already exsist" });
    }

    // hase password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // saving the user
    user = new userModel({ username, email, password: hashedPassword });
    await user.save();

    // Generating the jwt token
    return sendUser(user, res);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { password, email } = req.body;

    const user = await userModel.findOne({ email });

    const isMatch = user
      ? await bcrypt.compare(password, user.password)
      : false;
    if (!isMatch || !user)
      return res.status(400).json({ message: "Invalid credentials" });

    return sendUser(user, res);
  } catch (error) {
    res.status(500).json(error);
  }
};
