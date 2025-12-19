import { Router } from "express";
import { login, signup } from "../controllers/auth.controller";

const router = Router();

export const signUpRoute = router.post("/signup", signup);
export const signInRoute = router.post("/login", login);

export default router;
