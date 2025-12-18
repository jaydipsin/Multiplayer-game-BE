import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import cors from "cors";
import cookieParser from "cookie-parser";
import refreshRoutes from "./routes/refresh.routes";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("", authRoutes);
app.use("", refreshRoutes);
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
export default app;
