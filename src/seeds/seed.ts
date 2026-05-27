import dotenv from "dotenv";
import Booking from "../models/Booking";
import Enquiry from "../models/Enquiry";
import Notification from "../models/Notification";
import OrganizerProfile from "../models/OrganizerProfile";
import OTP from "../models/OTP";
import Payout from "../models/Payout";
import PublicEvent from "../models/PublicEvent";
import Review from "../models/Review";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Venue from "../models/Venue";
import Wishlist from "../models/Wishlist";
import { connectDB } from "../config/db";
import { seedUsers } from "./users.seed";
import { seedVenues } from "./venues.seed";
import { seedEvents } from "./events.seed";
import { seedBookings } from "./bookings.seed";
import { seedReviews } from "./reviews.seed";
import { seedAdmin } from "./admin.seed";

dotenv.config();

const requiredSeedEmails = [
  "paromitaporel41@gmail.com",
  "arjun@mehtaevents.com",
];

const clearCollections = async (): Promise<void> => {
  await Notification.deleteMany({});
  await Review.deleteMany({});
  await Ticket.deleteMany({});
  await Booking.deleteMany({});
  await Enquiry.deleteMany({});
  await Payout.deleteMany({});
  await Wishlist.deleteMany({});
  await OTP.deleteMany({});
  await PublicEvent.deleteMany({});
  await Venue.deleteMany({});
  await OrganizerProfile.deleteMany({});
  await User.deleteMany({});
};

const run = async (): Promise<void> => {
  await connectDB();

  const existingSeedUsers = await User.countDocuments({
    email: { $in: requiredSeedEmails },
  });
  if (existingSeedUsers === requiredSeedEmails.length && process.env.FORCE_SEED !== "true") {
    await seedAdmin();
    console.log("✓ Seed data already present. Admin extras upserted.");
    process.exit(0);
  }

  await clearCollections();

  await seedUsers();
  console.log("✓ Users seeded");

  await seedAdmin();
  console.log("✓ Admin user seeded");

  await seedVenues();
  console.log("✓ Venues seeded");

  await seedEvents();
  console.log("✓ Events seeded");

  await seedBookings();
  console.log("✓ Bookings seeded");

  await seedReviews();
  console.log("✓ Reviews seeded");

  console.log("✓ Seed completed");
  process.exit(0);
};

void run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
