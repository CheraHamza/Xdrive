import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __direname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, path.join(__direname, "../uploads/"));
	},
	filename: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const upload = multer({ storage: storage });

export const postUpload = [
	upload.single("file"),
	(req, res, next) => {
		if (!req.file) {
			res.status(400).redirect("/");
		}

		res.status(200).redirect("/");
	},
];
