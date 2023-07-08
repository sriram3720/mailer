const fs = require('fs');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { google } = require('googleapis');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { authenticate, listMessages, sendMessage, addLabel, createLabel, hasPriorReplies } = require('./gmail');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, SESSION_SECRET } = process.env;

const credentials = {
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET,
  redirect_uris: [GOOGLE_REDIRECT_URI],
};

const oAuth2Client = new google.auth.OAuth2(
  credentials.client_id, credentials.client_secret, credentials.redirect_uris[0]
);

const app = express();

app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: credentials.client_id,
      clientSecret: credentials.client_secret,
      callbackURL: credentials.redirect_uris[0],
    },
    (accessToken, refreshToken, profile, done) => {
      oAuth2Client.setCredentials({ access_token: accessToken });
      done(null, profile);
    }
  )
);

app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);


app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
      console.log(req,res)
      try {
        const auth = await authenticate();
        setInterval(async () => {
          try {
            const messages = await listMessages(auth);
  
            for (const message of messages) {
              const messageId = message.id;
  
              
              const thread = await getThread(auth, messageId);
              const hasPriorReplies = await hasPriorReplies(auth, thread.threadId);
              if (!hasPriorReplies) {
                
                await sendReply(auth, messageId);
  
               
                const labelId = await createOrGetLabel(auth, 'Vacation Auto Reply');
                await addLabel(auth, messageId, labelId);
              }
            }
          } catch (error) {
            console.error('Error:', error);
          }
        }, getRandomInterval() * 1000);
  
        res.redirect('/');
      } catch (error) {
        console.error('Error:', error);
      }
    }
  );
  

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.get('/', ensureAuthenticated, (req, res) => {
  res.send('You are logged in!');
});

app.listen(3000, () => {
  console.log('App listening on http://localhost:3000');
});
