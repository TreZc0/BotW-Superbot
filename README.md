# Streams Discord Bot for BoTW

A basic discord bot that tracks twitch streams for a specific game, and posts messages to discord when twitch streams go live.

Note: It only tracks one game, and only posts to one discord channel.

Type `.streams` to display currently live twitch streams.

Based off the [Dustforce Discord Bot](https://github.com/Joel4558/Dustforce-discord)

# How to set up:

### Prerequisites

* [Node.js](https://nodejs.org/)

### Step 1
Copy the `config.example.js` as `config.js`. 

### Step 2
Edit the following lines to your specific needs.

`twitch-client-id`
  1. Go to [glass.twitch.tv](https://glass.twitch.tv/login)
  2. Click **View Apps**
  3. Click **Register Your Application**
  4. Type whatever you want in the fields (you can use `http://localhost` for OAuth Redirect URL) and click **Create**
  5. Click **Manage** on the new app you created
  6. copy out the Client ID.

`discord-token`
  * See [Setting Up a Bot Application](https://discordjs.guide/#/preparations/setting-up-a-bot-application)
  * This field should contain the token for your bot.

To get the channel ID of a channel in your discord server, turn on developer mode in your discord user settings (under "Appearance"). You can then get the channel ID by right-clicking a channel and selecting "Copy ID".

`discord-response-channel-id`
  * The ID of the channel you type `.streams` in, to get a list of streams from the bot. (the bot will also respond in this channel)

`discord-notifications-channel-id`
  * The channel the bot posts "going live" notifications to.

`bot-currently-playing`
  * The game "currently being played" by your bot.

### Step 3

Installing dependencies:
```
npm install
```

Running the bot:
```
node index.js
```
