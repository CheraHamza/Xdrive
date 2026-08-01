import express from "express";
import { prisma } from "../lib/prisma.js";

export function mapFileIcons(files) {
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
