const rp = require('request-promise');
const EventEmitter = require('events');

const editJsonFile = require("edit-json-file");
const json = editJsonFile("./config.json");
const config = json.get();
var game;
const streamEmitter = new EventEmitter();
let startup = false;
let streams = { };
let tags = [
  "7cefbf30-4c3e-4aa7-99cd-70aabb662f27", 
  "2fd30cb8-f2e5-415d-9d42-1316cfa61367",
  "0b83a789-5f6a-45f0-b6a3-a56926b6f8b5",
];//Speedrun, Randomizer, TAS
async function getOauthToken() {
  if (Date.now() < config["twitch-access-token-expires-At"] && config["twitch-access-token"].length > 0) {
    return config["twitch-access-token"];
  }
  const res = await rp.post("https://id.twitch.tv/oauth2/token", {
    body: {
      "client_id": config["twitch-client-id"],
      "client_secret": config["twitch-client-secret"],
      "grant_type": "refresh_token",
      "refresh_token": config["twitch-refresh-token"],
    },
    json: true,
  });
  if (!res["access_token"]) {
    throw new Error("API did not provide an OAuth token!");
  }
  updateConfig("twitch-access-token", res["access_token"]);
  updateConfig("twitch-access-token-expires-At",Date.now() + 3500 * 1000);

  return res["access_token"];
}

function getStreams(token) {
  return rp.get("https://api.twitch.tv/helix/streams", {
    headers: {
      "Client-ID": config["twitch-client-id"],
      "Authorization": "Bearer " + token,
    },
    qs: {
      "game_id": config["target-game-id"],
      "first": 99,
      "type": 'live',
    },
    json: true,
  });
}

function getUsers (ids) {
  return rp.get("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": config["twitch-client-id"],
      "Authorization": "Bearer " + config["twitch-access-token"],
    },
    qs: {
      "id": ids,
    },
    json: true,
  });
}

async function streamLoop () {
  // Uncomment for logging.
  //console.log("Get streams...");
  //console.log(".--current streams--.");
  //console.log(streams)
  //console.log("'-------------------'");
  getOauthToken().then((token) => {
    return getStreams(token);
  }).then((data) => {
    let res = data.data;
    let user_ids = [ ];
    for (let i = 0;i<res.length;i++) {
      let stream = res[i];
      if (stream.tag_ids) {
        var speedrun = tags.find(tag => {
          if (stream.tag_ids.includes(tag))
            return true;
          return false;
        });
      }
      if (speedrun) {
        user_ids.push(stream["user_id"]);
        if (typeof streams[stream["user_id"]] === 'undefined') {
          streams[stream["user_id"]] = { };
        }
        streams[stream["user_id"]]["timer"] = 15;
        streams[stream["user_id"]]["title"] = stream["title"];
        streams[stream["user_id"]]["viewer_count"] = stream["viewer_count"];
        streams[stream["user_id"]]["game_id"] = stream["game_id"]
      }      
    }
    if (user_ids.length > 0) {
      return getUsers(user_ids);
    }
    return null;
  }).then((data) => {
    if (data === null) {
      return;
    }
    let res = data.data;
    for (let i = 0;i<res.length;i++) {
      let stream = res[i];
      if (typeof streams[stream["id"]]["url"] === 'undefined') {
        if (startup === true) {
          streamEmitter.emit('messageStreamStarted', {
            "url": 'https://www.twitch.tv/' + stream["login"],
            "name": stream["login"],
            "title": streams[stream["id"]]["title"],
            "game": "Breath of the Wild",
            // "id": stream["id"],
            // "display_name": stream["display_name"],
            // "login": stream["login"]
          });
        }
      }
      streams[stream["id"]]["url"] = 'https://www.twitch.tv/' + stream["login"];
      streams[stream["id"]]["display_name"] = stream["display_name"];
      streams[stream["id"]]["login"] = stream["login"];
    }
    return;
  }).catch((e) => {
    console.error(e);
  }).then(() => {
    if (startup === false) {
      startup = true;
    }
    setTimeout(streamLoop, 30000);
  });
}

function updateConfig(key, value) {
  config[key] = value;
  json.set(key,  value);
  json.save();
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
}, 20000);
streamEmitter.getStreams = () => {
  return streams;
}
module.exports = streamEmitter;
