import express from "express";
import { prisma } from "../lib/prisma.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ZipArchive } from "archiver";

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
			name: "root",
			createdAt: new Date(),
			user: { connect: { id: req.user.id } },
		},
		include: {
			files: true,
			children: true,
		},
	});

	mapFileIcons(rootFolder.files);

	res.render("home", {
		title: "Home",
		files: rootFolder.files,
		folders: rootFolder.children,
		currentFolderId: rootId,
	});
};

export const getFolder = async (req, res, next) => {
	const folderId = req.params.folderId;

	const folder = await prisma.folder.findUnique({
		where: { id: folderId },
		include: {
			files: true,
			children: true,
		},
	});

	mapFileIcons(folder.files);

	res.render("home", {
		title: "home",
		files: folder.files,
		folders: folder.children,
		currentFolderId: folder.id,
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
