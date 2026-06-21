import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./routes/router.js";
import { sessionMiddleware } from "./config/passport.js";
import passport from "passport";
import "./config/passport.js";
import dotenv from "dotenv";
import livereload from "livereload";
import connectLiveReload from "connect-livereload";

dotenv.config();

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV !== "production") {
	const liveReloadServer = livereload.createServer({
		exts: ["ejs", "html", "css", "js"],
		port: 35729,
	});

	liveReloadServer.watch(path.join(__dirname, "views"));
	liveReloadServer.watch(path.join(__dirname, "public"));

	app.use(connectLiveReload({ port: 35729 }));

	liveReloadServer.server.once("connection", () => {
		setTimeout(() => {
			liveReloadServer.refresh("/");
		}, 100);
	});
}

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(sessionMiddleware());
app.use(passport.initialize());
app.use(passport.session());

app.use("/", router);

app.listen(3000, (error) => {
	if (error) {
		throw error;
	}
	console.log("app listening on port 3000!");
});
