import mongoose from "mongoose";

export const connectDB = async () => {
  //  Database connection logic here

  try {
    const MONGO_URI = process.env.MONGO_URI || "";
    await mongoose.connect(MONGO_URI);
    console.log("Data base connected ✅");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
