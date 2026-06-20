import { Router } from "express";
import { isAuth } from "../config/passport.js";
import express from "express";

export const router = Router();

router.get("/", isAuth, (req, res) => res.render("index", { title: "xDrive" }));

router.get("/login", (req, res) => res.render("login", { title: "Login" }));
