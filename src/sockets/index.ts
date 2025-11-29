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
    socket.on("send-invite", (data: { toCode: string }) => {
      console.log("eeeee Data ", data);
      return this.handleSendInvite(socket, data.toCode);
    });
    socket.on("accept-invite", (data: { fromSocketId: string }) =>
      this.handleAcceptInvite(socket, data.fromSocketId)
    );
    socket.on("reject-invite", (data: { fromSocketId: string }) =>
      this.handleRejectInvite(socket, data.fromSocketId)
    );
    socket.on("make-move", (data: { roomId: string; index: number }) =>
      this.handleMakeMove(socket, data)
    );
    socket.on("restart-game",()=>{
      console.log("This all are the active gammes : ",this.activeGames);
    })
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
    };

    this.activeGames.set(roomId, gameState);

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
    console.log(
      `[MOVE ATTEMPT] Room: ${roomId}, Index: ${index}, Socket: ${socket.id}`
    );

    const game = this.activeGames.get(roomId);

    // 1. Check if game exists
    if (!game) {
      console.log("❌ Move Failed: Game room not found");
      return;
    }

    // 2. Check if cell is empty
    if (game.board[index] !== null) {
      console.log("❌ Move Failed: Cell already occupied");
      return;
    }

    // 3. IDENTIFY PLAYER (Crucial Fix)
    // We use the User ID from the onlineUsers map, because socket.id might have changed,
    // but the mapping in this.onlineUsers is kept up to date in handleConnection/Disconnect.
    const currentUser = this.onlineUsers.get(socket.id);

    if (!currentUser) {
      console.log("❌ Move Failed: User not found in online map");
      return;
    }

    // Compare IDs, not Sockets
    let symbol: "X" | "O" | null = null;

    if (currentUser.userId === game.playerX.userId) {
      symbol = "X";
    } else if (currentUser.userId === game.playerO.userId) {
      symbol = "O";
    }

    if (!symbol) {
      console.log("❌ Move Failed: Socket does not belong to this game");
      return;
    }

    // 4. Check Turn
    if (game.currentTurn !== symbol) {
      console.log(
        `❌ Move Failed: It is ${game.currentTurn}'s turn, but ${symbol} tried to move.`
      );
      return;
    }

    // --- SUCCESS ---
    console.log(`✅ Move Accepted: ${symbol} placed at ${index}`);

    game.board[index] = symbol;
    game.currentTurn = symbol === "X" ? "O" : "X";

    // Broadcast the move to EVERYONE in the room (including the sender!)
    this.io.to(roomId).emit("opponent-move", {
      index,
      symbol,
      board: game.board,
      nextTurn: game.currentTurn,
    });

    // Check Winner Logic...
    const winner = this.checkWinner(game.board);
    if (winner || game.board.every((cell: any) => cell !== null)) {
      this.io.to(roomId).emit("game-over", {
        winner: winner || null, // null means draw
        draw: !winner, // explicit draw flag
        board: game.board,
      });
      this.activeGames.delete(roomId);
    }
  }
  private handleDisconnect(socket: Socket) {
    const user = this.onlineUsers.get(socket.id);
    if (user) {
      User.updateOne(
        { _id: user.userId },
        { socketId: null, isOnline: false, lastSeen: new Date() }
      ).catch(console.error);

      this.onlineUsers.delete(socket.id);
      const currentSocketIdInMap = this.userIdToSocket.get(user.userId);
      if (currentSocketIdInMap === socket.id) {
        this.userIdToSocket.delete(user.userId);
      } else {
        console.log(
          `[Prevented Wipe] User ${user.username} reconnected, keeping new socket active.`
        );
      }
      console.log(`${user.username} disconnected`);
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
