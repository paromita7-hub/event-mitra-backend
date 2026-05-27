import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { seedAdmin } from "./seeds/admin.seed";

dotenv.config();

const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || "0.0.0.0";

const startServer = async (): Promise<void> => {
  await connectDB();
  await seedAdmin();

  app.listen(port, host, () => {
    console.log(`✓ EventMitra API running on http://${host}:${port}`);
  });
};

void startServer();
