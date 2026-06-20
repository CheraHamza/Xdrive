import passport from "passport";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import { Strategy as LocalStrategy } from "passport-local";
import { prisma } from "../lib/prisma.js";

export function sessionMiddleware() {
	return session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: false,
		store: new PrismaSessionStore(prisma, {
			checkPeriod: 2 * 60 * 1000,
		}),
		cookie: {
			maxAge: 1000 * 60 * 60 * 24,
		},
	});
}

passport.use(
	new LocalStrategy(
		{ usernameField: "email", passwordField: "password" },
		async (email, password, done) => {
			try {
				const user = await prisma.user.findUnique({
					where: {
						email: email,
					},
				});

				if (!user) {
					return done(null, false, {
						field: "email",
						message: "Email does not exist.",
					});
				}

				const match = await bcrypt.compare(password, user.password);

				if (!match) {
					return done(null, false, {
						field: "password",
						message: "Password is incorrect.",
					});
				}

				return done(null, user);
			} catch (err) {
				return done(err);
			}
		},
	),
);

export const isAuth = (req, res, next) => {
	if (req.isAuthenticated()) {
		next();
	} else {
		res.status(401).redirect("/login");
	}
};
