import { prisma } from "../lib/prisma.js";
import fs from "fs";
import path from "path";
import { ZipArchive } from "archiver";
import { intervalToDuration, isBefore } from "date-fns";
import { permanentlyDeleteFile } from "./filesController.js";
import { permanentlyDeleteFolder } from "./foldersController.js";

export function mapFileIcons(files) {
	const iconMap = {
		image: "image",
		movie: "movie",
		audio: "audio_file",
		pdf: "picture_as_pdf",
		document: "description",
		spreadsheet: "table_chart",
		presentation: "slideshow",
		code: "code",
		text: "article",
		zip: "folder_zip",
		other: "draft",
	};

	files.forEach((file) => {
		file.icon = iconMap[file.type] || "draft";
	});
}

export function getFileDownloadName(file) {
	const originalExtension = path.extname(file.filename || file.path || "");
	if (
		!originalExtension ||
		file.name.toLowerCase().endsWith(originalExtension.toLowerCase())
	) {
		return file.name;
	}

	return `${file.name}${originalExtension}`;
}

export function redirectWithToast(req, res, message, type = "success") {
	const target = req.get("Referrer") || "/";
	const separator = target.includes("?") ? "&" : "?";
	const safeMessage = encodeURIComponent(message);

	return res.redirect(
		`${target}${separator}toast=${safeMessage}&toastType=${type}`,
	);
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

async function folderBelongsToSharedRoot(folderId, rootFolderId, userId) {
	let currentId = folderId;

	while (currentId) {
		const folder = await prisma.folder.findUnique({
			where: { id: currentId },
			select: { id: true, parentId: true, userId: true },
		});

		if (!folder || folder.userId !== userId) return false;
		if (folder.id === rootFolderId) return true;
		currentId = folder.parentId;
	}

	return false;
}

async function getSharedFolderContents(token, folderId, user) {
	const share = await prisma.share.findUnique({
		where: { shareToken: token },
		include: { folder: { select: { id: true, userId: true, trashed: true } } },
	});

	if (
		!share ||
		share.access !== "PUBLIC" ||
		(share.expiresAt && isBefore(new Date(share.expiresAt), new Date())) ||
		!share.folder ||
		share.folder.trashed ||
		!(await folderBelongsToSharedRoot(
			folderId,
			share.folder.id,
			share.folder.userId,
		))
	) {
		return null;
	}

	const folder = await prisma.folder.findUnique({
		where: { id: folderId },
		include: {
			files: { where: { trashed: false } },
			children: { where: { trashed: false } },
			user: { select: { id: true, name: true } },
			parent: { select: { id: true, name: true, parentId: true } },
		},
	});

	if (!folder || folder.trashed) return null;

	const location = [];
	let currentFolder = folder;
	while (currentFolder) {
		location.unshift({
			name: currentFolder.name,
			url:
				currentFolder.id === share.folder.id
					? `/share/${token}`
					: `/share/${token}/folder/${currentFolder.id}`,
		});

		if (currentFolder.id === share.folder.id) break;
		if (!currentFolder.parentId) break;
		currentFolder = await prisma.folder.findUnique({
			where: { id: currentFolder.parentId },
			select: { id: true, name: true, parentId: true },
		});
	}

	mapFileIcons(folder.files);
	const sharedBaseUrl = `/share/${token}`;
	const isOwner = folder.userId === user?.id;
	folder.children.forEach((child) => {
		child.sharedOpenUrl = `${sharedBaseUrl}/folder/${child.id}`;
		child.sharedDownloadUrl = `${sharedBaseUrl}/download?itemId=${child.id}`;
	});
	folder.files.forEach((file) => {
		file.sharedDownloadUrl = `${sharedBaseUrl}/download?itemId=${file.id}`;
	});

	const totalSize = folder.files.reduce((total, file) => total + file.size, 0);
	folder.shareToken = token;
	folder.sharedOpenUrl = isOwner
		? `/folder/${folder.id}`
		: `${sharedBaseUrl}/folder/${folder.id}`;
	folder.details = {
		type: "Folder",
		size: (totalSize / (1024 * 1024)).toFixed(2),
		owner: folder.user.name || "Unknown",
		Nfiles: folder.files.length,
		Nfolders: folder.children.length,
	};

	return { folder, location, isOwner };
}

export async function browseSharedFolder(req, res, next) {
	try {
		const token = req.params.id;
		const folderId = req.params.folderId;
		const contents = await getSharedFolderContents(token, folderId, req.user);

		if (!contents) {
			return res.status(404).render("404", {
				message: "Shared folder not found or unavailable.",
			});
		}

		const location = [
			{
				name: contents.isOwner ? "Shared" : "Shared with you",
				url: contents.isOwner && req.user ? "/shared" : `/share/${token}`,
			},
			...contents.location,
		];

		return res.render("index", {
			title: contents.folder.name,
			item: contents.folder,
			itemType: "folder",
			files: contents.folder.files,
			folders: contents.folder.children,
			location,
			isSharedBrowse: true,
		});
	} catch (error) {
		return next(error);
	}
}

export const getStarred = async (req, res, next) => {
	try {
		const starredFolders = await prisma.folder.findMany({
			where: { userId: req.user.id, starred: true, trashed: false },
		});

		const starredFiles = await prisma.file.findMany({
			where: { userId: req.user.id, starred: true, trashed: false },
		});

		mapFileIcons(starredFiles);

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
	} catch (err) {
		return next(err);
	}
};

export const getTrash = async (req, res, next) => {
	try {
		const trashedFolders = await prisma.folder.findMany({
			where: { userId: req.user.id, trashed: true },
		});

		const trashedFiles = await prisma.file.findMany({
			where: { userId: req.user.id, trashed: true },
		});

		mapFileIcons(trashedFiles);

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
	} catch (err) {
		return next(err);
	}
};

export const emptyTrash = async (req, res, next) => {
	const userId = req.user.id;

	const trashedFolders = await prisma.folder.findMany({
		where: { userId, trashed: true },
		select: { id: true },
	});

	await Promise.all(
		trashedFolders.map((folder) => permanentlyDeleteFolder(folder.id, userId)),
	);

	const trashedFiles = await prisma.file.findMany({
		where: { userId, trashed: true },
		select: { id: true },
	});

	await Promise.all(
		trashedFiles.map((file) => permanentlyDeleteFile(file.id, userId)),
	);

	return redirectWithToast(req, res, "Trash emptied", "success");
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
	try {
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
			where: {
				userId: req.user.id,
				name: { startsWith: searchQuery, mode: "insensitive" },
			},
		});

		const matchingFiles = await prisma.file.findMany({
			where: {
				userId: req.user.id,
				name: { startsWith: searchQuery, mode: "insensitive" },
			},
		});

		mapFileIcons(matchingFiles);

		res.render("index", {
			title: "Search",
			folders: matchingFolders,
			files: matchingFiles,
			location,
			searchQuery,
		});
	} catch (err) {
		return next(err);
	}
};

