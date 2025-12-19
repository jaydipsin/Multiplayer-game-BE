import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";

// Imports from your local files
import connectDB from "./config/db";
import authRoutes from "./routes/auth.routes";
import refreshRoutes from "./routes/refresh.routes";
import { SocketHandler } from "./sockets/index";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Define allowed origins
const allowedOrigins = [
  "http://localhost:4200",
  process.env.FE_STAGING_URL,
].filter(Boolean) as string[];

// 2. GLOBAL MIDDLEWARE (CORS MUST BE FIRST)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps/Postman) or if in whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error("CORS blocked this origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json());
app.use(cookieParser());

// 3. ROUTES (Defined after CORS)
app.use("/auth", authRoutes); // Recommended to add a prefix like /auth
app.use("/refresh", refreshRoutes);

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// 4. DATABASE & SERVER INITIALIZATION
connectDB().then(() => {
  const httpServer = http.createServer(app);

  // 5. SOCKET.IO SETUP
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const socketHandler = new SocketHandler(io);
  io.on("connection", (socket) => {
    socketHandler.handleConnection(socket);
  });

  httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log("👉 Allowed Origins:", allowedOrigins);
  });
});
