import { ObjectId } from "mongoose";
import userModel from "../models/user.model";
import { IUser } from "../interfaces/app.interface";
import { Types } from "mongoose";

export const getUserById = async (
  _id: Types.ObjectId
): Promise<IUser | null> => {
  return await userModel.findOne(_id);
};
export const getUserByEmailAndUsername = async (
  email: string,
  username: string
): Promise<IUser | null> => {
  return await userModel.findOne({ email, username });
};
