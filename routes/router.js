import { Router } from "express";
import { isAuth, isAnonymous } from "../config/passport.js";
import express from "express";
import {
	getLogin,
	postLogin,
	getSignup,
	postSignup,
} from "../controllers/authentication.js";

export const router = Router();

router.get("/", isAuth, (req, res) => res.render("index", { title: "xDrive" }));

router.get("/signup", isAnonymous, getSignup);
router.post("/signup", isAnonymous, postSignup);

router.get("/login", isAnonymous, getLogin);
router.post("/login", isAnonymous, postLogin);
