import Booking from "../models/Booking";
import Enquiry from "../models/Enquiry";
import Notification from "../models/Notification";
import OrganizerProfile from "../models/OrganizerProfile";
import Payout from "../models/Payout";
import PublicEvent from "../models/PublicEvent";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Venue from "../models/Venue";
import Wishlist from "../models/Wishlist";
import { calculateCommission } from "../utils/commission.utils";

export const seedBookings = async (): Promise<void> => {
  const users = await User.find().lean();
  const venues = await Venue.find().lean();
  const events = await PublicEvent.find().lean();
  const profiles = await OrganizerProfile.find().lean();

  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const venueByName = new Map(venues.map((venue) => [venue.name, venue]));
  const eventByTitle = new Map(events.map((event) => [event.title, event]));
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.user), profile]));

  const paromita = userByEmail.get("paromitaporel41@gmail.com");
  const arjun = userByEmail.get("arjun@mehtaevents.com");
  if (!paromita || !arjun) {
    return;
  }

  const bookings = [
    {
      venueName: "The Grand Mehta Banquet",
      eventType: "Wedding",
      eventDate: new Date("2026-06-15"),
      guestCount: 450,
      advancePaid: 36000,
      status: "confirmed" as const,
      specialRequests: "Needs extra floral decoration at the entry.",
      createdAt: new Date("2026-04-01"),
    },
    {
      venueName: "Skyline Terrace",
      eventType: "Birthday",
      eventDate: new Date("2026-05-20"),
      guestCount: 80,
      advancePaid: 20000,
      status: "pending_approval" as const,
      specialRequests: "Eggless cake and blue theme decorations.",
      createdAt: new Date("2026-04-15"),
    },
    {
      venueName: "Mehta Garden Villa",
      eventType: "Anniversary",
      eventDate: new Date("2026-05-12"),
      guestCount: 150,
      advancePaid: 75000,
      status: "confirmed" as const,
      specialRequests: "Live pianist during dinner.",
      createdAt: new Date("2026-03-20"),
    },
    {
      venueName: "Skyline Terrace",
      eventType: "Corporate Meet",
      eventDate: new Date("2026-04-05"),
      guestCount: 40,
      advancePaid: 65000,
      status: "completed" as const,
      specialRequests: "Projector and whiteboard required.",
      createdAt: new Date("2026-03-10"),
    },
    {
      venueName: "The Grand Mehta Banquet",
      eventType: "Engagement",
      eventDate: new Date("2026-06-25"),
      guestCount: 200,
      advancePaid: 0,
      status: "pending_approval" as const,
      specialRequests: "Traditional seating arrangement.",
      createdAt: new Date("2026-04-20"),
    },
    {
      venueName: "Mehta Garden Villa",
      eventType: "Destination Wedding",
      eventDate: new Date("2026-04-10"),
      guestCount: 300,
      advancePaid: 320000,
      status: "completed" as const,
      specialRequests: "Beach-side themed decor.",
      createdAt: new Date("2026-01-15"),
    },
    {
      venueName: "Skyline Terrace",
      eventType: "Farewell",
      eventDate: new Date("2026-04-30"),
      guestCount: 100,
      advancePaid: 0,
      status: "cancelled" as const,
      specialRequests: "None.",
      createdAt: new Date("2026-04-10"),
    },
    {
      venueName: "The Grand Mehta Banquet",
      eventType: "Reception",
      eventDate: new Date("2026-07-15"),
      guestCount: 500,
      advancePaid: 50000,
      status: "confirmed" as const,
      specialRequests: "Buffet style dining.",
      createdAt: new Date("2026-04-24"),
    },
  ];

  for (const item of bookings) {
    const venue = venueByName.get(item.venueName);
    if (!venue) continue;

    const pricing = calculateCommission(venue.pricePerEvent);
    const booking = await Booking.create({
      customer: paromita._id,
      organizer: venue.organizer,
      venue: venue._id,
      eventType: item.eventType,
      eventDate: item.eventDate,
      eventTime: "07:00 PM",
      guestCount: item.guestCount,
      specialRequests: item.specialRequests,
      pricing: {
        venueCharge: pricing.gross,
        addOns: 0,
        subtotal: pricing.gross,
        platformCommission: pricing.commission,
        organizerPayout: pricing.payout,
        totalAmount: pricing.gross,
      },
      payment: {
        advancePaid: item.advancePaid,
        balanceDue: Math.max(pricing.gross - item.advancePaid, 0),
        paymentStatus: item.advancePaid >= pricing.gross ? "paid" : item.advancePaid > 0 ? "partial" : "pending",
        paymentMethod: "bank_transfer",
      },
      status: item.status,
      cancellation:
        item.status === "cancelled"
          ? {
              cancelledBy: paromita._id,
              cancelledAt: new Date("2026-04-12"),
              reason: "Plans changed",
              refundAmount: 0,
            }
          : undefined,
      timeline: [
        { event: "Booking request created", timestamp: item.createdAt, actor: paromita._id },
        ...(item.status !== "pending_approval"
          ? [{ event: `Booking ${item.status}`, timestamp: new Date(item.createdAt.getTime() + 86400000), actor: arjun._id }]
          : []),
      ],
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    });

    if (item.status !== "cancelled") {
      await Venue.findByIdAndUpdate(venue._id, {
        $addToSet: { "availability.bookedDates": item.eventDate },
      });
    }
  }

  const tickets = [
    {
      eventTitle: "Mumbai Euphoria Music Night",
      ticketTypeName: "VIP",
      quantity: 2,
      status: "active" as const,
      createdAt: new Date("2026-04-18"),
    },
    {
      eventTitle: "Grand Buffet Gala - Summer Edition",
      ticketTypeName: "Standard",
      quantity: 3,
      status: "active" as const,
      createdAt: new Date("2026-04-19"),
    },
  ];

  for (const item of tickets) {
    const event = eventByTitle.get(item.eventTitle);
    if (!event) continue;
    const ticketType = event.ticketTypes.find((type: { name: string; price: number }) => type.name === item.ticketTypeName);
    if (!ticketType) continue;
    const pricing = calculateCommission(ticketType.price * item.quantity);
    const ticket = await Ticket.create({
      customer: paromita._id,
      publicEvent: event._id,
      organizer: event.organizer,
      ticketType: { name: ticketType.name, price: ticketType.price },
      quantity: item.quantity,
      totalAmount: pricing.gross,
      platformCommission: pricing.commission,
      organizerPayout: pricing.payout,
      status: item.status,
      qrCode: "PENDING",
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    });
    ticket.qrCode = ticket.ticketRef;
    await ticket.save();
  }

  const enquiries = [
    {
      customerEmail: "rahul.sharma@example.com",
      organizer: arjun._id,
      venueName: "Skyline Terrace",
      eventType: "Corporate Dinner",
      preferredDate: new Date("2026-06-10"),
      guestCount: 120,
      budgetMin: 80000,
      budgetMax: 100000,
      message: "Is Skyline Terrace available for a corporate dinner on 10 June?",
      status: "new" as const,
    },
    {
      customerEmail: "sonia.kapoor@example.com",
      organizer: arjun._id,
      venueName: "The Grand Mehta Banquet",
      eventType: "Sangeet",
      preferredDate: new Date("2026-11-24"),
      guestCount: 300,
      budgetMin: 200000,
      budgetMax: 300000,
      message: "Looking for a grand space for my sangeet. Do you have curated packages?",
      status: "replied" as const,
      replies: [
        {
          sender: arjun._id,
          senderRole: "organizer" as const,
          message: "Yes, we have 2 fully managed packages. Happy to share details on call.",
          sentAt: new Date("2026-04-25T16:00:00Z"),
        },
      ],
    },
    {
      customerEmail: "amit.verma@example.com",
      organizer: arjun._id,
      venueName: "Mehta Garden Villa",
      eventType: "Brunch",
      preferredDate: new Date("2026-05-15"),
      guestCount: 50,
      budgetMin: 40000,
      budgetMax: 60000,
      message: "Can we have a private brunch session at the Garden Villa?",
      status: "new" as const,
    },
  ];

  for (const item of enquiries) {
    const customer = userByEmail.get(item.customerEmail);
    const venue = venueByName.get(item.venueName);
    if (!customer || !venue) continue;
    await Enquiry.create({
      customer: customer._id,
      organizer: item.organizer,
      venue: venue._id,
      eventType: item.eventType,
      preferredDate: item.preferredDate,
      guestCount: item.guestCount,
      budgetMin: item.budgetMin,
      budgetMax: item.budgetMax,
      message: item.message,
      status: item.status,
      replies: item.replies ?? [],
    });
  }

  const arjunProfile = profileByUserId.get(String(arjun._id));
  await Payout.insertMany([
    {
      organizer: arjun._id,
      period: "March 2026",
      periodStart: new Date("2026-03-01"),
      periodEnd: new Date("2026-03-31"),
      bookings: [],
      tickets: [],
      grossRevenue: 410000,
      platformCommission: 49200,
      netPayout: 360800,
      status: "paid",
      paidAt: new Date("2026-04-03"),
      bankSnapshot: {
        bankName: arjunProfile?.bankAccount?.bankName || "HDFC Bank",
        last4: arjunProfile?.bankAccount?.last4 || "4521",
      },
    },
    {
      organizer: arjun._id,
      period: "April 2026",
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-04-30"),
      bookings: [],
      tickets: [],
      grossRevenue: 320000,
      platformCommission: 38400,
      netPayout: 281600,
      status: "processing",
      bankSnapshot: {
        bankName: arjunProfile?.bankAccount?.bankName || "HDFC Bank",
        last4: arjunProfile?.bankAccount?.last4 || "4521",
      },
    },
    {
      organizer: arjun._id,
      period: "May 2026 (Partial)",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      bookings: [],
      tickets: [],
      grossRevenue: 120000,
      platformCommission: 14400,
      netPayout: 105600,
      status: "upcoming",
      bankSnapshot: {
        bankName: arjunProfile?.bankAccount?.bankName || "HDFC Bank",
        last4: arjunProfile?.bankAccount?.last4 || "4521",
      },
    },
  ]);

  await Wishlist.create({
    customer: paromita._id,
    venues: [venueByName.get("The Grand Mehta Banquet")?._id, venueByName.get("Heritage Palace Courtyard")?._id].filter(Boolean),
    events: [eventByTitle.get("Mumbai Euphoria Music Night")?._id].filter(Boolean),
    updatedAt: new Date(),
  });

  await Notification.insertMany([
    {
      recipient: arjun._id,
      type: "new_booking",
      title: "New Booking Received",
      message: "Paromita Porel requested The Grand Mehta Banquet for 15 Jun 2026.",
      data: {},
      isRead: false,
      actionRoute: "/organizer/bookings",
    },
    {
      recipient: arjun._id,
      type: "new_enquiry",
      title: "New Enquiry",
      message: "Rahul Sharma sent an enquiry for Skyline Terrace.",
      data: {},
      isRead: false,
      actionRoute: "/organizer/enquiries",
    },
    {
      recipient: arjun._id,
      type: "payout_processed",
      title: "Payout Processed",
      message: "Your payout of ₹3,60,800 for March 2026 has been deposited.",
      data: {},
      isRead: true,
      actionRoute: "/organizer/payouts",
    },
    {
      recipient: paromita._id,
      type: "booking_confirmed",
      title: "Booking Confirmed",
      message: "Your booking at The Grand Mehta Banquet has been confirmed.",
      data: {},
      isRead: false,
      actionRoute: "/(tabs)/bookings",
    },
    {
      recipient: paromita._id,
      type: "ticket_purchased",
      title: "Tickets Confirmed",
      message: "Your Mumbai Euphoria Music Night tickets are ready.",
      data: {},
      isRead: false,
      actionRoute: "/(tabs)/tickets",
    },
  ]);
};
