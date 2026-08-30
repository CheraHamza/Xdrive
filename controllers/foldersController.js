import { prisma } from "../lib/prisma.js";
import fs from "fs";
import path from "path";
import { ZipArchive } from "archiver";
import {
	addDays,
	addHours,
	addMinutes,
	format,
} from "date-fns";
import { formatSharingDetails, mapFileIcons, redirectWithToast } from "./commonController.js";

export const createFolder = async (req, res, next) => {
	const rootFolderId = "root_" + req.user.id;
	const currentFolderId = req.body.currentFolderId || rootFolderId;

	const newFolderName = req.body.foldername;

	await prisma.folder.create({
		data: {
			name: newFolderName,
			createdAt: new Date(),
			user: { connect: { id: req.user.id } },
			parent: { connect: { id: currentFolderId } },
		},
	});

	return redirectWithToast(req, res, "Folder created", "success");
};

export const getFolder = async (req, res, next) => {
	const folderId = req.params.folderId;

	const folder = await prisma.folder.findUnique({
		where: { id: folderId },
		include: {
			files: { where: { trashed: false } },
			children: { where: { trashed: false } },
		},
	});

	mapFileIcons(folder.files);

	const allFolders = await prisma.folder.findMany({
		where: { userId: req.user.id },
	});

	const folderMap = new Map(allFolders.map((f) => [f.id, f]));

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
};

export const starFolder = async (req, res, next) => {
	const folderId = req.body.itemId;
	const starred = req.body.starred === "true";

	const nextStarred = !starred;

	await prisma.folder.update({
		where: { id: folderId },
		data: {
			starred: nextStarred,
		},
	});

	return redirectWithToast(req, res, nextStarred ? "Folder starred" : "Folder unstarred", "success");
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

	folder.files.forEach((file) => {
		const filePath = file.path;

		if (fs.existsSync(filePath)) {
			const internalZipPath = path.join(currentPath, file.name);

			archive.file(filePath, { name: internalZipPath });
		}
	});

	const childPromises = folder.children.map((childFolder) => {
		const nextPath = path.join(currentPath, childFolder.name);
		return addFolderToArchive(childFolder.id, archive, nextPath);
	});

	await Promise.all(childPromises);
};

export const downloadFolder = async (req, res, next) => {
	try {
		const folderId = req.body.folderId;

		const folder = await prisma.folder.findUnique({
			where: { id: folderId },
		});

		if (!folder) {
			return res.status(404).send("Folder not found");
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
	const folderId = req.body.itemId;
	const newFolderName = req.body.name;

	await prisma.folder.update({
		where: { id: folderId },
		data: {
			name: newFolderName,
		},
	});

	return redirectWithToast(req, res, "Folder renamed", "success");
};

export const moveFolder = async (req, res, next) => {
	const folderId = req.body.itemId;
	const destinationFolderId = req.body.destinationFolderId;

	await prisma.folder.update({
		where: { id: folderId },
		data: { parentId: destinationFolderId },
	});

	return redirectWithToast(req, res, "Folder moved", "success");
};

export const getFolderDetailsById = async (req, res, next) => {
	const itemId = req.params.id;

	const details = {};

	const folder = await prisma.folder.findUnique({
		where: { id: itemId },
		include: { files: true, parent: true, user: true },
	});

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
};

export const trashFolder = async (req, res, next) => {
	const folderId = req.body.itemId;

	await prisma.folder.update({
		where: { id: folderId },
		data: { trashed: true },
	});

	return redirectWithToast(req, res, "Folder moved to trash", "success");
};

export const restoreFolder = async (req, res, next) => {
	const folderId = req.body.itemId;

	await prisma.folder.update({
		where: { id: folderId },
		data: { trashed: false },
	});

	return redirectWithToast(req, res, "Folder restored", "success");
};

async function getAllNestedFilePaths(folderId) {
	const folderData = await prisma.folder.findUnique({
		where: { id: folderId },
		select: {
			files: { select: { path: true } },
			children: { select: { id: true } },
		},
	});

	if (!folderData) return [];

	let filePaths = folderData.files.map((file) => file.path);

	for (const childFolder of folderData.children) {
		const childPaths = await getAllNestedFilePaths(childFolder.id);
		filePaths = filePaths.concat(childPaths);
	}

	return filePaths;
}

export async function permanentlyDeleteFolder(folderId) {
	const filePathsToDelete = await getAllNestedFilePaths(folderId);

	await Promise.all(
		filePathsToDelete.map(async (filePath) => {
			try {
				await fs.promises.unlink(filePath);
			} catch (err) {
				if (err.code !== "ENOENT") {
					console.error(`Failed to delete file on disk at ${filePath}`, err);
				}
			}
		}),
	);

	await prisma.folder.delete({
		where: { id: folderId },
	});
}

export const deleteFolder = async (req, res, next) => {
	const folderId = req.body.itemId;

	await permanentlyDeleteFolder(folderId);

	return redirectWithToast(req, res, "Folder deleted", "success");
};

export const getFolderSharingDetails = async (req, res, next) => {
	try {
		const folderId = req.params.id;

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
	const folderId = req.body.itemId;
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
		where: { folderId: folderId },
		update: { access, expiresAt },
		create: { folderId: folderId, access, expiresAt },
	});

	res.json({ success: true, message: access === "PUBLIC" ? "Folder shared" : "Share settings updated" });
};
