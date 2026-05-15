import Review from "../models/Review";
import User from "../models/User";
import Venue from "../models/Venue";
import PublicEvent from "../models/PublicEvent";

export const seedReviews = async (): Promise<void> => {
  const users = await User.find().lean();
  const venues = await Venue.find().lean();
  const events = await PublicEvent.find().lean();

  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const venueByName = new Map(venues.map((venue) => [venue.name, venue]));
  const eventByTitle = new Map(events.map((event) => [event.title, event]));
  const arjun = userByEmail.get("arjun@mehtaevents.com");
  if (!arjun) {
    return;
  }

  const venueReviews = [
    {
      customerEmail: "rahul.sharma@example.com",
      venueName: "The Grand Mehta Banquet",
      rating: 5,
      text: "Everything was absolutely perfect. The decor, the service, and the food were beyond our expectations.",
      organizerReply: "Thank you so much, Rahul. It was a pleasure hosting your celebration.",
    },
    {
      customerEmail: "sonia.kapoor@example.com",
      venueName: "Skyline Terrace",
      rating: 4,
      text: "Great venue with a lovely skyline view. The AC could have been a bit stronger in the late afternoon.",
      organizerReply: "Thanks for the feedback, Sonia. We are already upgrading the cooling setup for summer events.",
    },
    {
      customerEmail: "amit.verma@example.com",
      venueName: "Mehta Garden Villa",
      rating: 3,
      text: "The venue is beautiful, but travel logistics were a bit tricky for some guests coming from the city.",
    },
    {
      customerEmail: "priya.mani@example.com",
      venueName: "The Grand Mehta Banquet",
      rating: 5,
      text: "Best reception experience ever. The staff were proactive and the whole flow felt premium.",
    },
    {
      customerEmail: "anjali.shah@example.com",
      venueName: "Skyline Terrace",
      rating: 4,
      text: "The terrace ambience was fantastic and the DJ timing worked really well for our crowd.",
    },
  ];

  for (const item of venueReviews) {
    const customer = userByEmail.get(item.customerEmail);
    const venue = venueByName.get(item.venueName);
    if (!customer || !venue) continue;

    await Review.create({
      customer: customer._id,
      organizer: arjun._id,
      venue: venue._id,
      entityType: "venue",
      rating: item.rating,
      text: item.text,
      organizerReply: item.organizerReply
        ? { text: item.organizerReply, repliedAt: new Date("2026-04-15") }
        : undefined,
    });
  }

  const event = eventByTitle.get("Mumbai Euphoria Music Night");
  const customer = userByEmail.get("karan.mehra@example.com");
  if (event && customer) {
    await Review.create({
      customer: customer._id,
      organizer: event.organizer,
      publicEvent: event._id,
      entityType: "event",
      rating: 5,
      text: "Amazing energy and crowd management. The VIP experience felt worth the premium.",
    });
  }
};
