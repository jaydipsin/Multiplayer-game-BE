import { ObjectId } from "mongodb";
import { Types } from "mongoose";

export interface BaseMongoFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

export interface IUser {
  _id: ObjectId;
  username: string;
  email?: string;
  socketId?: string;        // Current active socket (optional, changes on reconnect)
  uniqueCode: string;       // Your 6-digit friend code
  isOnline: boolean;
  lastSeen: Date;
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