import { prisma } from "../lib/prisma.js";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import passport from "passport";
import dotenv from "dotenv";

const alphabeticError = "must only contain alphabetic characters";
const nameLengthError = "must be between 3 and 20 characters.";
const emailError = "must be a valid email format.";

export const getSignup = async (req, res) => {
	res.render("sign-up", { title: "Sign up" });
};

const validateSignup = [
	body("name")
		.trim()
		.notEmpty()
		.withMessage("cannot be empty.")
		.matches(/^[A-Za-z ]+$/)
		.withMessage(alphabeticError)
		.isLength({ min: 3, max: 20 })
		.withMessage(nameLengthError),

	body("email")
		.trim()
		.toLowerCase()
		.notEmpty()
		.withMessage("cannot be empty.")
		.isEmail()
		.withMessage(emailError)
		.custom(async (value) => {
			const emailInUse = await prisma.user.findUnique({
				where: { email: value },
			});

			if (emailInUse) {
				throw new Error("Email already in use.");
			}

			return true;
		})
		.withMessage("Email already in use."),

	body("password")
		.trim()
		.notEmpty()
		.withMessage("cannot be empty")
		.isStrongPassword({
			minLength: 8,
			minLowercase: 1,
			minUppercase: 1,
			minNumbers: 1,
			minSymbols: 1,
			returnScore: false,
		})
		.withMessage(
			"must be at least 8 chars and include uppercase, lowercase, number, and symbol.",
		),

	body("confirm-password")
		.trim()
		.notEmpty()
		.withMessage("cannot be empty.")
		.custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error("passwords do not match.");
			}
			return true;
		})
		.withMessage("passwords do not match"),
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

				return res.status(400).render("signup", {
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

export const postLogin = (req, res, next) => {
	passport.authenticate("local", (err, user, info) => {
		if (err) return next(err);

		if (!user) {
			const authErrors = {};

			if (info?.field && info?.message) {
				authErrors[info.field] = [info.message];
			}

			console.log(authErrors);

			return res.status(401).render("login", {
				title: "Log in",
				authErrors,
				previousValues: { email: req.body.email || "" },
			});
		}

		req.logIn(user, (loginErr) => {
			if (loginErr) return next(loginErr);
			return res.redirect("/");
		});
	})(req, res, next);
};
