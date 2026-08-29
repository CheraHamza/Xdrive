import { prisma } from "../lib/prisma.js";
import { intervalToDuration, isBefore } from "date-fns";

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
};

export const getTrash = async (req, res, next) => {
	const trashedFolders = await prisma.folder.findMany({
		where: { trashed: true },
	});

	const trashedFiles = await prisma.file.findMany({
		where: { trashed: true },
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
					},
				},
				folder: {
					include: {
						files: { select: { size: true } },
						user: { select: { id: true, name: true } },
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

		const currentUserId = req.user?.id;
		const ownerName =
			currentUserId && item.user.id === currentUserId
				? "Me"
				: item.user.name || "Unknown";

		if (itemType === "file") {
			mapFileIcons([item]);
			item.details = {
				type: item.type,
				size: (item.size / (1024 * 1024)).toFixed(2),
				owner: ownerName,
			};
		} else {
			const totalSize = item.files.reduce((acc, f) => acc + f.size, 0);

			item.details = {
				type: "Folder",
				size: (totalSize / (1024 * 1024)).toFixed(2),
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

export const getShared = async (req, res, next) => {
	const sharedFolders = await prisma.folder.findMany({
		where: {
			share: {
				access: "PUBLIC",
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			trashed: false,
		},
	});

	const sharedFiles = await prisma.file.findMany({
		where: {
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
};
