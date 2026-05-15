import PublicEvent from "../models/PublicEvent";
import User from "../models/User";
import Venue from "../models/Venue";
import OrganizerProfile from "../models/OrganizerProfile";

export const seedEvents = async (): Promise<void> => {
  const organizers = await User.find({ role: "organizer" }).lean();
  const profiles = await OrganizerProfile.find().lean();
  const venues = await Venue.find().lean();

  const userByEmail = new Map(organizers.map((user) => [user.email, user]));
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const venueByName = new Map(venues.map((venue) => [venue.name, venue]));

  const events = [
    {
      organizerEmail: "arjun@mehtaevents.com",
      venueName: "Skyline Terrace",
      title: "Mumbai Euphoria Music Night",
      description: "A high-energy music night with guest DJs, LED visuals, and rooftop city views.",
      category: "Concert" as const,
      coverImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-05-15"),
      startTime: "08:00 PM",
      endTime: "11:30 PM",
      ticketTypes: [
        { name: "General", price: 1499, totalSeats: 300, soldSeats: 210, available: true },
        { name: "VIP", price: 3999, totalSeats: 150, soldSeats: 72, available: true },
        { name: "Table for 6", price: 14999, totalSeats: 50, soldSeats: 15, available: true },
      ],
      totalRevenue: 806775,
      status: "published" as const,
      isFeatured: true,
      tags: ["music", "rooftop", "nightlife"],
    },
    {
      organizerEmail: "arjun@mehtaevents.com",
      venueName: "The Grand Mehta Banquet",
      title: "Grand Buffet Gala - Summer Edition",
      description: "A curated all-you-can-eat experience with live counters, chef demos, and family-friendly entertainment.",
      category: "Buffet Night" as const,
      coverImage: "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-06-22"),
      startTime: "12:30 PM",
      endTime: "04:00 PM",
      ticketTypes: [
        { name: "Standard", price: 2499, totalSeats: 200, soldSeats: 140, available: true },
        { name: "Premium", price: 4499, totalSeats: 100, soldSeats: 38, available: true },
      ],
      totalRevenue: 520862,
      status: "published" as const,
      isFeatured: true,
      tags: ["food", "buffet", "family"],
    },
    {
      organizerEmail: "arjun@mehtaevents.com",
      venueName: "The Grand Mehta Banquet",
      title: "Corporate Leadership Summit 2026",
      description: "A leadership and networking conference featuring keynote sessions, industry panels, and CXO meetups.",
      category: "Conference" as const,
      coverImage: "https://images.unsplash.com/photo-1475721027185-39a12947c004?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1475721027185-39a12947c004?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-07-10"),
      startTime: "09:00 AM",
      endTime: "05:00 PM",
      ticketTypes: [
        { name: "Delegate Pass", price: 5999, totalSeats: 150, soldSeats: 0, available: true },
        { name: "VIP Delegate", price: 11999, totalSeats: 50, soldSeats: 0, available: true },
      ],
      totalRevenue: 0,
      status: "draft" as const,
      tags: ["conference", "leadership", "networking"],
    },
    {
      organizerEmail: "naina@khannaweddings.in",
      venueName: "Regal Orchid Palace",
      title: "Delhi Sufi Sunset",
      description: "An intimate cultural evening blending live qawwali, fine dining, and a regal ambiance.",
      category: "Cultural Show" as const,
      coverImage: "https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-08-14"),
      startTime: "07:30 PM",
      endTime: "10:30 PM",
      ticketTypes: [
        { name: "General", price: 1299, totalSeats: 280, soldSeats: 160, available: true },
        { name: "Royal Lounge", price: 4999, totalSeats: 80, soldSeats: 34, available: true },
      ],
      totalRevenue: 376646,
      status: "published" as const,
      tags: ["sufi", "culture", "dining"],
    },
    {
      organizerEmail: "raghav@raoevents.com",
      venueName: "Tech Convention Center",
      title: "Future Builders Expo",
      description: "A full-day innovation expo with startup booths, investor lounges, and keynote launches.",
      category: "Conference" as const,
      coverImage: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-09-18"),
      startTime: "10:00 AM",
      endTime: "06:00 PM",
      ticketTypes: [
        { name: "Expo Pass", price: 999, totalSeats: 600, soldSeats: 310, available: true },
        { name: "Founder Lounge", price: 4999, totalSeats: 80, soldSeats: 28, available: true },
      ],
      totalRevenue: 449662,
      status: "published" as const,
      isFeatured: true,
      tags: ["startup", "expo", "tech"],
    },
    {
      organizerEmail: "fatima@goavibes.in",
      venueName: "Beachside Cabana",
      title: "Goa Neon Beach Bash",
      description: "An all-night neon party with headliner DJs, fire acts, and premium table service.",
      category: "DJ Night" as const,
      coverImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-10-03"),
      startTime: "09:00 PM",
      endTime: "02:00 AM",
      ticketTypes: [
        { name: "General", price: 1999, totalSeats: 400, soldSeats: 250, available: true },
        { name: "VIP", price: 6999, totalSeats: 100, soldSeats: 52, available: true },
        { name: "Table for 4", price: 16000, totalSeats: 40, soldSeats: 11, available: true },
      ],
      totalRevenue: 958948,
      status: "published" as const,
      isFeatured: true,
      tags: ["beach", "dj", "nightlife"],
    },
    {
      organizerEmail: "vikram@royaludaipur.com",
      venueName: "Heritage Palace Courtyard",
      title: "Royal Heritage New Year Soiree",
      description: "A curated royal New Year celebration with live fusion music, fireworks, and palace dining.",
      category: "New Year Party" as const,
      coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-12-31"),
      startTime: "08:00 PM",
      endTime: "01:00 AM",
      ticketTypes: [
        { name: "General", price: 2499, totalSeats: 500, soldSeats: 0, available: true },
        { name: "Royal VIP", price: 9999, totalSeats: 120, soldSeats: 0, available: true },
      ],
      totalRevenue: 0,
      status: "draft" as const,
      tags: ["newyear", "royal", "palace"],
    },
    {
      organizerEmail: "fatima@goavibes.in",
      venueName: "Sunset Palm Deck",
      title: "Sunset Buffet Carnival",
      description: "A seasonal buffet carnival with acoustic music, curated cocktails, and sunset tables.",
      category: "Buffet Night" as const,
      coverImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop",
      images: [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop",
      ],
      date: new Date("2026-03-20"),
      startTime: "06:30 PM",
      endTime: "10:30 PM",
      ticketTypes: [
        { name: "Entry", price: 799, totalSeats: 220, soldSeats: 184, available: false },
        { name: "Premium Table", price: 8500, totalSeats: 20, soldSeats: 16, available: false },
      ],
      totalRevenue: 282016,
      status: "completed" as const,
      tags: ["buffet", "sunset", "acoustic"],
    },
  ];

  for (const item of events) {
    const organizer = userByEmail.get(item.organizerEmail);
    const venue = venueByName.get(item.venueName);
    if (!organizer || !venue) {
      continue;
    }
    const organizerProfile = profileByUserId.get(String(organizer._id));
    await PublicEvent.create({
      organizer: organizer._id,
      organizerProfile: organizerProfile?._id,
      venue: venue._id,
      title: item.title,
      description: item.description,
      category: item.category,
      coverImage: item.coverImage,
      images: item.images,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      city: venue.city,
      venueName: venue.name,
      venueAddress: venue.address,
      ticketTypes: item.ticketTypes,
      totalRevenue: item.totalRevenue,
      status: item.status,
      isFeatured: item.isFeatured ?? false,
      tags: item.tags,
      publishedAt: item.status === "published" ? new Date("2026-04-15") : undefined,
    });
  }
};
