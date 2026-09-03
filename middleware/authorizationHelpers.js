import { prisma } from "../lib/prisma.js";

async function findOwnedResource(resource, resourceId, userId, errorMessage) {
	if (!resourceId || !userId) return null;

	try {
		const record = await prisma[resource].findUnique({
			where: { id: resourceId },
		});

		return record?.userId === userId ? record : null;
	} catch (error) {
		console.error(errorMessage, error);
		return null;
	}
}

export async function verifyFolderOwnership(folderId, userId) {
	return findOwnedResource(
		"folder",
		folderId,
		userId,
		"Error verifying folder ownership:",
	);
}

export async function verifyFileOwnership(fileId, userId) {
	return findOwnedResource(
		"file",
		fileId,
		userId,
		"Error verifying file ownership:",
	);
}

export async function verifyDestinationFolder(parentFolderId, userId) {
	return verifyFolderOwnership(parentFolderId, userId);
}


export async function getFileForDownload(fileId, userId) {
	return verifyFileOwnership(fileId, userId);
}
