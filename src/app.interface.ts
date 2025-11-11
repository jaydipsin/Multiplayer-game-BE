import { ObjectId } from "mongodb";
import { Types } from "mongoose";

export interface BaseMongoFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

export interface IUser {
  readonly _id: ObjectId;
  [key: string]: any;
}

export interface AccessTokenPayload {
  _id: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  _id: string; // The ONLY custom claim
  iat: number; // Issued At (added by JWT library)
  exp: number; // Expires At (added by JWT library)
}