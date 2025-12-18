// sockets/socket.handler.ts
import { Server, Socket } from "socket.io";
import { GameInvite } from "./../interfaces/socket.type";
import User from "../models/user.model";

interface OnlineUser {
  userId: string; // MongoDB _id as string (permanent)
  socketId: string; // Current socket.id
  username: string;
  code: string;
}

export class SocketHandler {
  // Fast lookup maps
  private onlineUsers = new Map<string, OnlineUser>(); // socket.id → user
  private userIdToSocket = new Map<string, string>(); // mongoId → socket.id
  private codeToUserId = new Map<string, string>(); // code → mongoId

  private pendingInvites = new Map<string, GameInvite>();
  private activeGames = new Map<string, any>();

  constructor(private io: Server) {}

  public handleConnection(socket: Socket) {
    console.log("New connection attempt:", socket.id);
    socket.onAnyOutgoing((eventName, ...args) => {
      // console.log(`[📤 EMIT] Event: "${eventName}" | Args:`, args);
      // console.log("This is the online User object : ", this.onlineUsers);
      // console.log("This is the online User To socket : ", this.userIdToSocket);
      // console.log(
      //   "This is the online User Code to user id : ",
      //   this.codeToUserId
      // );
    });

    // STEP 1: Validate userId from frontend auth
    const userIdFromFrontend = (socket.handshake.auth as any)?.userId;

    if (!userIdFromFrontend || typeof userIdFromFrontend !== "string") {
      socket.emit("auth-error", { message: "Unauthorized: userId required" });
      socket.disconnect(true);
      return;
    }

    // STEP 2: Find real user in DB
    User.findById(userIdFromFrontend)
      .exec()
      .then((mongoUser: any) => {
        if (!mongoUser) {
          socket.emit("auth-error", { message: "User not found" });
          socket.disconnect(true);
          return;
        }

        // Prevent multiple connections (kick old one)
        const oldSocketId = this.userIdToSocket.get(userIdFromFrontend);
        if (oldSocketId && oldSocketId !== socket.id) {
          this.io.to(oldSocketId).emit("force-disconnect", {
            message: "You logged in from another device",
          });
          this.io.sockets.sockets.get(oldSocketId)?.disconnect();
        }

        // Update DB
        mongoUser.socketId = socket.id;
        mongoUser.isOnline = true;
        mongoUser.lastSeen = new Date();
        return mongoUser.save();
      })
      .then((mongoUser: any) => {
        if (!mongoUser) return; // already disconnected

        const userIdStr = mongoUser._id.toString();

        const onlineUser: OnlineUser = {
          userId: userIdStr,
          socketId: socket.id,
          username: mongoUser.username,
          code: mongoUser.code,
        };

        // Store in memory
        this.onlineUsers.set(socket.id, onlineUser);
        this.userIdToSocket.set(userIdStr, socket.id);
        this.codeToUserId.set(mongoUser.code.toUpperCase(), userIdStr);

        // SUCCESS: User is now online
        socket.emit("joined", {
          userId: userIdStr,
          username: mongoUser.username,
          code: mongoUser.code,
        });

        console.log(`${mongoUser.username} (${mongoUser.code}) is now online`);

        // Now register all game events
        this.registerGameEvents(socket);
      })
      .catch((err: Error) => {
        console.error("Auth error:", err);
        socket.emit("error", { message: "Connection failed" });
        socket.disconnect(true);
      });
  }

