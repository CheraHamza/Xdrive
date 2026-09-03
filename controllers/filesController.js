import { prisma } from "../lib/prisma.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { addDays, addHours, addMinutes, format } from "date-fns";
import {
	formatSharingDetails,
	getFileDownloadName,
	redirectWithToast,
} from "./commonController.js";
import {
	verifyFileOwnership,
	verifyFolderOwnership,
	getFileForDownload,
} from "../middleware/authorizationHelpers.js";
import {
	validateFileName,
	validateShareSettings,
	runValidation,
} from "../middleware/validators.js";

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

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 100 * 1024 * 1024, // 100MB max
	},
	fileFilter: (req, file, cb) => {
		// Allow all file types for now
		cb(null, true);
	},
});

export const postUpload = [
	upload.single("file"),
	async (req, res, next) => {
		try {
			if (!req.file) {
				return res.status(400).redirect("/");
			}

			const rootFolderId = "root_" + req.user.id;
			const currentFolderId = req.body.currentFolderId || rootFolderId;

			// Verify folder exists and belongs to user
			const folder = await verifyFolderOwnership(currentFolderId, req.user.id);
			if (!folder) {
				// Delete uploaded file if folder verification fails
				try {
					await fs.promises.unlink(req.file.path);
				} catch (err) {
					console.error("Failed to cleanup file:", err);
				}
				return redirectWithToast(req, res, "Invalid folder", "error");
			}

			const fileSizeValidation = validateFileSize(req.file.size);
			if (!fileSizeValidation.valid) {
				try {
					await fs.promises.unlink(req.file.path);
				} catch (err) {
					console.error("Failed to cleanup file:", err);
				}
				return redirectWithToast(req, res, fileSizeValidation.error, "error");
			}

			const {
				originalname,
				filename,
				mimetype,
				size,
				path: filePath,
			} = req.file;

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
				const documentExtensions = ["doc", "docx", "odt", "rtf", "txt", "md"];
				const spreadsheetExtensions = ["xls", "xlsx", "csv", "ods"];
				const presentationExtensions = ["ppt", "pptx", "odp"];
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

			const storagePath = filePath.substring(filePath.indexOf("files"));

			await prisma.file.create({
				data: {
					name: originalname,
					filename: filename,
					type: fileType(),
					uploadedAt: new Date(),
					path: storagePath,
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
		} catch (err) {
			return next(err);
		}
	},
];

export const starFile = async (req, res, next) => {
	try {
		const fileId = req.body.itemId;
		const starred = req.body.starred === "true";

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return redirectWithToast(
				req,
				res,
				"File not found or unauthorized",
				"error",
			);
		}

		const nextStarred = !starred;

		await prisma.file.update({
			where: { id: fileId },
			data: {
				starred: nextStarred,
			},
		});

		return redirectWithToast(
			req,
			res,
			nextStarred ? "File starred" : "File unstarred",
			"success",
		);
	} catch (err) {
		return next(err);
	}
};

export const downloadFile = async (req, res, next) => {
	try {
		const fileId = req.body.fileId || req.body.itemId;

		if (!fileId) {
			return res.status(400).json({ error: "File ID is required" });
		}

		// Get file from database (not from request) and verify ownership
		const file = await getFileForDownload(fileId, req.user.id);
		if (!file) {
			return res.status(404).json({ error: "File not found or unauthorized" });
		}

		const filePath = file.path;

		// Verify file exists on disk
		if (!fs.existsSync(filePath)) {
			return res.status(404).json({ error: "File not found on server" });
		}

		res.download(filePath, getFileDownloadName(file), (err) => {
			if (err) {
				if (!res.headersSent) {
					return res.status(500).json({ error: "Download failed" });
				}
				console.error("Download error:", err);
			}
		});
	} catch (err) {
		return next(err);
	}
};

export const renameFile = async (req, res, next) => {
	try {
		const fileId = req.body.itemId;
		const newFileName = req.body.name;

		const nameValidation = validateFileName(newFileName);
		if (!nameValidation.valid) {
			return res.status(400).json({
				success: false,
				errors: { name: [nameValidation.error] },
			});
		}

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return redirectWithToast(
				req,
				res,
				"File not found or unauthorized",
				"error",
			);
		}

		const originalExtension = path.extname(file.filename || file.path || "");
		const trimmedName = newFileName.trim();
		const displayName =
			originalExtension &&
			trimmedName.toLowerCase().endsWith(originalExtension.toLowerCase())
				? trimmedName.slice(0, -originalExtension.length).trim()
				: trimmedName;

		if (!displayName) {
			return res.status(400).json({
				success: false,
				errors: { name: ["File name cannot be empty"] },
			});
		}

		await prisma.file.update({
			where: { id: fileId },
			data: {
				name: displayName,
			},
		});

		return redirectWithToast(req, res, "File renamed", "success");
	} catch (err) {
		return next(err);
	}
};

export const moveFile = async (req, res, next) => {
	try {
		const fileId = req.body.itemId;
		const destinationFolderId = req.body.destinationFolderId;

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return redirectWithToast(
				req,
				res,
				"File not found or unauthorized",
				"error",
			);
		}

		// Verify destination folder exists and belongs to user
		const destinationFolder = await verifyFolderOwnership(
			destinationFolderId,
			req.user.id,
		);
		if (!destinationFolder) {
			return redirectWithToast(
				req,
				res,
				"Destination folder not found or unauthorized",
				"error",
			);
		}

		await prisma.file.update({
			where: { id: fileId },
			data: { folderId: destinationFolderId },
		});

		return redirectWithToast(req, res, "File moved", "success");
	} catch (err) {
		return next(err);
	}
};

