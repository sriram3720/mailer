const fs = require('fs');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];





const TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

async function authenticate() {
  return new Promise((resolve, reject) => {
    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) {
        console.error('Error retrieving access token:', err);
        reject(err);
        return;
      }
      oAuth2Client.setCredentials(JSON.parse(token));
      resolve(oAuth2Client);
    });
  });
}


async function listMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({ userId: 'me' });
  return res.data.messages || [];
}

async function getThread(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.threads.get({ userId: 'me', id: messageId });
  return res.data;
}


async function hasPriorReplies(auth, threadId) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({ userId: 'me', q: `threadId:${threadId} from:me` });
  return res.data.messages.length > 0;
}


async function sendReply(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  const message = await gmail.users.messages.get({ userId: 'me', id: messageId });
  const reply = createReplyEmail(message);
  const encodedEmail = createEncodedEmail(reply);

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedEmail } });
}


function createReplyEmail(message) {

  const subject = `Re: ${message.subject}`;
  const replyContent = `Thank you for your email! I am currently on vacation and will reply to your message when I return.`;

  return {
    threadId: message.threadId,
    to: message.from.email,
    subject,
    message: replyContent,
  };
}


async function createOrGetLabel(auth, labelName) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.labels.list({ userId: 'me' });
  const existingLabel = res.data.labels.find((label) => label.name === labelName);

  if (existingLabel) {
    return existingLabel.id;
  } else {
    const newLabel = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    return newLabel.data.id;
  }
}


async function addLabel(auth, messageId, labelId) {
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
    },
  });
}


function getRandomInterval(minSeconds, maxSeconds) {
  return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
}

module.exports = {
  authenticate,
  listMessages,
  getThread,
  hasPriorReplies,
  sendReply,
  createOrGetLabel,
  addLabel,
  getRandomInterval,
};
