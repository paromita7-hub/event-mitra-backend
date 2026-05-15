import { Router } from "express";
import { getSuggestions, searchAll } from "../controllers/search.controller";

const router = Router();

router.get("/", searchAll);
router.get("/suggestions", getSuggestions);

export default router;
