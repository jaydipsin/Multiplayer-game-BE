import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import cors from "cors";
import cookieParser from "cookie-parser";
import refreshRoutes from "./routes/refresh.routes";

dotenv.config();

const app = express();

const corsOptions = {
  origin: "https://multiplayer-game-be-t5pn.onrender.com",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use("", authRoutes);
app.use("", refreshRoutes);
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
export default app;