export async function formatSharingDetails(sharingDetails, req) {
	if (!sharingDetails) return null;

	const expiresAt = sharingDetails.expiresAt;
	const isExpired = expiresAt
		? isBefore(new Date(expiresAt), new Date())
		: false;

	if (isExpired) {
		if (sharingDetails.access !== "RESTRICTED") {
			const whereClause = sharingDetails.fileId
				? { fileId: sharingDetails.fileId }
				: { folderId: sharingDetails.folderId };

			await prisma.share.update({
				where: whereClause,
				data: { access: "RESTRICTED" },
			});

			sharingDetails.access = "RESTRICTED";
		}

		return {
			...sharingDetails,
			isExpired: true,
			remainingTime: { days: 0, hours: 0, minutes: 0 },
			link: null,
		};
	}

	let remainingTime = null;
	if (expiresAt) {
		const duration = intervalToDuration({
			start: new Date(),
			end: new Date(expiresAt),
		});

		remainingTime = {
			days: duration.days || 0,
			hours: duration.hours || 0,
			minutes: duration.minutes || 0,
		};
	}

	const baseUrl = `${req.protocol}://${req.get("host")}`;
	const shareLink = `${baseUrl}/share/${sharingDetails.shareToken}`;

	return {
		...sharingDetails,
		isExpired: false,
		remainingTime,
		link: shareLink,
	};
}

export const getShare = async (req, res, next) => {
	try {
		const sharedItemToken = req.params.id;

		const sharedItem = await prisma.share.findUnique({
			where: { shareToken: sharedItemToken },
			include: {
				file: {
					include: {
						user: { select: { id: true, name: true } },
						folder: { select: { id: true, parentId: true, name: true } },
					},
				},
				folder: {
					include: {
						files: { select: { size: true } },
						user: { select: { id: true, name: true } },
						parent: { select: { id: true, name: true } },
						_count: {
							select: {
								files: { where: { trashed: false } },
								children: { where: { trashed: false } },
							},
						},
					},
				},
			},
		});

		if (!sharedItem || sharedItem.access === "RESTRICTED") {
			return res
				.status(404)
				.render("404", { message: "Share link not found or restricted." });
		}

		if (
			sharedItem.expiresAt &&
			isBefore(new Date(sharedItem.expiresAt), new Date())
		) {
			return res
				.status(410)
				.render("410", { message: "This share link has expired" });
		}

		const itemType = sharedItem.fileId ? "file" : "folder";
		const item = sharedItem[itemType];

		if (!item || item.trashed) {
			return res
				.status(404)
				.render("404", { message: "Shared item is unavailable." });
		}
		item.shareToken = sharedItem.shareToken;

		const currentUserId = req.user?.id;
		const ownerName =
			currentUserId && item.user.id === currentUserId
				? "Me"
				: item.user.name || "Unknown";

		if (itemType === "file") {
			mapFileIcons([item]);
			item.locationUrl = item.folderId ? `/folder/${item.folderId}` : "/";
			item.details = {
				type: item.type,
				size: (item.size / (1024 * 1024)).toFixed(2),
				owner: ownerName,
			};
		} else {
			const isOwner = req.user?.id === item.user.id;
			item.sharedOpenUrl = isOwner
				? `/folder/${item.id}`
				: `/share/${sharedItem.shareToken}/folder/${item.id}`;
			item.details = {
				type: "Folder",
				size: (
					item.files.reduce((total, file) => total + file.size, 0) /
					(1024 * 1024)
				).toFixed(2),
				owner: ownerName,
				Nfiles: item._count?.files || 0,
				Nfolders: item._count?.children || 0,
			};
		}

		const location = [
			{
				name: currentUserId === item.user.id ? "Shared" : "Shared with you",
				url: currentUserId === item.user.id ? "/shared" : req.path,
			},
			{
				name: item.name,
				url: req.path,
			},
		];

		res.render("index", { title: "Share", location, item, itemType });
	} catch (error) {
		return next(error);
	}
};

