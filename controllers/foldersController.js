import { prisma } from "../lib/prisma.js";
import { supabase } from "../lib/supabase.js";
import path from "path";
import { ZipArchive } from "archiver";
import { addDays, addHours, addMinutes, format } from "date-fns";
import {
	formatSharingDetails,
	getFileDownloadName,
	mapFileIcons,
	redirectWithToast,
} from "./commonController.js";
import {
	verifyFolderOwnership,
	verifyDestinationFolder,
} from "../middleware/authorizationHelpers.js";
import {
	validateFolderName,
	validateShareSettings,
	runValidation,
} from "../middleware/validators.js";

export const createFolder = async (req, res, next) => {
	try {
		const rootFolderId = "root_" + req.user.id;
		const currentFolderId = req.body.currentFolderId || rootFolderId;
		const newFolderName = req.body.foldername;
		const nameValidation = validateFolderName(newFolderName);
		if (!nameValidation.valid) {
			return res.status(400).json({
				success: false,
				errors: { foldername: [nameValidation.error] },
			});
		}

		// Verify parent folder exists and belongs to user
		const parentFolder = await verifyFolderOwnership(
			currentFolderId,
			req.user.id,
		);
		if (!parentFolder) {
			return redirectWithToast(req, res, "Invalid parent folder", "error");
		}

		await prisma.folder.create({
			data: {
				name: newFolderName.trim(),
				createdAt: new Date(),
				user: { connect: { id: req.user.id } },
				parent: { connect: { id: currentFolderId } },
			},
		});

		return redirectWithToast(req, res, "Folder created", "success");
	} catch (err) {
		return next(err);
	}
};

export const getFolder = async (req, res, next) => {
	try {
		const folderId = req.params.folderId;

		const folder = await prisma.folder.findUnique({
			where: { id: folderId },
			include: {
				files: { where: { trashed: false } },
				children: { where: { trashed: false } },
			},
		});

		// Verify folder exists and belongs to user
		if (!folder || folder.userId !== req.user.id) {
			return res
				.status(403)
				.render("error", { message: "Folder not found or unauthorized" });
		}

		const allFolders = await prisma.folder.findMany({
			where: { userId: req.user.id },
		});

		const folderMap = new Map(allFolders.map((f) => [f.id, f]));
		let currentFolder = folder;
		while (currentFolder) {
			if (currentFolder.trashed) {
				return res
					.status(404)
					.render("error", { message: "Folder not found or unavailable" });
			}
			currentFolder = currentFolder.parentId
				? folderMap.get(currentFolder.parentId)
				: null;
		}

		mapFileIcons(folder.files);

		const location = [];

		let currentId = folderId;

		while (currentId) {
			const currentFolder = folderMap.get(currentId);
			if (!currentFolder) break;

			location.unshift({
				name: currentFolder.name,
				url:
					currentFolder.id === `root_${req.user.id}`
						? "/"
						: `/folder/${currentFolder.id}`,
			});
			currentId = currentFolder.parentId;
		}

		res.render("index", {
			title: folder.name,
			files: folder.files,
			folders: folder.children,
			currentFolderId: folder.id,
			location,
		});
	} catch (err) {
		return next(err);
	}
};

export const starFolder = async (req, res, next) => {
	try {
		const folderId = req.body.itemId;
		const starred = req.body.starred === "true";

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return redirectWithToast(
				req,
				res,
				"Folder not found or unauthorized",
				"error",
			);
		}

		const nextStarred = !starred;

		await prisma.folder.update({
			where: { id: folderId },
			data: {
				starred: nextStarred,
			},
		});

		return redirectWithToast(
			req,
			res,
			nextStarred ? "Folder starred" : "Folder unstarred",
			"success",
		);
	} catch (err) {
		return next(err);
	}
};

const downloadFromSupabaseStorage = async (storagePath) => {
	const { data, error } = await supabase.storage
		.from("user-uploads")
		.download(storagePath);

	if (error || !data) {
		throw new Error("File not found in storage");
	}

	return Buffer.from(await data.arrayBuffer());
};

