import { Router } from "express";
import { refreshToken } from "../controllers/refresh.controller";

const router = Router();
export const refreshRoute = router.post("/refresh", refreshToken);

export default router;
