import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { generalRateLimit } from "./middleware/rateLimit.middleware";
import { errorHandler } from "./middleware/error.middleware";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import organizerRoutes from "./routes/organizer.routes";
import venueRoutes from "./routes/venue.routes";
import publicEventRoutes from "./routes/publicEvent.routes";
import bookingRoutes from "./routes/booking.routes";
import ticketRoutes from "./routes/ticket.routes";
import enquiryRoutes from "./routes/enquiry.routes";
import reviewRoutes from "./routes/review.routes";
import wishlistRoutes from "./routes/wishlist.routes";
import notificationRoutes from "./routes/notification.routes";
import payoutRoutes from "./routes/payout.routes";
import searchRoutes from "./routes/search.routes";
import analyticsRoutes from "./routes/analytics.routes";

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(generalRateLimit);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/organizer", organizerRoutes);
app.use("/api/v1/venues", venueRoutes);
app.use("/api/v1/events", publicEventRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/enquiries", enquiryRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/payouts", payoutRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

app.use(errorHandler);

export default app;