const addFolderToArchive = async (folderId, archive, currentPath = "") => {
	const folder = await prisma.folder.findUnique({
		where: { id: folderId },
		include: {
			files: true,
			children: true,
		},
	});

	if (!folder) return;

	for (const file of folder.files) {
		if (file.trashed) continue;

		try {
			const buffer = await downloadFromSupabaseStorage(file.path);
			archive.append(buffer, {
				name: path.join(currentPath, getFileDownloadName(file)),
			});
		} catch (err) {
			console.warn(
				`Skipping missing file in folder archive: ${file.path}`,
				err,
			);
		}
	}

	await Promise.all(
		folder.children.map((childFolder) => {
			const nextPath = path.join(currentPath, childFolder.name);
			return addFolderToArchive(childFolder.id, archive, nextPath);
		}),
	);
};

export const downloadFolder = async (req, res, next) => {
	try {
		const folderId = req.body.folderId;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return res.status(404).send("Folder not found or unauthorized");
		}

		res.attachment(`${folder.name}.zip`);

		const archive = new ZipArchive({ zlib: { level: 9 } });

		archive.pipe(res);

		await addFolderToArchive(folderId, archive, folder.name);

		await archive.finalize();
	} catch (error) {
		console.error("Nested zip download failed:", error);
		res.status(500).send("Could not download folder structure");
	}
};

export const renameFolder = async (req, res, next) => {
	try {
		const folderId = req.body.itemId;
		const newFolderName = req.body.name;
		const nameValidation = validateFolderName(newFolderName);
		if (!nameValidation.valid) {
			return res.status(400).json({
				success: false,
				errors: { name: [nameValidation.error] },
			});
		}

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return redirectWithToast(
				req,
				res,
				"Folder not found or unauthorized",
				"error",
			);
		}

		await prisma.folder.update({
			where: { id: folderId },
			data: {
				name: newFolderName.trim(),
			},
		});

		return redirectWithToast(req, res, "Folder renamed", "success");
	} catch (err) {
		return next(err);
	}
};

export const moveFolder = async (req, res, next) => {
	try {
		const folderId = req.body.itemId;
		const destinationFolderId = req.body.destinationFolderId;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return redirectWithToast(
				req,
				res,
				"Folder not found or unauthorized",
				"error",
			);
		}

		// Verify destination folder exists and belongs to user
		const destinationFolder = await verifyDestinationFolder(
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

		await prisma.folder.update({
			where: { id: folderId },
			data: { parentId: destinationFolderId },
		});

		return redirectWithToast(req, res, "Folder moved", "success");
	} catch (err) {
		return next(err);
	}
};

export const getFolderDetailsById = async (req, res, next) => {
	try {
		const itemId = req.params.id;

		const folder = await prisma.folder.findUnique({
			where: { id: itemId },
			include: { files: true, parent: true, user: true },
		});

		if (!folder || folder.userId !== req.user.id) {
			return res
				.status(403)
				.json({ error: "Folder not found or unauthorized" });
		}

		const details = {};

		details.name = folder.name;
		details.type = "Folder";
		details.time = format(new Date(folder.createdAt), "dd MMM yyyy HH:mm:ss");
		details.size = (
			folder.files.reduce((acc, file) => {
				return acc + file.size;
			}, 0) /
			(1024 * 1024)
		).toFixed(2);
		details.location = folder.parent.name;
		details.owner = folder.user.id === req.user.id ? "Me" : folder.user.name;

		res.json({ success: true, details });
	} catch (err) {
		return next(err);
	}
};

export const trashFolder = async (req, res, next) => {
	try {
		const folderId = req.body.itemId;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return redirectWithToast(
				req,
				res,
				"Folder not found or unauthorized",
				"error",
			);
		}

		await prisma.folder.update({
			where: { id: folderId },
			data: { trashed: true },
		});

		return redirectWithToast(req, res, "Folder moved to trash", "success");
	} catch (err) {
		return next(err);
	}
};

