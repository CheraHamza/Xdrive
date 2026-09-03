import { Router } from "express";
import { isAuth, isAnonymous } from "../config/passport.js";

import {
	getLogin,
	postLogin,
	getSignup,
	postSignup,
	postLogout,
} from "../controllers/authentication.js";

import {
	downloadFile,
	postUpload,
	renameFile,
	starFile,
	moveFile,
	getFileDetailsById,
	trashFile,
	restoreFile,
	deleteFile,
	getFileSharingDetails,
	shareFile,
} from "../controllers/filesController.js";
import {
	createFolder,
	downloadFolder,
	getFolder,
	moveFolder,
	renameFolder,
	starFolder,
	getFolderDetailsById,
	trashFolder,
	restoreFolder,
	deleteFolder,
	getFolderSharingDetails,
	shareFolder,
} from "../controllers/foldersController.js";
import {
	emptyTrash,
	getFolderTree,
	getRoot,
	getSearch,
	getShare,
	getShared,
	getStarred,
	getTrash,
} from "../controllers/commonController.js";

export const router = Router();

// common
router.get(["/", "/home"], isAuth, getRoot);
router.get("/starred", isAuth, getStarred);
router.get("/trash", isAuth, getTrash);
router.get("/search", isAuth, getSearch);
router.get("/share/:id", getShare);
router.get("/shared", isAuth, getShared);
router.get("/folder-tree", isAuth, getFolderTree);
router.post("/empty-trash", isAuth, emptyTrash);

// authentication
router.get("/signup", isAnonymous, getSignup);
router.post("/signup", isAnonymous, postSignup);
router.get("/login", isAnonymous, getLogin);
router.post("/login", isAnonymous, postLogin);
router.post("/logout", isAuth, postLogout);

// files
router.post("/upload", isAuth, postUpload);
router.post("/star-file", isAuth, starFile);
router.post("/download-file", isAuth, downloadFile);
router.post("/rename-file", isAuth, renameFile);
router.post("/move-file", isAuth, moveFile);
router.get("/file-details/:id", isAuth, getFileDetailsById);
router.post("/trash-file", isAuth, trashFile);
router.post("/restore-file", isAuth, restoreFile);
router.post("/delete-file", isAuth, deleteFile);
router.get("/file-sharing-details/:id", isAuth, getFileSharingDetails);
router.post("/share-file", isAuth, shareFile);

// folders
router.post("/createFolder", isAuth, createFolder);
router.get("/folder/:folderId", isAuth, getFolder);
router.post("/star-folder", isAuth, starFolder);
router.post("/download-folder", isAuth, downloadFolder);
router.post("/rename-folder", isAuth, renameFolder);
router.post("/move-folder", isAuth, moveFolder);
router.get("/folder-details/:id", isAuth, getFolderDetailsById);
router.post("/trash-folder", isAuth, trashFolder);
router.post("/restore-folder", isAuth, restoreFolder);
router.post("/delete-folder", isAuth, deleteFolder);
router.get("/folder-sharing-details/:id", isAuth, getFolderSharingDetails);
router.post("/share-folder", isAuth, shareFolder);
