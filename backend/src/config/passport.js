const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
      if (!user || !user.passwordHash) {
        return done(null, false, { message: 'Invalid email or password.' });
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return done(null, false, { message: 'Invalid email or password.' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        let user = await User.findOne({ googleId: profile.id });
        if (!user && email) user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email,
            displayName: profile.displayName || '',
            avatar: profile.photos?.[0]?.value || '',
          });
        } else {
          if (!user.googleId) user.googleId = profile.id;
          if (!user.avatar && profile.photos?.[0]?.value) user.avatar = profile.photos[0].value;
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
