const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const { query, execute } = require("../models/common.model");

// ─── Google ───────────────────────────────────────────────────────────────────

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${process.env.SERVER_URL}/api/auth/google/callback`,
    },
    async (_at, _rt, profile, done) => {
      try {
        const email    = profile.emails?.[0]?.value || null;
        const avatar   = profile.photos?.[0]?.value || null;
        const name     = profile.displayName;
        const googleId = profile.id;

        let users = await query("SELECT * FROM users WHERE google_id = ?", [googleId]);

        if (!users.length && email) {
          users = await query("SELECT * FROM users WHERE email = ?", [email]);
        }

        if (users.length) {
          if (!users[0].google_id) {
            await execute(
              "UPDATE users SET google_id = ?, auth_provider = 'google' WHERE id = ?",
              [googleId, users[0].id]
            );
          }
          return done(null, users[0]);
        }

        const result = await execute(
          "INSERT INTO users(name, email, avatar, google_id, auth_provider, role) VALUES(?,?,?,?,'google','user')",
          [name, email, avatar, googleId]
        );
        const [newUser] = await query("SELECT * FROM users WHERE id = ?", [result.insertId]);
        return done(null, newUser);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ─── Facebook ─────────────────────────────────────────────────────────────────

passport.use(
  new FacebookStrategy(
    {
      clientID:     process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:  `${process.env.SERVER_URL}/api/auth/facebook/callback`,
      profileFields: ["id", "displayName", "photos", "email"],
    },
    async (_at, _rt, profile, done) => {
      try {
        const email      = profile.emails?.[0]?.value || null;
        const avatar     = profile.photos?.[0]?.value || null;
        const name       = profile.displayName;
        const facebookId = profile.id;

        let users = await query("SELECT * FROM users WHERE facebook_id = ?", [facebookId]);

        if (!users.length && email) {
          users = await query("SELECT * FROM users WHERE email = ?", [email]);
        }

        if (users.length) {
          if (!users[0].facebook_id) {
            await execute(
              "UPDATE users SET facebook_id = ?, auth_provider = 'facebook' WHERE id = ?",
              [facebookId, users[0].id]
            );
          }
          return done(null, users[0]);
        }

        const result = await execute(
          "INSERT INTO users(name, email, avatar, facebook_id, auth_provider, role) VALUES(?,?,?,?,'facebook','user')",
          [name, email, avatar, facebookId]
        );
        const [newUser] = await query("SELECT * FROM users WHERE id = ?", [result.insertId]);
        return done(null, newUser);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

module.exports = passport;