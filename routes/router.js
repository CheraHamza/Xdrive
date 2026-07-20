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
} from "../controllers/foldersController.js";

export const router = Router();

router.get(["/", "/home"], isAuth, getRoot);

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

router.post("/createFolder", isAuth, createFolder);
router.get("/folder/:folderId", isAuth, getFolder);
router.post("/star-folder", isAuth, starFolder);
router.post("/download-folder", isAuth, downloadFolder);
router.post("/rename-folder", isAuth, renameFolder);
router.post("/move-folder", isAuth, moveFolder);
router.get("/folder-details/:id", isAuth, getFolderDetailsById);
router.post("/trash-folder", isAuth, trashFolder);

router.get("/folder-tree", isAuth, getFolderTree);