const addSharedFolderToArchive = async (
	folderId,
	archive,
	currentPath = "",
) => {
	const folder = await prisma.folder.findUnique({
		where: { id: folderId },
		include: { files: true, children: true },
	});

	if (!folder || folder.trashed) return;

	folder.files.forEach((file) => {
		if (!file.trashed && fs.existsSync(file.path)) {
			archive.file(file.path, {
				name: path.join(currentPath, getFileDownloadName(file)),
			});
		}
	});

	await Promise.all(
		folder.children.map((childFolder) =>
			addSharedFolderToArchive(
				childFolder.id,
				archive,
				path.join(currentPath, childFolder.name),
			),
		),
	);
};

export const downloadSharedFile = async (req, res, next) => {
	try {
		const sharedItem = await prisma.share.findUnique({
			where: { shareToken: req.params.id },
			include: { file: true, folder: true },
		});

		if (
			!sharedItem ||
			sharedItem.access !== "PUBLIC" ||
			(sharedItem.expiresAt &&
				isBefore(new Date(sharedItem.expiresAt), new Date())) ||
			(sharedItem.file && sharedItem.file.trashed) ||
			(sharedItem.folder && sharedItem.folder.trashed) ||
			(!sharedItem.file && !sharedItem.folder)
		) {
			return res
				.status(404)
				.json({ error: "Shared file not found or unavailable" });
		}

		let downloadableFile = sharedItem.file;
		let downloadableFolder = sharedItem.folder;
		const requestedItemId = req.query.itemId;

		if (requestedItemId && sharedItem.folder) {
			const requestedFolder = await getSharedFolderContents(
				req.params.id,
				requestedItemId,
			);

			if (requestedFolder) {
				downloadableFolder = requestedFolder.folder;
				downloadableFile = null;
			} else {
				const requestedFile = await prisma.file.findUnique({
					where: { id: requestedItemId },
					include: { folder: { select: { id: true } } },
				});
				const isSharedFile =
					requestedFile &&
					!requestedFile.trashed &&
					requestedFile.folder &&
					(await folderBelongsToSharedRoot(
						requestedFile.folder.id,
						sharedItem.folder.id,
						sharedItem.folder.userId,
					));

				if (!isSharedFile) {
					return res.status(404).json({
						error: "Shared file not found or unavailable",
					});
				}
				downloadableFile = requestedFile;
				downloadableFolder = null;
			}
		}

		if (downloadableFolder) {
			res.attachment(`${downloadableFolder.name}.zip`);

			const archive = new ZipArchive({ zlib: { level: 9 } });
			archive.pipe(res);
			await addSharedFolderToArchive(
				downloadableFolder.id,
				archive,
				downloadableFolder.name,
			);
			await archive.finalize();
			return;
		}

		if (!downloadableFile || !fs.existsSync(downloadableFile.path)) {
			return res.status(404).json({ error: "File not found on server" });
		}

		return res.download(
			downloadableFile.path,
			getFileDownloadName(downloadableFile),
			(error) => {
				if (error && !res.headersSent) {
					return res.status(500).json({ error: "Download failed" });
				}
			},
		);
	} catch (error) {
		return next(error);
	}
};

export const getShared = async (req, res, next) => {
	try {
		const sharedFolders = await prisma.folder.findMany({
			where: {
				userId: req.user.id,
				share: {
					access: "PUBLIC",
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				},
				trashed: false,
			},
		});

		const sharedFiles = await prisma.file.findMany({
			where: {
				userId: req.user.id,
				share: {
					access: "PUBLIC",
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				},
				trashed: false,
			},
		});

		mapFileIcons(sharedFiles);

		const location = [
			{
				name: "Shared",
				url: "/shared",
			},
		];

		res.render("index", {
			title: "Shared",
			files: sharedFiles,
			folders: sharedFolders,
			location,
		});
	} catch (err) {
		return next(err);
	}
};
