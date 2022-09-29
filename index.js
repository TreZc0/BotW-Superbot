//Modules
const Discord = require('discord.js');
const jsonfile = require('jsonfile');
const fs = require('fs');

//Global
const configFile = './config.json';
const config = jsonfile.readFileSync(configFile);

//Twitch Init
const twitch = require('./twitch-helix');

const discordToken = config["discord-token"];
const activeGuild = config["discord-server-id"];
const roleHandlingChannel = config["discord-role-channel-id"];
const streamNotificationChannel = config["discord-notifications-channel-id"];
const glitchesChannel = config["discord-glitches-channel-id"];
const stickyGlitchesChannel = config["discord-stickied-glitches-channel-id"];
const loggingChannel = config["discord-logging-channel-id"];
const bannedFileExtensions = config["discord-banned-file-ext"];

//Role Init
const numToDiscordEmojis = {
  0: '0⃣',
  1: '1⃣',
  2: '2⃣',
  3: '3⃣',
  4: '4⃣',
  5: '5⃣',
  6: '6⃣',
  7: '7⃣',
  8: '8⃣',
  9: '9⃣',
  10: '🔟'
};
const roles = Object.assign({}, config["discord-available-roles"]);


//State Init
const stateFile = './state.json';
let state = {
  "activeReactionMessage": "",
  "activeStreams": {}
};
if (!fs.existsSync(stateFile)) {
  jsonfile.writeFileSync(stateFile, state);
} else {
  state = jsonfile.readFileSync(stateFile);
}
  
