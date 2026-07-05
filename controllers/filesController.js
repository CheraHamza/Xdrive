import express from "express";
import { prisma } from "../lib/prisma.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

		const { originalname, mimetype, size, path } = req.file;

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

export const getRoot = async (req, res, next) => {
	const rootId = "root_" + req.user.id;
	const rootFolder = await prisma.folder.upsert({
		where: {
			id: rootId,
		},
		update: {},
		create: {
			id: rootId,
			name: "root",
			createdAt: new Date(),
			user: { connect: { id: req.user.id } },
		},
		include: {
			files: true,
			children: true,
		},
	});

	rootFolder.files.forEach((file) => {
		const iconMap = {
			image: "image",
			movie: "movie",
			other: "draft",
			zip: "folder_zip",
		};

		file.icon = iconMap[file.type] || "draft";
	});

	console.log(rootFolder);

	res.render("home", {
		title: "Home",
		files: rootFolder.files,
		folders: rootFolder.children,
	});
};

export const starFile = async (req, res, next) => {
	const fileId = req.body.fileId;
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
	const fileID = req.body.fileID;
	const newFileName = req.body.filename;

	await prisma.file.update({
		where: { id: fileID },
		data: {
			name: newFileName,
		},
	});

	res.redirect(req.get("Referrer") || "/");
};

export const createFolder = async (req, res, next) => {
	const rootFolderId = "root_" + req.user.id;
	const currentFolderId = req.params.folderId || rootFolderId;

	const newFolderName = req.body.foldername;

	await prisma.folder.create({
		data: {
			name: newFolderName,
			createdAt: new Date(),
			user: { connect: { id: req.user.id } },
			parent: { connect: { id: currentFolderId } },
		},
	});

	res.redirect(req.get("Referrer") || "/");
};
