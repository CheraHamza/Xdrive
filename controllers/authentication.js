import { prisma } from "../lib/prisma.js";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import passport from "passport";

const alphabeticError = "must only contain alphabetic characters.";
const nameLengthError = "must be between 3 and 20 characters.";
const emailError = "please enter a valid email address.";

export const getSignup = async (req, res) => {
	res.render("sign-up", { title: "Sign up" });
};

const validateSignup = [
	body("name")
		.trim()
		.notEmpty()
		.withMessage("name is required.")
		.matches(/^[A-Za-z ]+$/)
		.withMessage("name " + alphabeticError)
		.isLength({ min: 3, max: 20 })
		.withMessage("name " + nameLengthError),

	body("email")
		.trim()
		.toLowerCase()
		.notEmpty()
		.withMessage("email is required.")
		.isEmail()
		.withMessage(emailError)
		.bail()
		.normalizeEmail()
		.custom(async (value) => {
			const emailInUse = await prisma.user.findUnique({
				where: { email: value },
			});

			if (emailInUse) {
				throw new Error("Email is already in use.");
			}

			return true;
		})
		.withMessage("Email is already in use."),

	body("password")
		.notEmpty()
		.withMessage("password is required.")
		.isStrongPassword({
			minLength: 8,
			minLowercase: 1,
			minUppercase: 1,
			minNumbers: 1,
			minSymbols: 1,
			returnScore: false,
		})
		.withMessage(
			"password must be at least 8 chars and include uppercase, lowercase, number, and symbol.",
		),

	body("confirm-password")
		.notEmpty()
		.withMessage("password is required.")
		.custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error("passwords do not match.");
			}
			return true;
		})
		.withMessage("passwords do not match."),
];

function groupValidationErrors(errors) {
	return errors.array().reduce((acc, { path, msg }) => {
		acc[path] = acc[path] || [];
		acc[path].push(msg);
		return acc;
	}, {});
}

export const postSignup = [
	validateSignup,
	async (req, res, next) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				const errorMsgs = groupValidationErrors(errors);

				return res.status(400).render("sign-up", {
					title: "Sign up",
					errors: errorMsgs,
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
	},
];

export const getLogin = async (req, res) => {
	res.render("login", { title: "Log in" });
};

const validateLogin = [
	body("email")
		.trim()
		.notEmpty()
		.withMessage("email is required.")
		.isEmail()
		.withMessage(emailError)
		.bail()
		.normalizeEmail(),

	body("password").notEmpty().withMessage("password is required."),
];

export const postLogin = [
	validateLogin,
	(req, res, next) => {
		try {
			const errors = validationResult(req);

			if (!errors.isEmpty()) {
				const errorMsgs = groupValidationErrors(errors);

				return res.status(400).render("login", {
					title: "Log in",
					errors: errorMsgs,
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
	},
];

export const postLogout = (req, res, next) => {
	req.logout((err) => {
		if (err) {
			return next(err);
		}
		res.redirect("/");
	});
};
