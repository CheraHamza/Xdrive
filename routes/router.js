import { Router } from "express";
import { isAuth, isAnonymous } from "../config/passport.js";
import express from "express";
import {
	getLogin,
	postLogin,
	getSignup,
	postSignup,
	postLogout,
} from "../controllers/authentication.js";
import { getAllFiles, postUpload } from "../controllers/filesController.js";

export const router = Router();

router.get(["/", "/home"], isAuth, getAllFiles);

router.get("/signup", isAnonymous, getSignup);
router.post("/signup", isAnonymous, postSignup);

router.get("/login", isAnonymous, getLogin);
router.post("/login", isAnonymous, postLogin);

router.post("/logout", isAuth, postLogout);

router.post("/upload", isAuth, postUpload);