export const getFileDetailsById = async (req, res, next) => {
	try {
		const itemId = req.params.id;

		const file = await prisma.file.findUnique({
			where: { id: itemId },
			include: { folder: true, user: true },
		});

		if (!file || file.userId !== req.user.id) {
			return res.status(403).json({ error: "File not found or unauthorized" });
		}

		const details = {};

		details.name = file.name;
		details.type = file.type;
		details.time = format(new Date(file.uploadedAt), "dd MMM yyyy HH:mm:ss");
		details.size = (file.size / (1024 * 1024)).toFixed(2);
		details.location = file.folder.name;
		details.owner = file.user.id === req.user.id ? "Me" : file.user.name;

		res.json({ success: true, details });
	} catch (err) {
		return next(err);
	}
};

export const trashFile = async (req, res, next) => {
	try {
		const fileId = req.body.itemId;

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return redirectWithToast(
				req,
				res,
				"File not found or unauthorized",
				"error",
			);
		}

		await prisma.file.update({
			where: { id: fileId },
			data: { trashed: true },
		});

		return redirectWithToast(req, res, "File moved to trash", "success");
	} catch (err) {
		return next(err);
	}
};

export const restoreFile = async (req, res, next) => {
	try {
		const fileId = req.body.itemId;

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return redirectWithToast(
				req,
				res,
				"File not found or unauthorized",
				"error",
			);
		}

		await prisma.file.update({
			where: { id: fileId },
			data: { trashed: false },
		});

		return redirectWithToast(req, res, "File restored", "success");
	} catch (err) {
		return next(err);
	}
};

export async function permanentlyDeleteFile(fileId, userId) {
	const file = await prisma.file.findUnique({
		where: { id: fileId },
	});

	// Verify ownership
	if (!file || file.userId !== userId) {
		throw new Error("File not found or unauthorized");
	}

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
	try {
		const fileId = req.body.itemId;

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return redirectWithToast(
				req,
				res,
				"File not found or unauthorized",
				"error",
			);
		}

		await permanentlyDeleteFile(fileId, req.user.id);

		return redirectWithToast(req, res, "File deleted", "success");
	} catch (err) {
		return next(err);
	}
};

export const getFileSharingDetails = async (req, res, next) => {
	try {
		const fileId = req.params.id;

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return res.status(403).json({ error: "File not found or unauthorized" });
		}

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
	try {
		const validation = await runValidation(req, validateShareSettings);
		if (!validation.success) return res.status(400).json(validation);

		const fileId = req.body.itemId;
		const { access, duration, days = 0, hours = 0, minutes = 0 } = req.body;

		// Verify file exists and belongs to user
		const file = await verifyFileOwnership(fileId, req.user.id);
		if (!file) {
			return res.status(403).json({ error: "File not found or unauthorized" });
		}

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

		res.json({
			success: true,
			message: access === "PUBLIC" ? "File shared" : "Share settings updated",
		});
	} catch (err) {
		return next(err);
	}
};
