import { Router } from "express";
import { login, signup } from "../controllers/auth.controller";

const router = Router();

export const signUpRoute = router.post("/auth/signup", signup);
export const signInRoute = router.post("/auth/login", login);

export default router;
