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

// 1. Clean list of origins
const allowedOrigins = [
  "http://localhost:4200",
  process.env.FE_STAGING_URL
].filter(Boolean) as string[];

// 2. THE ONLY CORS CONFIG YOU NEED
app.use(
  cors({
    origin: (origin, callback) => {
      // If no origin (like mobile) or origin is in our list
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS blocked this origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

// 3. JSON PARSER
app.use(express.json());

// 4. DATABASE & SERVER
connectDB().then(() => {
  const httpServer = http.createServer(app);

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
    console.log("Allowing origins:", allowedOrigins);
  });
});