import "dotenv/config";
import express from "express";
import "./queue/worker";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { scheduleRoutes } from "./api/schedule.routes";
import { db, initDb } from "./db/client";
import { connection } from "./queue/queue";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === "production";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: "https://reachinbox-scheduler-assignment-frontend.onrender.com",
    credentials: true,
  }),
);

app.use(
  session({
    name: "reachinbox.sid",
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);
app.use((req, _res, next) => {
  if (req.path === "/api/auth/me") {
    console.log("Session diagnostic:", {
      cookieReceived: Boolean(req.headers.cookie?.includes("reachinbox.sid=")),
      sessionID: req.sessionID,
      passportUserPresent: Boolean(req.user),
      sessionHasPassport: Boolean((req.session as any)?.passport?.user),
    });
  }

  next();
});
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: Express.User, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:5000/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email)
            return done(new Error("Google account did not provide an email"));
          const user = await db.query(
            "INSERT INTO users (id, google_id, name, email, avatar) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (google_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, avatar = EXCLUDED.avatar RETURNING id, google_id, name, email, avatar",
            [
              profile.id,
              profile.id,
              profile.displayName || email,
              email,
              profile.photos?.[0]?.value || null,
            ],
          );
          done(null, user.rows[0]);
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
}

app.get("/api/auth/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    return res.status(503).json({
      error: "OAUTH_NOT_CONFIGURED",
      message: "Set Google OAuth credentials in backend/.env.",
    });
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next,
  );
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof Error) {
      console.error("OAuth/server error:", error.name, error.message);
    } else {
      console.error("OAuth/server error:", error);
    }

    res.status(500).json({
      error: "SERVER_ERROR",
      message: "Something went wrong.",
    });
  },
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${frontendUrl}/?login=failed`,
  }),
  (_req, res) => res.redirect(frontendUrl),
);
app.get("/api/auth/me", (req, res) =>
  req.user
    ? res.json({ user: req.user })
    : res
        .status(401)
        .json({ error: "UNAUTHORIZED", message: "Not signed in." }),
);
app.post("/api/auth/logout", (req, res, next) =>
  req.logout((error) => {
    if (error) return next(error);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie("reachinbox.sid");
      res.json({ ok: true });
    });
  }),
);

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    await connection.ping();
    res.json({ status: "ok", database: "connected", redis: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "or redis unavailable" });
  }
});

app.use("/api/emails", scheduleRoutes);
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    res
      .status(500)
      .json({ error: "SERVER_ERROR", message: "Something went wrong." });
  },
);

initDb()
  .then(() => {
    app.listen(port, () => console.log(`API listening on ${port}`));
  })
  .catch((error) => {
    console.error(
      "Could not connect to PostgreSQL or initialize schema:",
      error,
    );
    process.exit(1);
  });
