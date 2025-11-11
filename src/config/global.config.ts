import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET || !process.env.JWT_ACCESS_TOKEN_SECRET) {
  throw new Error("❌ missing the jwt secret");
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;

export const loginMessage = "Successfully Logged in";
