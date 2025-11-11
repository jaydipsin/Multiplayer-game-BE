// In types/express/index.d.ts

declare namespace Express {
  export interface Request {
    user?: string; // Or whatever type your user ID is
  }
}