  private registerGameEvents(socket: Socket) {
    socket.on("send-invite", (data) =>
      this.handleSendInvite(socket, data.toCode)
    );
    socket.on("accept-invite", (data) =>
      this.handleAcceptInvite(socket, data.fromSocketId)
    );
    socket.on("reject-invite", (data) =>
      this.handleRejectInvite(socket, data.fromSocketId)
    );
    socket.on("make-move", (data) => this.handleMakeMove(socket, data));

    // --- NEW EVENTS ---
    socket.on("restart-game", (data: { roomId: string }) => {
      console.log("RESTART TRIGGERED for room:", data.roomId);
      this.handleRestartGame(socket, data.roomId);
    });

    socket.on("exit-game", (data: { roomId: string }) =>
      this.handleExitGame(socket, data.roomId)
    );

    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  // ──────────────────────────────────────────────────────────────
  // Game Logic (same as before, but now 100% safe)
  // ──────────────────────────────────────────────────────────────

  private handleSendInvite(socket: Socket, toCode: string) {
    const fromUser = this.onlineUsers.get(socket.id);
    if (!fromUser) return;

    const targetUserId = this.codeToUserId.get(toCode.toUpperCase().trim());
    if (!targetUserId || targetUserId === fromUser.userId) {
      return socket.emit("invite-error", {
        message: "Invalid or offline user",
      });
    }

    console.log("eeeee This is the obj : ", this.userIdToSocket);

    const targetSocketId = this.userIdToSocket.get(targetUserId);
    if (!targetSocketId) {
      return socket.emit("invite-error", { message: "User is offline" });
    }

    if (this.pendingInvites.has(targetSocketId)) {
      return socket.emit("invite-error", { message: "Invite already sent" });
    }

    const invite: GameInvite = {
      from: socket.id,
      fromName: fromUser.username,
      fromCode: fromUser.code,
      to: targetSocketId,
    };

    this.pendingInvites.set(targetSocketId, invite);

    this.io.to(targetSocketId).emit("receive-invite", {
      fromName: fromUser.username,
      fromCode: fromUser.code,
      fromSocketId: socket.id,
    });

    socket.emit("invite-sent", { toCode });
  }

  private handleAcceptInvite(socket: Socket, fromSocketId: string) {
    const invite = this.pendingInvites.get(socket.id);
    if (!invite || invite.from !== fromSocketId) {
      return socket.emit("invite-error", { message: "No pending invite" });
    }

    const playerX = this.onlineUsers.get(fromSocketId)!; // Inviter = X
    const playerO = this.onlineUsers.get(socket.id)!; // Acceptor = O

    const roomId = `room_${fromSocketId}_${socket.id}`;
    this.pendingInvites.delete(socket.id);

    // Join both to room
    socket.join(roomId);
    this.io.sockets.sockets.get(fromSocketId)?.join(roomId);
    const gameState = {
      roomId,
      board: Array(9).fill(null),
      currentTurn: "X" as "X" | "O",
      playerX,
      playerO,
      scores: { X: 0, O: 0 }, // PERSISTENT SCORE
    };

    this.activeGames.set(roomId, gameState);

    // Update your individual emits to include scores
    const gameData = {
      roomId,
      board: gameState.board,
      currentTurn: "X",
      players: {
        /* ... your existing player object ... */
      },
      scores: gameState.scores, // Pass scores to FE
    };

    this.io
      .to(fromSocketId)
      .emit("game-start", { ...gameData, yourSymbol: "X", opponent: playerO });
    this.io
      .to(socket.id)
      .emit("game-start", { ...gameData, yourSymbol: "O", opponent: playerX });
    // Emit to BOTH players with correct yourSymbol
    this.io.to(roomId).emit("game-start", {
      roomId,
      board: gameState.board,
      currentTurn: "X",
      players: {
        X: {
          username: playerX.username,
          code: playerX.code,
          userId: playerX.userId,
        },
        O: {
          username: playerO.username,
          code: playerO.code,
          userId: playerO.userId,
        },
      },
      // CRITICAL: Determine symbol based on recipient's socket ID
      yourSymbol: (targetSocketId: string) =>
        targetSocketId === fromSocketId ? "X" : "O",
      // We'll fix frontend to use socket.id properly
    });

    // Better: Send individually with correct symbol
    // This is the SAFEST way:
    this.io.to(fromSocketId).emit("game-start", {
      roomId,
      board: gameState.board,
      currentTurn: "X",
      players: {
        X: {
          username: playerX.username,
          code: playerX.code,
          userId: playerX.userId,
        },
        O: {
          username: playerO.username,
          code: playerO.code,
          userId: playerO.userId,
        },
      },
      yourSymbol: "X",
      opponent: playerO,
    });

    this.io.to(socket.id).emit("game-start", {
      roomId,
      board: gameState.board,
      currentTurn: "X",
      players: {
        X: {
          username: playerX.username,
          code: playerX.code,
          userId: playerX.userId,
        },
        O: {
          username: playerO.username,
          code: playerO.code,
          userId: playerO.userId,
        },
      },
      yourSymbol: "O",
      opponent: playerX,
    });
  }

  private handleRejectInvite(socket: Socket, fromSocketId: string) {
    this.pendingInvites.delete(socket.id);
    this.io.to(fromSocketId).emit("invite-rejected", {
      message: `${this.onlineUsers.get(socket.id)?.username} rejected your invite`,
    });
  }

  // sockets/socket.handler.ts

  private handleMakeMove(
    socket: Socket,
    { roomId, index }: { roomId: string; index: number }
  ) {
    const game = this.activeGames.get(roomId);
    if (!game) return;

    // ... (Existing validation logic: cell empty, correct player, correct turn) ...
    // [Copy your existing validation logic here for brevity, it was correct]

    // --- Validation logic snippet for context ---
    if (game.board[index] !== null) return;
    const currentUser = this.onlineUsers.get(socket.id);
    if (!currentUser) return;
    let symbol =
      currentUser.userId === game.playerX.userId
        ? "X"
        : currentUser.userId === game.playerO.userId
          ? "O"
          : null;
    if (!symbol || game.currentTurn !== symbol) return;
    // ---------------------------------------------

    game.board[index] = symbol;
    game.currentTurn = symbol === "X" ? "O" : "X";

    // Check Winner
    const winner = this.checkWinner(game.board);
    const isDraw = !winner && game.board.every((cell: any) => cell !== null);

    if (winner) {
      game.scores[winner]++; // Increment X or O
    }
    this.io.to(roomId).emit("opponent-move", {
      index,
      symbol,
      nextTurn: game.currentTurn,
    });
    if (winner || isDraw) {
      this.io.to(roomId).emit("game-over", {
        winner: winner || null,
        draw: isDraw,
        board: game.board,
        scores: game.scores, // Send current match scores
      });
      // DO NOT DELETE game here
    }
  }
  // private handleDisconnect(socket: Socket) {
  //   const user = this.onlineUsers.get(socket.id);
  //   if (user) {
  //     User.updateOne(
  //       { _id: user.userId },
  //       { socketId: null, isOnline: false, lastSeen: new Date() }
  //     ).catch(console.error);

  //     this.onlineUsers.delete(socket.id);
  //     const currentSocketIdInMap = this.userIdToSocket.get(user.userId);
  //     if (currentSocketIdInMap === socket.id) {
  //       this.userIdToSocket.delete(user.userId);
  //     } else {
  //       console.log(
  //         `[Prevented Wipe] User ${user.username} reconnected, keeping new socket active.`
  //       );
  //     }
  //     console.log(`${user.username} disconnected`);
  //   }
  // }

  private handleRestartGame(socket: Socket, roomId: string) {
    const game = this.activeGames.get(roomId);

    if (!game) {
      console.error(`Restart failed: Room ${roomId} not found`);
      return;
    }

    // Reset logic
    game.board = Array(9).fill(null);
    game.currentTurn = "X";

    console.log(
      `Room ${roomId} board has been reset. Emitting game-restarted...`
    );

    // BROADCAST to the entire room so both players see the reset
    this.io.to(roomId).emit("game-restarted", {
      board: game.board,
      currentTurn: "X",
      scores: game.scores, // Crucial: send existing scores back
    });
  }

  // --- NEW: Handle Exit (Destroy Room) ---
private handleExitGame(socket: Socket, roomId: string) {
  console.log(`Exit requested by ${socket.id} for room ${roomId}`);
  this.cleanupGame(roomId, "The match has been ended.");
} 
  // --- UPDATED: Handle Disconnect (Cleanup stuck games) ---
  private handleDisconnect(socket: Socket) {
    // 1. Database cleanup (Your existing code)
    const user = this.onlineUsers.get(socket.id);
    if (user) {
      User.updateOne(
        { _id: user.userId },
        { socketId: null, isOnline: false, lastSeen: new Date() }
      ).catch(console.error);
      this.onlineUsers.delete(socket.id);
      this.userIdToSocket.delete(user.userId);
      console.log(`${user.username} disconnected`);

      // 2. NEW: Check if this user was in an active game and destroy it
      // Since we don't map socket->room directly, we iterate (fine for now)
      for (const [roomId, game] of this.activeGames.entries()) {
        if (
          game.playerX.userId === user.userId ||
          game.playerO.userId === user.userId
        ) {
          this.cleanupGame(roomId, "Opponent disconnected");
          break;
        }
      }
    }
  }

  // --- Helper to destroy game ---
  private cleanupGame(roomId: string, reason: string) {
    if (this.activeGames.has(roomId)) {
      // 1. FIRST: Notify both players so they can clear their signals/UI
      // We use a general 'game-over' or a new 'game-closed' event
      this.io.to(roomId).emit("game-closed", {
        message: reason,
        resetScores: true,
      });

      // 2. SECOND: Delete the data from the server memory
      this.activeGames.delete(roomId);

      // 3. FINALLY: Force the sockets out of the room
      // This happens after the message is sent
      this.io.in(roomId).socketsLeave(roomId);

      console.log(`Room ${roomId} has been fully cleaned up.`);
    }
  }

  private checkWinner(board: (string | null)[]) {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c])
        return board[a];
    }
    return null;
  }
}
