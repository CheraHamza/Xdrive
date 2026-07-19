import express from "express";
import { prisma } from "../lib/prisma.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { format } from "date-fns";

const __direname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const userId = req.user.id;

		const uploadPath = path.join(__direname, `../files/users/${userId}`);

		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}

		cb(null, uploadPath);
	},
	filename: (req, file, cb) => {
		const uniquePrefix = Date.now() + "-";
		cb(null, uniquePrefix + file.originalname);
	},
});

const upload = multer({ storage: storage });

export const postUpload = [
	upload.single("file"),
	async (req, res, next) => {
		if (!req.file) {
			res.status(400).redirect("/");
		}

		const rootFolderId = "root_" + req.user.id;
		const currentFolderId = req.params.folderId || rootFolderId;

		const { originalname, filename, mimetype, size, path } = req.file;

		const fileType = () => {
			const mainType = mimetype.split("/")[0];
			const extension = originalname
				.substring(originalname.lastIndexOf(".") + 1)
				.toLowerCase();
			const archiveExtensions = [
				"zip",
				"rar",
				"7z",
				"tar",
				"gz",
				"tgz",
				"bz2",
				"xz",
			];

			if (mainType === "image") {
				return "image";
			}

			if (mainType === "video") {
				return "movie";
			}

			if (archiveExtensions.includes(extension)) {
				return "zip";
			}

			return "other";
		};

		const filePath = path.substring(path.indexOf("files"));

		await prisma.file.create({
			data: {
				name: originalname,
				filename: filename,
				type: fileType(),
				uploadedAt: new Date(),
				path: filePath,
				size: size,
				user: {
					connect: { id: req.user.id },
				},
				folder: {
					connect: { id: currentFolderId },
				},
			},
		});

		res.status(200).redirect("/");
	},
];

export const starFile = async (req, res, next) => {
	const fileId = req.body.itemId;
	const starred = req.body.starred === "true";

	await prisma.file.update({
		where: { id: fileId },
		data: {
			starred: !starred,
		},
	});

	res.redirect(req.get("Referrer") || "/");
};

export const downloadFile = async (req, res, next) => {
	const filePath = req.body.filePath;
	const fileName = req.body.fileName;

	res.download(filePath, fileName, (err) => {
		if (err) {
			if (!res.headersSent) {
				return res.status(404).send({ message: "File not found." });
			}
		}
	});
};

export const renameFile = async (req, res, next) => {
	const fileId = req.body.itemId;
	const newFileName = req.body.name;

	await prisma.file.update({
		where: { id: fileId },
		data: {
			name: newFileName,
		},
	});

	res.redirect(req.get("Referrer") || "/");
};

export const moveFile = async (req, res, next) => {
	const fileId = req.body.itemId;
	const destinationFolderId = req.body.destinationFolderId;

	await prisma.file.update({
		where: { id: fileId },
		data: { folderId: destinationFolderId },
	});

	res.redirect(req.get("Referrer") || "/");
};

export const getFileDetailsById = async (req, res, next) => {
	const itemId = req.params.id;

	const details = {};

	const file = await prisma.file.findUnique({
		where: { id: itemId },
		include: { folder: true, user: true },
	});

	details.name = file.name;
	details.type = file.type;
	details.time = format(new Date(file.uploadedAt), "dd MMM yyyy HH:mm:ss");
	details.size = (file.size / (1024 * 1024)).toFixed(2);
	details.location = file.folder.name;
	details.owner = file.user.id === req.user.id ? "Me" : folder.user.name;

	res.json({ success: true, details });
};
