import { prisma } from "../lib/prisma.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
	addDays,
	addHours,
	addMinutes,
	format,
} from "date-fns";
import { formatSharingDetails, redirectWithToast } from "./commonController.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const userId = req.user.id;

		const uploadPath = path.resolve(__dirname, "../files/users", userId);

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
		const currentFolderId = req.body.currentFolderId || rootFolderId;

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
			const documentExtensions = [
				"doc",
				"docx",
				"odt",
				"rtf",
				"txt",
				"md",
			];
			const spreadsheetExtensions = [
				"xls",
				"xlsx",
				"csv",
				"ods",
			];
			const presentationExtensions = [
				"ppt",
				"pptx",
				"odp",
			];
			const codeExtensions = [
				"js",
				"jsx",
				"ts",
				"tsx",
				"json",
				"html",
				"css",
				"scss",
				"sass",
				"py",
				"java",
				"c",
				"cpp",
				"cs",
				"php",
				"sql",
				"xml",
				"yaml",
				"yml",
			];

			if (mainType === "image") {
				return "image";
			}

			if (mainType === "audio") {
				return "audio";
			}

			if (mainType === "video") {
				return "movie";
			}

			if (extension === "pdf") {
				return "pdf";
			}

			if (spreadsheetExtensions.includes(extension)) {
				return "spreadsheet";
			}

			if (presentationExtensions.includes(extension)) {
				return "presentation";
			}

			if (codeExtensions.includes(extension)) {
				return "code";
			}

			if (documentExtensions.includes(extension) || mainType === "text") {
				return "document";
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

		return redirectWithToast(req, res, "File uploaded", "success");
	},
];

export const starFile = async (req, res, next) => {
	const fileId = req.body.itemId;
	const starred = req.body.starred === "true";

	const nextStarred = !starred;

	await prisma.file.update({
		where: { id: fileId },
		data: {
			starred: nextStarred,
		},
	});

	return redirectWithToast(req, res, nextStarred ? "File starred" : "File unstarred", "success");
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

	return redirectWithToast(req, res, "File renamed", "success");
};

export const moveFile = async (req, res, next) => {
	const fileId = req.body.itemId;
	const destinationFolderId = req.body.destinationFolderId;

	await prisma.file.update({
		where: { id: fileId },
		data: { folderId: destinationFolderId },
	});

	return redirectWithToast(req, res, "File moved", "success");
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
	details.owner = file.user.id === req.user.id ? "Me" : file.user.name;

	res.json({ success: true, details });
};

export const trashFile = async (req, res, next) => {
	const fileId = req.body.itemId;

	await prisma.file.update({ where: { id: fileId }, data: { trashed: true } });

	return redirectWithToast(req, res, "File moved to trash", "success");
};

export const restoreFile = async (req, res, next) => {
	const fileId = req.body.itemId;

	await prisma.file.update({ where: { id: fileId }, data: { trashed: false } });

	return redirectWithToast(req, res, "File restored", "success");
};

export async function permanentlyDeleteFile(fileId) {
	const file = await prisma.file.findUnique({
		where: { id: fileId },
	});

	try {
		await fs.promises.unlink(file.path);
	} catch (err) {
		if (err.code !== "ENOENT") {
			console.error(`Failed to delete file on disk at ${file.path}:`, err);
		}
	}

	await prisma.file.delete({
		where: { id: fileId },
	});
}

export const deleteFile = async (req, res, next) => {
	const fileId = req.body.itemId;

	await permanentlyDeleteFile(fileId);

	return redirectWithToast(req, res, "File deleted", "success");
};

export const getFileSharingDetails = async (req, res, next) => {
	try {
		const fileId = req.params.id;

		const rawShare = await prisma.share.findUnique({
			where: { fileId: fileId },
		});

		const sharingDetails = await formatSharingDetails(rawShare, req);

		res.json({ success: true, sharingDetails });
	} catch (error) {
		next(error);
	}
};

export const shareFile = async (req, res, next) => {
	const fileId = req.body.itemId;
	const { access, duration, days = 0, hours = 0, minutes = 0 } = req.body;

	let expiresAt = null;

	if (access === "PUBLIC" && duration === "timed") {
		let now = new Date();

		const numDays = Number(days) || 0;
		const numHours = Number(hours) || 0;
		const numMinutes = Number(minutes) || 0;

		if (numDays > 0) now = addDays(now, numDays);
		if (numHours > 0) now = addHours(now, numHours);
		if (numMinutes > 0) now = addMinutes(now, numMinutes);

		// Only assign if at least one unit of duration was provided
		if (numDays > 0 || numHours > 0 || numMinutes > 0) {
			expiresAt = now;
		}
	}

	await prisma.share.upsert({
		where: { fileId: fileId },
		update: { access, expiresAt },
		create: { fileId: fileId, access, expiresAt },
	});

	res.json({ success: true, message: access === "PUBLIC" ? "File shared" : "Share settings updated" });
};
