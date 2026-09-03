import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import passport from "passport";
import {
	validateSignup,
	validateLogin,
	runValidation,
} from "../middleware/validators.js";

export const getSignup = async (req, res) => {
	res.render("sign-up", { title: "Sign up" });
};

export const postSignup = async (req, res, next) => {
	try {
		const validation = await runValidation(req, validateSignup);
		if (!validation.success) {
			return res.status(400).render("sign-up", {
				title: "Sign up",
				errors: validation.errors,
				previousValues: req.body,
			});
		}

		const { name, email, password } = req.body;

		const hashedPassword = await bcrypt.hash(password, 10);

		await prisma.user.create({
			data: {
				name: name,
				email: email,
				password: hashedPassword,
			},
		});

		res.redirect("/login");
	} catch (err) {
		return next(err);
	}
};

export const getLogin = async (req, res) => {
	res.render("login", { title: "Log in" });
};

export const postLogin = async (req, res, next) => {
	try {
		const validation = await runValidation(req, validateLogin);

		if (!validation.success) {
			return res.status(400).render("login", {
				title: "Log in",
				errors: validation.errors,
				previousValues: { email: req.body.email },
			});
		}

		passport.authenticate("local", (err, user, info) => {
			if (err) return next(err);

			if (!user) {
				const errors = {};

				if (info?.field && info?.message) {
					errors[info.field] = [info.message];
				}

				return res.status(401).render("login", {
					title: "Log in",
					errors,
					previousValues: { email: req.body.email },
				});
			}

			req.logIn(user, (loginErr) => {
				if (loginErr) return next(loginErr);
				return res.redirect("/");
			});
		})(req, res, next);
	} catch (err) {
		return next(err);
	}
};

export const postLogout = (req, res, next) => {
	req.logout((err) => {
		if (err) {
			return next(err);
		}
		res.redirect("/");
	});
};
