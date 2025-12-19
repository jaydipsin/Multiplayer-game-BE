import app from "./app";
import connectDB from "./config/db";
import cors from "cors";
import http from "http";
import express from "express";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { SocketHandler } from "./sockets/index"; // ← HERE!
dotenv.config();

const PORT = process.env.PORT || 5000;

// ✅ Add your CSP middleware here, before routes
const allowedOrigins = [
  "http://localhost:4200",
  process.env.FE_STAGING_URL || "",
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
connectDB().then(() => {
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins, // Allow local and staging
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  const socketHandler = new SocketHandler(io);

  // Listen for new connections
  io.on("connection", (socket) => {
    socketHandler.handleConnection(socket);
  });
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
