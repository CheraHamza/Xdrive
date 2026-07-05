import passport from "passport";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import { Strategy as LocalStrategy } from "passport-local";
import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";

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
						message: "Email does not exist, you can sign up instead.",
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

passport.serializeUser((user, done) => {
	done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
	try {
		const user = await prisma.user.findUnique({ where: { id } });
		done(null, user);
	} catch (err) {
		done(err);
	}
});

export const isAuth = (req, res, next) => {
	if (req.isAuthenticated()) {
		next();
	} else {
		res.status(401).redirect("/login");
	}
};

export const isAnonymous = (req, res, next) => {
	if (!req.isAuthenticated()) {
		next();
	} else {
		res.redirect("/");
	}
};
