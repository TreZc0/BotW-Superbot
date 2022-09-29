const EventEmitter = require('events');

const jsonfile = require('jsonfile');
const axios = require('axios');
const qs = require('qs');

const configFile = './config.json';
const config = jsonfile.readFileSync(configFile);
const streamEmitter = new EventEmitter();

let startup = true;
let streams = {};
let tags = config["target-stream-tags"];
let titleWordlist = config["target-stream-title-wordlist"];
let detectionMode = config["target-stream-detection-type"];

if (detectionMode == undefined)
  detectionMode = "tags";

async function getOauthToken() {
  if (Date.now() < config["twitch-access-token-expires-At"] && config["twitch-access-token"] && config["twitch-access-token"].length > 0) {
    return config["twitch-access-token"];
  }
  const res = await axios({
    url: "https://id.twitch.tv/oauth2/token",
    method: "POST",
    headers: {},
    data: {
      client_id: config["twitch-client-id"],
      client_secret: config["twitch-client-secret"],
      "grant_type": "refresh_token",
      refresh_token: config["twitch-refresh-token"],
    }
  });
  if (!res.data["access_token"]) {
    throw new Error("API did not provide an OAuth token!");
  }
  if (res.data["access_token"]) {
    updateConfig("twitch-access-token", res.data["access_token"]);
    updateConfig("twitch-access-token-expires-At", Date.now() + 3500 * 1000);
  }
  return res.data["access_token"];
}

function getStreams(token) {
  return axios({
    url: `https://api.twitch.tv/helix/streams?game_id=${config["target-game-ids"].join("&game_id=")}&first=99&type=live`,
    method: "GET",
    headers: {
      "Client-ID": config["twitch-client-id"],
      "Authorization": "Bearer " + token,
    },
    params: {
      "game_id": config["target-game-ids"],
      "first": 99,
      "type": 'live',
    }
  });
}

function getUsers(ids) {
  return axios({
    url: "https://api.twitch.tv/helix/users",
    method: "GET",
    headers: {
      "Client-ID": config["twitch-client-id"],
      "Authorization": "Bearer " + config["twitch-access-token"],
    },
    params: {
      "id": ids,
    }
  });
}

async function streamLoop() {
  // Uncomment for logging.
  //console.log("Get streams...");
  //console.log(".--current streams--.");
  //console.log(streams)
  //console.log("'-------------------'");
  getOauthToken().then((token) => {
    return getStreams(token);
  }).then((res) => {
    let streamData = res.data.data;
    let user_ids = [];
    for (let i = 0; i < streamData.length; i++) {
      let stream = streamData[i];
      let speedrun = false;
      if (detectionMode == "tags") { //tags mode
        if (stream.tag_ids) {
          speedrun = tags.find(tag => {
            if (stream.tag_ids.includes(tag))
              return true;
            return false;
          });
        } 
      } else { //title mode
            speedrun = titleWordlist.some(val => {
            let regex = new RegExp('(^|\\s|!|-|\\.|\\?|,)' + val.toLowerCase() + '($|\\s|!|-|\\.|\\?|,)', 'g')

            return regex.test(stream["title"].toLowerCase());
          });
      }

      if (speedrun) {
        user_ids.push(stream["user_id"]);
        if (typeof streams[stream["user_id"]] === 'undefined') {
          streams[stream["user_id"]] = {};
        }
        streams[stream["user_id"]]["timer"] = 15;
        streams[stream["user_id"]]["title"] = stream["title"];
        streams[stream["user_id"]]["viewer_count"] = stream["viewer_count"];
        streams[stream["user_id"]]["game_id"] = stream["game_id"];
        streams[stream["user_id"]]["game_name"] = stream["game_name"];
      }
    }
    if (user_ids.length > 0) {
      return getUsers(user_ids);
    }
    return null;
  }).then((response) => {
    if (response === null) {
      return;
    }
    let userData = response.data.data;
    for (let i = 0; i < userData.length; i++) {
      let userElem = userData[i];
      if (typeof streams[userElem["id"]]["url"] === 'undefined') {
        if (startup === true) {
          streamEmitter.emit('messageStreamStarted', {
            "id": userElem["id"],
            "url": 'https://www.twitch.tv/' + userElem["login"],
            "name": userElem["login"],
            "title": streams[userElem["id"]]["title"],
            "game": streams[userElem["id"]]["game_name"],
            "user_profile_image": userElem["profile_image_url"]
          });
        }
      }
      streams[userElem["id"]]["url"] = 'https://www.twitch.tv/' + userElem["login"];
      streams[userElem["id"]]["display_name"] = userElem["display_name"];
      streams[userElem["id"]]["login"] = userElem["login"];
      streams[userElem["id"]]["lastUpdate"] = new Date().getTime();
    }
    return;
  }).catch((e) => {
    console.error(e);
  }).then(() => {
    setTimeout(streamLoop, 30000);
  });
}


function updateConfig(key, value) {
  config[key] = value;
  jsonfile.writeFile(configFile, config, { spaces: 2 }, function (err) {
    if (err) console.error(err)
  });
}

setTimeout(streamLoop, 15000);
setInterval(() => {
  for (let stream of Object.keys(streams)) {
    streams[stream]["timer"]--;
    if (streams[stream]["timer"] < 1) {
      if (typeof streams[stream]["url"] !== 'undefined' && typeof streams[stream]["title"] !== 'undefined') {
        streamEmitter.emit('messageStreamDeleted', {
          "url": streams[stream]["url"],
          "title": streams[stream]["title"],
          "id": stream
        });
      }
      delete streams[stream];
    }
  }
}, 10000);
streamEmitter.getStreams = () => {
  return streams;
}
module.exports = streamEmitter;
