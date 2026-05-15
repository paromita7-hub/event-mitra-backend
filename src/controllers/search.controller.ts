import type { Request, Response } from "express";
import PublicEvent from "../models/PublicEvent";
import Venue from "../models/Venue";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePaginationParams } from "../utils/pagination.utils";

export const searchAll = asyncHandler(async (req: Request, res: Response) => {
  const { q = "", type = "all", city } = req.query;
  const query = String(q).trim();
  const { page, limit, skip } = parsePaginationParams(req.query);
  const regex = query ? new RegExp(query, "i") : null;

  const venueFilters: Record<string, unknown> = { status: "active" };
  const eventFilters: Record<string, unknown> = {
    status: "published",
    date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  };
  if (city) {
    venueFilters.city = new RegExp(String(city), "i");
    eventFilters.city = new RegExp(String(city), "i");
  }
  if (regex) {
    venueFilters.$or = [
      { name: regex },
      { description: regex },
      { city: regex },
      { eventTypes: regex },
      { tags: regex },
    ];
    eventFilters.$or = [
      { title: regex },
      { description: regex },
      { city: regex },
      { category: regex },
      { tags: regex },
    ];
  }

  const [venues, events] = await Promise.all([
    type === "events"
      ? Promise.resolve([])
      : Venue.find(venueFilters).sort({ isFeatured: -1, rating: -1 }).skip(skip).limit(limit).lean(),
    type === "venues"
      ? Promise.resolve([])
      : PublicEvent.find(eventFilters).sort({ isFeatured: -1, date: 1 }).skip(skip).limit(limit).lean(),
  ]);

  const totalResults = venues.length + events.length;
  res.json(
    ApiResponse.success(
      { venues, events, totalResults },
      "Search results fetched successfully",
      200,
      buildPaginationMeta(totalResults, page, limit),
    ),
  );
});

export const getSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const query = String(req.query.q ?? "").trim();
  if (query.length < 2) {
    res.json(ApiResponse.success({ suggestions: [] }, "Suggestions fetched successfully"));
    return;
  }

  const regex = new RegExp(query, "i");
  const [venues, events, cities] = await Promise.all([
    Venue.find({ status: "active", name: regex }).select("name").limit(5).lean(),
    PublicEvent.find({ status: "published", title: regex }).select("title").limit(5).lean(),
    Venue.find({ status: "active", city: regex }).select("city").limit(5).lean(),
  ]);

  const suggestions = Array.from(
    new Set([
      ...venues.map((venue) => venue.name),
      ...events.map((event) => event.title),
      ...cities.map((venue) => venue.city),
    ]),
  ).slice(0, 5);

  res.json(ApiResponse.success({ suggestions }, "Suggestions fetched successfully"));
});
