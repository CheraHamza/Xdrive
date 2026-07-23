import express from "express";
import { prisma } from "../lib/prisma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ZipArchive } from "archiver";
import { format } from "date-fns";
import { permanentlyDeleteFile } from "./filesController.js";

const __direname = path.dirname(fileURLToPath(import.meta.url));

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

function mapFileIcons(files) {
	const iconMap = {
		image: "image",
		movie: "movie",
		other: "draft",
		zip: "folder_zip",
	};

	files.forEach((file) => {
		file.icon = iconMap[file.type] || "draft";
	});
}

export const getRoot = async (req, res, next) => {
	const rootId = "root_" + req.user.id;
	const rootFolder = await prisma.folder.upsert({
		where: {
			id: rootId,
		},
		update: {},
		create: {
			id: rootId,
			name: "Home",
			createdAt: new Date(),
			user: { connect: { id: req.user.id } },
		},
		include: {
			files: { where: { trashed: false } },
			children: { where: { trashed: false } },
		},
	});

	mapFileIcons(rootFolder.files);

	const location = [
		{
			name: "Home",
			url: "/",
		},
	];

	res.render("index", {
		title: "Home",
		files: rootFolder.files,
		folders: rootFolder.children,
		currentFolderId: rootId,
		location,
	});
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

export const getStarred = async (req, res, next) => {
	const starredFolders = await prisma.folder.findMany({
		where: { starred: true, trashed: false },
	});

	const starredFiles = await prisma.file.findMany({
		where: { starred: true, trashed: false },
	});

	const location = [
		{
			name: "Starred",
			url: "/starred",
		},
	];
	res.render("index", {
		title: "Starred",
		files: starredFiles,
		folders: starredFolders,
		location,
	});
};

export const getTrash = async (req, res, next) => {
	const trashedFolders = await prisma.folder.findMany({
		where: { trashed: true },
	});

	const trashedFiles = await prisma.file.findMany({
		where: { trashed: true },
	});

	const location = [
		{
			name: "Trash",
			url: "/trash",
		},
	];

	res.render("index", {
		title: "Trash",
		files: trashedFiles,
		folders: trashedFolders,
		location,
	});
};

export const starFolder = async (req, res, next) => {
	const folderId = req.body.itemId;
	const starred = req.body.starred === "true";

	await prisma.folder.update({
		where: { id: folderId },
		data: {
			starred: !starred,
		},
	});

	res.redirect(req.get("Referrer") || "/");
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

	res.redirect(req.get("Referrer") || "/");
};

export const getFolderTree = async (req, res, next) => {
	const rootFolderId = "root_" + req.user.id;
	const folderId = req.query.itemId;

	const flatFolders = await prisma.folder.findMany({
		where: {
			userId: req.user.id,
		},
		include: {
			files: true,
		},
	});

	function buildTree(folders, parentId = null) {
		return folders
			.filter((folder) => folder.parentId === parentId)
			.map((folder) => ({
				...folder,
				files: folder.files || [],
				children: buildTree(folders, folder.id),
			}));
	}

	const rootFolder = flatFolders.find((f) => f.id === rootFolderId);
	const folderTree = {
		...rootFolder,
		files: rootFolder.files || [],
		children: buildTree(flatFolders, rootFolderId),
	};

	res.json({ success: true, folderTree });
};

export const moveFolder = async (req, res, next) => {
	const folderId = req.body.itemId;
	const destinationFolderId = req.body.destinationFolderId;

	await prisma.folder.update({
		where: { id: folderId },
		data: { parentId: destinationFolderId },
	});

	res.redirect(req.get("Referrer") || "/");
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

	res.redirect(req.get("Referrer") || "/");
};

export const restoreFolder = async (req, res, next) => {
	const folderId = req.body.itemId;

	await prisma.folder.update({
		where: { id: folderId },
		data: { trashed: false },
	});

	res.redirect(req.get("Referrer") || "/");
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

async function permanentlyDeleteFolder(folderId) {
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

	res.redirect(req.get("Referrer") || "/");
};

export const emptyTrash = async (req, res, next) => {
	const userId = req.user.id;

	const trashedFolders = await prisma.folder.findMany({
		where: { userId, trashed: true },
		select: { id: true },
	});

	await Promise.all(
		trashedFolders.map((folder) => permanentlyDeleteFolder(folder.id)),
	);

	const trashedFiles = await prisma.file.findMany({
		where: { userId, trashed: true },
		select: { id: true },
	});

	await Promise.all(trashedFiles.map((file) => permanentlyDeleteFile(file.id)));

	res.redirect(req.get("Referrer") || "/");
};

export const getSearch = async (req, res, next) => {
	let searchQuery = req.query.search;

	if (Array.isArray(searchQuery)) {
		searchQuery = searchQuery[0];
	}

	searchQuery = typeof searchQuery === "string" ? searchQuery.trim() : "";

	const location = [
		{
			name: "Search results",
			url: "",
		},
		{
			name: `'${searchQuery}'`,
			url: "",
		},
	];

	if (!searchQuery) {
		return res.render("index", {
			title: "Search",
			folders: [],
			files: [],
			location,
			searchQuery,
		});
	}

	const matchingFolders = await prisma.folder.findMany({
		where: { name: { startsWith: searchQuery, mode: "insensitive" } },
	});

	const matchingFiles = await prisma.file.findMany({
		where: { name: { startsWith: searchQuery, mode: "insensitive" } },
	});

	res.render("index", {
		title: "Search",
		folders: matchingFolders,
		files: matchingFiles,
		location,
		searchQuery,
	});
};
