import { IUser } from "./app.interface";

export interface GameInvite {
  from: string; // socket.id
  fromName: string;
  fromCode: string;
  to: string; // socket.id of receiver
}

export interface GameRoom {
  roomId: string;
  playerX: IUser;
  playerO: IUser;
  board: (string | null)[];
  currentTurn: "X" | "O";
}
