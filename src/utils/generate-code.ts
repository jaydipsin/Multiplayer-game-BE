// utils/generateCode.ts
import User from "../models/user.model";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateCode = async (): Promise<string> => {
  let code: string;
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
  } while (await User.exists({ code }));
  return code;
};