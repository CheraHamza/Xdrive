import { Router } from "express";
import { isAuth, isAnonymous } from "../config/passport.js";
import express from "express";
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
	getRoot,
	getFolder,
	getFolderTree,
	moveFolder,
	renameFolder,
	starFolder,
	getFolderDetailsById,
	trashFolder,
	getStarred,
	getTrash,
	restoreFolder,
	deleteFolder,
	emptyTrash,
	getSearch,
	getFolderSharingDetails,
	shareFolder,
} from "../controllers/foldersController.js";

export const router = Router();

router.get(["/", "/home"], isAuth, getRoot);
router.get("/starred", isAuth, getStarred);
router.get("/trash", isAuth, getTrash);

router.get("/signup", isAnonymous, getSignup);
router.post("/signup", isAnonymous, postSignup);

router.get("/login", isAnonymous, getLogin);
router.post("/login", isAnonymous, postLogin);

router.post("/logout", isAuth, postLogout);

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

router.get("/search", isAuth, getSearch);

router.get("/folder-tree", isAuth, getFolderTree);

router.post("/empty-trash", isAuth, emptyTrash);
