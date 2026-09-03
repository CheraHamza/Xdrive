import { body, validationResult } from "express-validator";
import { prisma } from "../lib/prisma.js";

const alphabeticError = "must only contain alphabetic characters.";
const nameLengthError = "must be between 3 and 20 characters.";
const emailError = "please enter a valid email address.";

export function groupValidationErrors(errors) {
	return errors.array().reduce((acc, { path, msg }) => {
		acc[path] = acc[path] || [];
		acc[path].push(msg);
		return acc;
	}, {});
}

export const validateSignup = [
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

			if (emailInUse) throw new Error("Email is already in use.");
			return true;
		}),

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

export const validateLogin = [
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

export const validateShareSettings = [
	body("access")
		.notEmpty()
		.withMessage("Access type is required")
		.isIn(["RESTRICTED", "PUBLIC"])
		.withMessage("Access type must be RESTRICTED or PUBLIC"),
	body("duration")
		.notEmpty()
		.withMessage("Duration is required")
		.isIn(["forever", "timed"])
		.withMessage("Duration must be 'forever' or 'timed'"),
	body("days")
		.if((value, { req }) => req.body.duration === "timed")
		.optional()
		.isInt({ min: 0, max: 365 })
		.withMessage("Days must be between 0 and 365"),
	body("hours")
		.if((value, { req }) => req.body.duration === "timed")
		.optional()
		.isInt({ min: 0, max: 23 })
		.withMessage("Hours must be between 0 and 23"),
	body("minutes")
		.if((value, { req }) => req.body.duration === "timed")
		.optional()
		.isInt({ min: 0, max: 59 })
		.withMessage("Minutes must be between 0 and 59"),
	body("duration").custom((value, { req }) => {
		if (req.body.duration !== "timed") return true;

		const days = Number(req.body.days) || 0;
		const hours = Number(req.body.hours) || 0;
		const minutes = Number(req.body.minutes) || 0;

		if (days === 0 && hours === 0 && minutes === 0) {
			throw new Error("Please set a duration of at least 1 minute");
		}

		return true;
	}),
];

export function validateFolderName(name) {
	if (!name || typeof name !== "string") {
		return { valid: false, error: "Folder name is required" };
	}

	const trimmedName = name.trim();
	if (!trimmedName) {
		return { valid: false, error: "Folder name cannot be empty" };
	}
	if (trimmedName.length > 255) {
		return {
			valid: false,
			error: "Folder name must be 255 characters or less",
		};
	}
	if (
		trimmedName.includes("..") ||
		trimmedName.includes("/") ||
		trimmedName.includes("\\")
	) {
		return { valid: false, error: "Folder name contains invalid characters" };
	}

	return { valid: true, error: null };
}

export function validateFileName(name) {
	if (!name || typeof name !== "string") {
		return { valid: false, error: "File name is required" };
	}

	const trimmedName = name.trim();
	if (!trimmedName) {
		return { valid: false, error: "File name cannot be empty" };
	}
	if (trimmedName.length > 255) {
		return { valid: false, error: "File name must be 255 characters or less" };
	}
	if (
		trimmedName.includes("..") ||
		trimmedName.includes("/") ||
		trimmedName.includes("\\")
	) {
		return { valid: false, error: "File name contains invalid characters" };
	}

	return { valid: true, error: null };
}

export function validateFileSize(size, maxSizeBytes = 100 * 1024 * 1024) {
	if (typeof size !== "number" || size < 0) {
		return { valid: false, error: "Invalid file size" };
	}

	if (size === 0) {
		return { valid: false, error: "File size cannot be empty" };
	}

	if (size > maxSizeBytes) {
		const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
		return { valid: false, error: `File size cannot exceed ${maxSizeMB}MB` };
	}

	return { valid: true, error: null };
}

export async function runValidation(req, validationRules) {
	await Promise.all(validationRules.map((validation) => validation.run(req)));

	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return {
			success: false,
			errors: groupValidationErrors(errors),
		};
	}

	return { success: true };
}
