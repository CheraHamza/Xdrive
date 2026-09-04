import { prisma } from "../lib/prisma.js";
import { supabase } from "../lib/supabase.js";
import multer from "multer";
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
	validateFileSize,
	validateShareSettings,
	runValidation,
} from "../middleware/validators.js";
import { MAX_FILE_SIZE, STORAGE_LIMIT } from "../config/limits.js";

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: MAX_FILE_SIZE,
	},
	fileFilter: (_req, _file, cb) => {
		cb(null, true);
	},
});

function handleUploadError(error, req, res, next) {
	if (!error) return next();

	if (error.code === "LIMIT_FILE_SIZE") {
		return redirectWithToast(
			req,
			res,
			"File is too large. Each file must be 5 MB or smaller.",
			"error",
		);
	}

	return next(error);
}

const getFileType = (mimetype, originalname) => {
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

	if (mainType === "image") return "image";
	if (mainType === "audio") return "audio";
	if (mainType === "video") return "movie";
	if (extension === "pdf") return "pdf";
	if (spreadsheetExtensions.includes(extension)) return "spreadsheet";
	if (presentationExtensions.includes(extension)) return "presentation";
	if (codeExtensions.includes(extension)) return "code";
	if (documentExtensions.includes(extension) || mainType === "text")
		return "document";
	if (archiveExtensions.includes(extension)) return "zip";

	return "other";
};

export const postUpload = [
	upload.single("file"),
	handleUploadError,
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
				return redirectWithToast(req, res, "Invalid folder", "error");
			}

			const fileSizeValidation = validateFileSize(req.file.size, MAX_FILE_SIZE);
			if (!fileSizeValidation.valid) {
				return redirectWithToast(req, res, fileSizeValidation.error, "error");
			}

			const { originalname, mimetype, size } = req.file;
			const safeFileName = `${Date.now()}-${originalname.replace(/\s+/g, "_")}`;
			const storagePath = `${req.user.id}/${safeFileName}`;
			const storage = await prisma.file.aggregate({
				_sum: { size: true },
				where: { userId: req.user.id },
			});
			const usedBytes = storage._sum.size || 0;
			if (usedBytes + size > STORAGE_LIMIT) {
				const remainingBytes = Math.max(STORAGE_LIMIT - usedBytes, 0);
				const remainingMb = (remainingBytes / (1024 * 1024)).toFixed(2);
				return redirectWithToast(
					req,
					res,
					`Not enough storage space. You have ${remainingMb} MB remaining.`,
					"error",
				);
			}

			const { error: uploadError } = await supabase.storage
				.from("user-uploads")
				.upload(storagePath, req.file.buffer, {
					contentType: mimetype,
					upsert: false,
				});
			if (uploadError) throw uploadError;

			try {
				await prisma.file.create({
					data: {
						name: originalname,
						filename: safeFileName,
						type: getFileType(mimetype, originalname),
						uploadedAt: new Date(),
						path: storagePath,
						size,
						user: { connect: { id: req.user.id } },
						folder: { connect: { id: currentFolderId } },
					},
				});
			} catch (error) {
				await supabase.storage.from("user-uploads").remove([storagePath]);
				throw error;
			}

			return redirectWithToast(req, res, "File uploaded", "success");
		} catch (err) {
			if (
				err?.status === 413 ||
				err?.statusCode === 413 ||
				/size|quota|limit|payload/i.test(err?.message || "")
			) {
				return redirectWithToast(
					req,
					res,
					"The upload was rejected because the file is too large or exceeds your storage limit.",
					"error",
				);
			}
			return next(err);
		}
	},
];

export const openFile = async (req, res, next) => {
	try {
		const fileId = req.params.id;
		const file = await getFileForDownload(fileId, req.user.id);
		if (!file) {
			return res.status(404).json({ error: "File not found or unauthorized" });
		}

		const { data, error } = await supabase.storage
			.from("user-uploads")
			.createSignedUrl(file.path, 60);

		if (error || !data) {
			return res.status(404).json({ error: "File not found in storage" });
		}

		return res.redirect(data.signedUrl);
	} catch (err) {
		return next(err);
	}
};

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

		const { data, error } = await supabase.storage
			.from("user-uploads")
			.download(file.path);

		if (error || !data) {
			return res.status(404).json({ error: "File not found in storage" });
		}

		const arrayBuffer = await data.arrayBuffer();

		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${getFileDownloadName(file)}"`,
		);
		res.setHeader("Content-Type", "application/octet-stream");

		return res.send(Buffer.from(arrayBuffer));
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

		const trimmedName = newFileName.trim();

		if (!trimmedName) {
			return res.status(400).json({
				success: false,
				errors: { name: ["File name cannot be empty"] },
			});
		}

		await prisma.file.update({
			where: { id: fileId },
			data: {
				name: trimmedName,
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

	const { error } = await supabase.storage
		.from("user-uploads")
		.remove([file.path]);

	if (error) {
		throw new Error(`Failed to delete file from storage: ${error.message}`);
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
		if (err?.message?.toLowerCase().includes("storage")) {
			return redirectWithToast(
				req,
				res,
				"File could not be deleted from storage. Try again.",
				"error",
			);
		}
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