//Discord Init
let botIsReady = false;
const botIntents = new Discord.Intents();
const bot = new Discord.Client({
  intents: ["GUILDS", "GUILD_MEMBERS", "GUILD_BANS", "GUILD_EMOJIS_AND_STICKERS", "GUILD_INTEGRATIONS", "GUILD_WEBHOOKS", "GUILD_INVITES", "GUILD_VOICE_STATES", "GUILD_PRESENCES", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILD_MESSAGE_TYPING", "DIRECT_MESSAGES", "DIRECT_MESSAGE_REACTIONS", "DIRECT_MESSAGE_TYPING"],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  restTimeOffset: 1000
});
let botSpamCheck = [];

botIntents.add("GUILDS", "GUILD_MEMBERS", "GUILD_BANS", "GUILD_EMOJIS_AND_STICKERS", "GUILD_INTEGRATIONS", "GUILD_WEBHOOKS", "GUILD_INVITES", "GUILD_VOICE_STATES", "GUILD_PRESENCES", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILD_MESSAGE_TYPING", "DIRECT_MESSAGES", "DIRECT_MESSAGE_REACTIONS", "DIRECT_MESSAGE_TYPING");

bot.on('ready', () => {
  botIsReady = true;
  console.log('Logged in as %s - %s\n', bot.user.username, bot.user.id);

  if (state.activeReactionMessage.length > 0) {
    bot.guilds.cache.get(activeGuild).channels.cache.get(roleHandlingChannel).messages.fetch(state.activeReactionMessage, true, true);
  }
});

//Role Handling via Reactions
bot.on('messageReactionAdd', (reaction, user) => {
  if (state.activeReactionMessage.length == 0 || state.activeReactionMessage != reaction.message.id)
    return;

  let memberObj = bot.guilds.cache.get(reaction.message.guild.id).members.cache.get(user.id);
  if (memberObj) {

    let roleIndex = Object.keys(numToDiscordEmojis).find(key => numToDiscordEmojis[key] === reaction.emoji.name);

    let roleToAdd = bot.guilds.cache.get(reaction.message.guild.id).roles.cache.find(role => role.name === roles[roleIndex]);
    if (roleToAdd) {

      if (!memberObj.roles.cache.has(roleToAdd)) {
        memberObj.roles.add(roleToAdd).then(newMemberObj => newMemberObj.fetch(true));
      }
    }
  }

})

bot.on('messageReactionRemove', (reaction, user) => {
  if (state.activeReactionMessage.length == 0 || state.activeReactionMessage != reaction.message.id)
    return;

  let memberObj = bot.guilds.cache.get(reaction.message.guild.id).members.cache.get(user.id);

  if (memberObj) {

    let roleIndex = Object.keys(numToDiscordEmojis).find(key => numToDiscordEmojis[key] === reaction.emoji.name);

    let roleToRemove = bot.guilds.cache.get(reaction.message.guild.id).roles.cache.find(role => role.name === roles[roleIndex]);
    if (roleToRemove) {

      memberObj.fetch(true).then(updatedMemberObj => {
        if (updatedMemberObj.roles.cache.find(role => role.name == roleToRemove.name)) {
          updatedMemberObj.roles.remove(roleToRemove).then(updatedMemberObj => updatedMemberObj.fetch(true));
        }
      });
    }
  }
})

//Glitche Sticky Command
function stickyGlitchHandling(message) {
  if (message.content.toLowerCase().startsWith("!sticky")) {
    let trimmedMessage = message.content.trim();
    if (trimmedMessage.length < 10) {
      message.reply("Correct usage is: !sticky <link> <title> !");
      return;
    }

    let args = trimmedMessage.split(' ');
    if (args.length < 3) {
      message.reply("Not enough arguments. Correct usage is: !sticky <link> <title> !");
      return;
    }

    let link = args[1];

    if (!link.includes("http") && !link.includes("www")) {
      message.reply("Bad link. Correct usage is: !sticky <link> <title> !");
      return;
    }

    //https://discordapp.com/channels/83003360625557504/354966434243280896/493870196918845441 //guild/channel/message
    let context = "https://discordapp.com/channels/" + config['discord-server-id'] + "/" + glitchesChannel + "/" + message.id;

    let title = args[2];

    if (args.length > 3) {
      for (var n = 3; n < args.length; n++) {
        title += " " + args[n];
      }
    }

    bot.guilds.cache.get(activeGuild).channels.cache.get(stickyGlitchesChannel).send("**" + title + "**" + "\n" + link + "\n\n" + "*Context:* " + context);

    message.reply("**Glitch was stickied!**");
  }
}


//Role Management
async function roleManagement(message) {
  if (message.member != undefined) {

    //Moderation Commands
    if (message.member.permissions.has("MANAGE_MESSAGES")) {
      if (message.content.toLowerCase() === "!clear") {
        _clearChat(message.channel.id);
        return;
      } else if (message.content.toLowerCase().startsWith("!info")) {

        var postDate = JSON.parse(JSON.stringify(new Date()));
        let embed = {
          "title": "**Role Bot Commands**",
          "description": "This bot can be used to assign different roles in this discord server by reacting to this message.\n**Thank you for being a part of the community!**",
          "color": 1619777,
          "timestamp": postDate,
          "footer": {
            "text": "Discord RoleBot by TreZc0_"
          },
          "author": {
            "name": config["bot-user-name"],
            "icon_url": config["bot-avatar-url"]
          },
          "fields": []
        };

        Object.keys(roles).forEach(roleIndex => {
          let fieldObject = {};

          fieldObject.name = roles[roleIndex];
          fieldObject.value = numToDiscordEmojis[roleIndex];
          embed.fields.push(fieldObject);
        });

        let reactions = [];

        message.channel.send({ embeds: [embed]
          })
          .then(embedMessage => {
            message.delete().catch(console.error);
            embedMessage.pin();

            for (let i = 0; i < Object.keys(roles).length; i++) {
              let emoji = numToDiscordEmojis[i] //0-x number reaction emoji
              //console.log(emoji)
              reactions.push(embedMessage.react(emoji));
            }
            Promise.all(reactions);


            state.activeReactionMessage = embedMessage.id;
            commitState();
          });
      }
    }
  }
};

async function streamNotificationManagement(message) {
  if (message.member != undefined) {
    if (message.member.permissions.has("MANAGE_MESSAGES")) {
      if (message.content.toLowerCase() === "!clear") {
        _clearChat(message.channel.id,true);
        return;
      }
    }
  }
}

//Automatic Stream Announcement
twitch.on('messageStreamStarted', (stream) => {
  //console.log(stream.url +' just went live on Twitch playing ' + stream.game + ': ' + stream.title);
  if (stream.id in state.activeStreams)
    return;


  let channel = bot.guilds.cache.get(activeGuild).channels.cache.get(streamNotificationChannel);

  if (channel) {
    var postDate = JSON.parse(JSON.stringify(new Date()));
    let title = escapeDiscordSpecials(stream.name) + " just went live: " + escapeDiscordSpecials(stream.url);
    title = title.replace("_", "\\_");
    const embed = {
      "title": escapeDiscordSpecials(title),
      "description": escapeDiscordSpecials(stream.title),
      "url": stream.url,
      "color": 1369976,
      "timestamp": postDate,
      "footer": {
        "icon_url": config["bot-avatar-url"],
        "text": "Playing " + stream.game
      },
      "thumbnail": {
        "url": stream.user_profile_image
      },
      "author": {
        "name": escapeDiscordSpecials(stream.name) + " is now live on Twitch!",
        "url": stream.url,
        "icon_url": config["bot-avatar-url"]
      }
    };

    channel.send({embeds: [embed]})
    .catch((e) => {
      console.error(e);
    })
    .then(sentMessage => {
      let stateElem =  { 
        "stream_url": stream.url,
        "stream_title": stream.title,
        "user": stream.name,
        "messageID": sentMessage.id
      };
      state.activeStreams[stream.id] = stateElem;

      commitState();
    });
  
  }
});

//Automatic Stream Cleanup
twitch.on('messageStreamDeleted', (stream) => {
  //console.log (stream.url + " went offline");

  if (!(stream.id in state.activeStreams))
    return;

  delete state.activeStreams[stream.id];
  commitState();

  let channel = bot.guilds.cache.get(activeGuild).channels.cache.get(streamNotificationChannel);
  /*channel.messages.fetch({ limit: 80 })
     .then(messages => {
       messages.forEach(message => */
  channel.messages.fetch({
      limit: 80
    }, true, true)
    .then(messages => {
      messages.each(msgObj => {
        if (!msgObj)
          return;
        if ((msgObj.embeds) && (msgObj.embeds.length > 0)) {
          if (msgObj.embeds[0].url == stream.url) {
            msgObj.delete();
          }
        }
      })
    })
    .catch((e) => {
      console.error(e);
    });
});

//Discord Moderation
function bannedAttachmentCheck(message) {

  const author = message.author;
  const attachmentCollection = message.attachments
  let bannedAttachmentTypeFound = false;

  attachmentCollection.each(att => {
    bannedFileExtensions.forEach(ext => {
      if (att.name.toLowerCase().endsWith(ext))
        bannedAttachmentTypeFound = true;
    });
  });

  if (bannedAttachmentTypeFound) {
    let actionObj = {
      user: author.username,
      channel: {
        name: message.channel.name,
        id: message.channel.id
      },
      offense: "Banned File Extension",
      action: "Message Deleted & User warned",
      messageObj: {
        id: message.id,
        content: message.content,
        att: attachmentCollection.map(val => val.name).join(", ")
      }
    }
    message.delete()
      .catch(ex => {
        console.error(`Cannot delete message with banned ext from ${author.username} in ${message.channel.name}: ${ex}`);
      });

    let warningMsg = `Hey there, ${author.username}! \n You just sent a message containing a forbidden file in our discord. The message has been deleted automatically.\
    \nPlease refrain from sending a file of the following types in the future: ${bannedFileExtensions.join(", ")}\
    \nOur 'welcome' channel contains our server rules - please make sure to read them again and follow them to ensure every community member can have a good time.\
    \n\nBest\n**Your moderation team**`

    message.author.send(warningMsg)
      .catch(ex => {
        console.error(`Cannot send warning DM to user ${author.username} for sending banned file attachment: ${ex}`);
      });


    _logModerationAction(actionObj);
    return true;

  }
  return false;
}

//Message Handler
bot.on('messageCreate', message => {

  let forbiddenMessageDeleted = false;
  if (bannedFileExtensions.length > 0 && message.attachments.size > 0) {
    forbiddenMessageDeleted = bannedAttachmentCheck(message);
  }

  if (forbiddenMessageDeleted)
    return;

  if ((message.content.toLowerCase().includes("nitro for free") || message.content.toLowerCase().includes("free discord nitro") || message.content.toLowerCase().includes("disorde.gift")) && message.member.roles.cache.size < 2) {
    message.member.ban({
        days: 7,
        reason: "Malware Bot, auto banned by bot!"
      })
      .then(() => {
        console.log("Malware Spam Bot banned! Username: " + message.member.user.tag)
        let actionObj = {
          user: message.author.username,
          channel: {
            name: message.channel.name,
            id: message.channel.id
          },
          offense: "Discord Phishing Attempt with suspicious link",
          action: "Message Deleted & User Banned",
          messageObj: {
            id: message.id,
            content: message.content
          }
        }

        _logModerationAction(actionObj);
      })
      .catch(error => console.log("Couldn't ban bot because of the following error: \n" + error));
  }

  if (message.member.roles.cache.size < 2 && (new RegExp('dis(?!cord)[0-9a-zA-Z]{1,}\.gift\/.', 'g').test(message.content.toLowerCase()) || new RegExp('dis(?!cord)[0-9a-zA-Z]{1,}app\.com\/', 'g').test(message.content.toLowerCase()))) {
    message.member.ban({
        days: 7,
        reason: "Malware Bot, auto banned by bot!"
      })
      .then(() => {
        console.log("Malware Spam Bot banned! Username: " + message.member.user.tag)
        let actionObj = {
          user: message.author.username,
          channel: {
            name: message.channel.name,
            id: message.channel.id
          },
          offense: "Discord Phishing Attempt with suspicious link",
          action: "Message Deleted & User Banned",
          messageObj: {
            id: message.id,
            content: message.content
          }
        }

        _logModerationAction(actionObj);
      })
      .catch(error => console.log("Couldn't ban bot because of the following error: \n" + error));
  }

  if (message.member && !message.member.permissions.has("MENTION_EVERYONE") && (message.content.includes("@everyone") || message.content.includes("@here"))) {
    if (botSpamCheck.includes(message.member.user.tag)) {

      message.delete();
      message.member.ban({
          days: 7,
          reason: "Spam Bot with mass pings, auto banned by bot!"
        })
        .then(console.log("Spam Bot wit mass pings banned! Username: " + message.member.user.tag))
        .catch(error => console.info("Couldn't ban bot because of the following error: \n" + error));
      botSpamCheck.splice(botSpamCheck.indexOf(message.member.user.tag), 1);

      let actionObj = {
        user: message.author.username,
        channel: {
          name: message.channel.name,
          id: message.channel.id
        },
        offense: "Repeated unauthorized Everyone/Here Ping",
        action: "Message Deleted & User Banned",
        messageObj: {
          id: message.id,
          content: message.content
        }
      }

      _logModerationAction(actionObj);
    } else {
      message.delete();
      message.reply("Hey there. You have tried to ping everyone in this server. While disabled and thus without effect, we still do not appreciate the attempt. Repeated attempts to mass ping will be met with a ban.\nIn the event of important notifications or alerts that we need to be aware of, please contact staff.").then(disclaimer => {
        setTimeout(() => {
          disclaimer.delete();
        }, 15000);
      })
      let userTag = message.member.user.tag;
      botSpamCheck.push(userTag);

      let actionObj = {
        user: message.author.username,
        channel: {
          name: message.channel.name,
          id: message.channel.id
        },
        offense: "Unauthorized Everyone/Here Ping",
        action: "Message Deleted & Warning issued",
        messageObj: {
          id: message.id,
          content: message.content
        }
      }

      _logModerationAction(actionObj);

      setTimeout(() => {
        if (botSpamCheck.includes(userTag))
          botSpamCheck.splice(botSpamCheck.indexOf(userTag), 1);
      }, 45000);

    }
  }


  if (message.channel.id == roleHandlingChannel)
    roleManagement(message);
  else if (message.channel.id == glitchesChannel)
    stickyGlitchHandling(message);
  else if (message.channel.id == streamNotificationChannel)
    streamNotificationManagement(message);
});

//Discord Handler
function _logModerationAction(actionObj) {
  let channel = bot.guilds.cache.get(activeGuild).channels.cache.get(loggingChannel);

  var postDate = JSON.parse(JSON.stringify(new Date()));

  const embed = {
    "title": "Bot Moderation Action: " + actionObj.action,
    "description": "Reason: " + actionObj.offense,
    "url": `https://discord.com/channels/${activeGuild}/${actionObj.channel.id}/${actionObj.messageObj.id}`,
    "color": 13632027,
    "timestamp": postDate,
    "footer": {
      "icon_url": config["bot-avatar-url"],
      "text": config["bot-user-name"] + " - Auto Moderation"
    },
    "fields": [{
        "name": "User",
        "value": actionObj.user,
        "inline": true
      },
      {
        "name": "Channel",
        "value": actionObj.channel.name,
        "inline": true
      },
      {
        "name": "Original Message",
        "value": actionObj.messageObj.content,
        "inline": true
      }
    ],
    "author": {
      "name": config["bot-user-name"],
      "icon_url": config["bot-avatar-url"]
    }
  };

  if (("att" in actionObj.messageObj) && actionObj.messageObj.att.length > 0) {
    embed.fields.push({
      "name": "Message Attachment(s)",
      "value": actionObj.messageObj.att,
      "inline": true
    })
  }

  channel.send({ embeds: [embed]
  }).catch((e) => {
    console.error(e);
  });
}


async function _clearChat(textChannelID, wipeStreams = false) {

  let channel = bot.channels.cache.get(textChannelID);

  if (!channel)
    return;

  let messages = await wipeChannelAndReturnMessages(channel);

  console.log("Channel Clearing: Removed", messages.size, "messages in channel", channel.name);
  if (wipeStreams) {
    state.activeStreams = {};
    commitState();
  }
}

async function wipeChannelAndReturnMessages(textChannel) {
  console.log("clearing all messages from " + textChannel.id);

  let deletedMessages = await textChannel.bulkDelete(99, true);

  let msgPool = deletedMessages;

  while (deletedMessages.size > 0) {
    deletedMessages = await textChannel.bulkDelete(99, true);
    if (deletedMessages.size > 0)
      msgPool = msgPool.concat(deletedMessages); 
  }

  return msgPool;
}

//Cleanup
function checkForOutdatedStreams() {
  for (stream in state.activeStreams) {
    let streamObj = state.activeStreams[stream];
     //if streamObj has not been updated in 12 hours (for example, in event of a bot crash)
    if ((streamObj.lastUpdate + 12*60*60) < new Date().getTime()) {
      bot.guilds.cache.get(activeGuild).channels.cache.get(streamNotificationChannel).fetch(state.activeStream[stream].messageID)
      .then(fetchedMsg => {
        fetchedMsg.delete()
        .then(() => console.log(`Deleted abandoned stream message for stream ${state.activeStreams[stream]["display_name"]}`))
        .catch(console.error);
      })
      
      delete state.activeStream[stream]
      commitState();
    }
  }
}

function commitState() {
  jsonfile.writeFile(stateFile, state, { spaces: 2 }, function (err) {
    if (err) console.error(err)
  });
}

function escapeDiscordSpecials(inputString) {
  return inputString.replace(/_/g, "\_").replace(/\*/g, "\\*").replace(/~/g, "\~");
}


//Init
bot.login(discordToken)
.catch(err => {
  console.error(err);
});


bot.on('error', () => {
  console.error("The bot encountered a connection error!!");

  setTimeout(() => {

    bot.login(discordToken);
  }, 10000);
});

bot.on('disconnect', () => {
  console.error("The bot disconnected!!");

  botIsReady = false;

  setTimeout(() => {
    bot.login(discordToken);
  }, 10000);
});

setInterval(() => {
  checkForOutdatedStreams();
}, 300000);
