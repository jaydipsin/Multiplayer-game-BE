import { BaseMongoFields, IUser } from "./app.interface";

export interface SignupResponse {
  accessToken: string;
  message: string;
  user:IUser
}

export interface LoginResponse {
  token: string;
  user: IUser;
  message: string;
}