export const restoreFolder = async (req, res, next) => {
	try {
		const folderId = req.body.itemId;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return redirectWithToast(
				req,
				res,
				"Folder not found or unauthorized",
				"error",
			);
		}

		await prisma.folder.update({
			where: { id: folderId },
			data: { trashed: false },
		});

		return redirectWithToast(req, res, "Folder restored", "success");
	} catch (err) {
		return next(err);
	}
};

async function getNestedFolderData(folderId) {
	const folderData = await prisma.folder.findUnique({
		where: { id: folderId },
		select: {
			files: { select: { id: true, path: true } },
			children: { select: { id: true } },
		},
	});

	if (!folderData) return { folderIds: [], files: [] };

	const nestedData = {
		folderIds: [folderId],
		files: [...folderData.files],
	};

	for (const childFolder of folderData.children) {
		const childData = await getNestedFolderData(childFolder.id);
		nestedData.folderIds.push(...childData.folderIds);
		nestedData.files.push(...childData.files);
	}

	return nestedData;
}

export async function permanentlyDeleteFolder(folderId, userId) {
	const folder = await prisma.folder.findUnique({
		where: { id: folderId },
	});

	// Verify ownership if userId is provided
	if (userId && (!folder || folder.userId !== userId)) {
		throw new Error("Folder not found or unauthorized");
	}

	const nestedData = await getNestedFolderData(folderId);
	const filePaths = nestedData.files.map((file) => file.path).filter(Boolean);

	if (filePaths.length > 0) {
		const { error } = await supabase.storage
			.from("user-uploads")
			.remove(filePaths);

		if (error) {
			throw new Error(
				`Failed to delete folder files from storage: ${error.message}`,
			);
		}
	}

	await prisma.$transaction([
		prisma.share.deleteMany({
			where: {
				OR: [
					{ folderId: { in: nestedData.folderIds } },
					{ fileId: { in: nestedData.files.map((file) => file.id) } },
				],
			},
		}),
		prisma.file.deleteMany({
			where: { id: { in: nestedData.files.map((file) => file.id) } },
		}),
		prisma.folder.deleteMany({
			where: { id: { in: nestedData.folderIds } },
		}),
	]);
}

export const deleteFolder = async (req, res, next) => {
	try {
		const folderId = req.body.itemId;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return redirectWithToast(
				req,
				res,
				"Folder not found or unauthorized",
				"error",
			);
		}

		await permanentlyDeleteFolder(folderId, req.user.id);

		return redirectWithToast(req, res, "Folder deleted", "success");
	} catch (err) {
		if (err?.message?.toLowerCase().includes("storage")) {
			return redirectWithToast(
				req,
				res,
				"Folder files could not be deleted from storage. Try again.",
				"error",
			);
		}
		return next(err);
	}
};

export const getFolderSharingDetails = async (req, res, next) => {
	try {
		const folderId = req.params.id;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return res
				.status(403)
				.json({ error: "Folder not found or unauthorized" });
		}

		const rawShare = await prisma.share.findUnique({
			where: { folderId: folderId },
		});

		const sharingDetails = await formatSharingDetails(rawShare, req);

		res.json({ success: true, sharingDetails });
	} catch (error) {
		next(error);
	}
};

export const shareFolder = async (req, res, next) => {
	try {
		const validation = await runValidation(req, validateShareSettings);
		if (!validation.success) return res.status(400).json(validation);

		const folderId = req.body.itemId;
		const { access, duration, days = 0, hours = 0, minutes = 0 } = req.body;

		// Verify folder exists and belongs to user
		const folder = await verifyFolderOwnership(folderId, req.user.id);
		if (!folder) {
			return res
				.status(403)
				.json({ error: "Folder not found or unauthorized" });
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
			where: { folderId: folderId },
			update: { access, expiresAt },
			create: { folderId: folderId, access, expiresAt },
		});

		res.json({
			success: true,
			message: access === "PUBLIC" ? "Folder shared" : "Share settings updated",
		});
	} catch (err) {
		return next(err);
	}
};
