import app from "./app";
import connectDB from "./config/db";
import cors from "cors";
import http from "http";
import express from "express";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { SocketHandler } from "./sockets/index";

dotenv.config();

const PORT = process.env.PORT || 5000;

// 1. Define allowed origins
const allowedOrigins = [
  "http://localhost:4200",
  process.env.FE_STAGING_URL
].filter(Boolean) as string[];

// 2. Use ONLY the cors library. 
// DO NOT add a manual app.use((req, res, next) => ...) block after this.
app.use(
  cors({
    origin: (origin, callback) => {
      // If no origin (like mobile/Postman) or if it's in our list
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

connectDB().then(() => {
  const httpServer = http.createServer(app);

  // 3. Apply the same origin list to Socket.io
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
    console.log(`Server running on port ${PORT}`);
  });
});