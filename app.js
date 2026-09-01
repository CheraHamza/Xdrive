import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes/router.js";
import { sessionMiddleware } from "./config/passport.js";
import passport from "passport";
import "./config/passport.js";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";

dotenv.config();

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(sessionMiddleware());
app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => {
	res.locals.currentUser = req.user || null;
	res.locals.isAuthenticated = req.isAuthenticated();

	if (!req.user) {
		return next();
	}

	try {
		const storageLimitMb = 100;
		const storageLimit = storageLimitMb * 1024 * 1024;
		const storage = await prisma.file.aggregate({
			_sum: { size: true },
			where: { userId: req.user.id },
		});
		const usedBytes = storage._sum.size || 0;

		res.locals.storageUsage = {
			percentage: Math.min(100, Math.round((usedBytes / storageLimit) * 100)),
			limitLabel: `${storageLimitMb} MB`,
		};
	} catch (error) {
		return next(error);
	}

	next();
});

app.use("/files", express.static(path.join(__dirname, "files")));

app.use(express.json());
app.use("/", router);

app.listen(3000, (error) => {
	if (error) {
		throw error;
	}
	console.log("app listening on port 3000!");
});
