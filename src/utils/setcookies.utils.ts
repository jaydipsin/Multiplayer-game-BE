import { Response } from "express";

export const setTokenToCookies = (refreshToken: string, res: Response) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // The browser cannot access this cookie via JavaScript
    secure: false, // Only send over HTTPS
    sameSite: "lax", // Mitigates CSRF attacks
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
};
