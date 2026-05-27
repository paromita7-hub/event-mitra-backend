import User from "../models/User";
import Settings from "../models/Settings";
import Dispute from "../models/Dispute";
import PlatformNotification from "../models/PlatformNotification";
import AdminAuditLog from "../models/AdminAuditLog";
import Booking from "../models/Booking";

const ADMIN_EMAIL = "admin@eventmitra.com";
const ADMIN_PASSWORD = "admin@123";

export const seedAdmin = async (): Promise<void> => {
  const adminUser = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      firstName: "EventMitra",
      lastName: "Admin",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      phone: "+91 98000 00001",
      role: "admin",
      city: "Mumbai",
      avatar: "EA",
      isEmailVerified: true,
      isActive: true,
      isBanned: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Settings.findOneAndUpdate(
    {},
    {
      commissionRate: 12,
      maintenanceMode: false,
      supportEmail: "support@eventmitra.com",
      appVersion: "1.0.0",
      lastUpdatedBy: adminUser._id,
    },
    { upsert: true, new: true },
  );

  const paromita = (await User.findOne({ email: "paromitaporel41@gmail.com" }).lean()) as { _id: string } | null;
  const arjun = (await User.findOne({ email: "arjun@mehtaevents.com" }).lean()) as { _id: string } | null;
  const rahul = (await User.findOne({ email: "rahul.sharma@example.com" }).lean()) as { _id: string } | null;
  const sampleBooking = (await Booking.findOne().sort({ createdAt: -1 }).lean()) as { _id: string } | null;

  if ((await Dispute.countDocuments()) === 0 && paromita && arjun && rahul) {
    await Dispute.insertMany([
      {
        raisedBy: paromita._id,
        raisedByRole: "customer",
        againstUser: arjun._id,
        booking: sampleBooking?._id,
        type: "booking_issue",
        title: "Venue was not as described",
        description:
          "The banquet hall we booked had much less capacity than advertised. We were expecting 300 guests but the hall could only accommodate 150.",
        status: "open",
        priority: "high",
        messages: [
          {
            sender: paromita._id,
            senderRole: "customer",
            text: "I need urgent resolution for our wedding reception.",
            sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        raisedBy: arjun._id,
        raisedByRole: "organizer",
        againstUser: paromita._id,
        type: "payment_issue",
        title: "Advance not received from customer",
        description:
          "Customer confirmed booking but advance payment has not reflected in our account for 5 days.",
        status: "under_review",
        priority: "medium",
        adminNotes: "Checking with payment gateway",
        messages: [
          {
            sender: arjun._id,
            senderRole: "organizer",
            text: "Urgently need resolution",
            sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            sender: adminUser._id,
            senderRole: "admin",
            text: "We are investigating this matter",
            sentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        raisedBy: rahul._id,
        raisedByRole: "customer",
        type: "refund_request",
        title: "Refund not processed after cancellation",
        description: "Booking was cancelled two weeks ago but refund has not been credited.",
        status: "resolved",
        priority: "low",
        resolution: {
          text: "Refund of ₹15,000 processed to original payment method",
          resolvedBy: adminUser._id,
          resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          refundAmount: 15000,
        },
      },
    ]);
    console.log("✓ Disputes seeded");
  }

  if ((await PlatformNotification.countDocuments()) === 0) {
    await PlatformNotification.insertMany([
      {
        title: "EventMitra Summer Sale 🎉",
        message: "Get 15% off on all venue bookings this June!",
        type: "promo",
        targetRole: "customer",
        promoCode: "SUMMER15",
        promoDiscount: 15,
        promoExpiresAt: new Date("2026-06-30"),
        sentBy: adminUser._id,
        recipientCount: 45,
        isActive: true,
      },
      {
        title: "New Organizer Verification Feature",
        message:
          "Organizers can now submit KYC documents directly through the app for faster verification.",
        type: "announcement",
        targetRole: "organizer",
        sentBy: adminUser._id,
        recipientCount: 12,
        isActive: true,
      },
    ]);
    console.log("✓ Platform notifications seeded");
  }

  if ((await AdminAuditLog.countDocuments()) === 0) {
    await AdminAuditLog.insertMany([
      {
        admin: adminUser._id,
        action: "venue_approved",
        targetType: "venue",
        description: "Approved venue listing: The Grand Mehta Banquet",
        targetRef: "The Grand Mehta Banquet",
      },
      {
        admin: adminUser._id,
        action: "kyc_approved",
        targetType: "kyc",
        description: "Approved KYC for organizer: Mehta Events",
        targetRef: "Mehta Events",
      },
      {
        admin: adminUser._id,
        action: "review_removed",
        targetType: "review",
        description: "Removed inappropriate review from venue listing",
      },
      {
        admin: adminUser._id,
        action: "payout_paid",
        targetType: "payout",
        description: "Marked payout of ₹3,60,800 as paid to Mehta Events",
        targetRef: "Mehta Events",
      },
      {
        admin: adminUser._id,
        action: "notification_sent",
        targetType: "notification",
        description: "Sent Summer Sale promo to 45 customers",
        targetRef: "EventMitra Summer Sale",
      },
    ]);
    console.log("✓ Admin audit logs seeded");
  }
};
