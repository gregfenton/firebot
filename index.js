const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');

require('dotenv').config();
require('http').createServer().listen(3000);
const config = require("./config.json");
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;




/////////////////////
// TRACKERS
/////////////////////
let StartUp = false;
if (!StartUp) {
  StartUp = true;
  try {
    client.login(process.env.TOKEN);
  } catch (e) {
    console.log(e);
  }
}

///////////////////////
// MAIN PROCESS START
///////////////////////

function ProcessEvent(event, client) {
  try {
    if (event.t == "MESSAGE_REACTION_REMOVE" || event.t == "MESSAGE_REACTION_ADD") {
      const meta = event.d;

      let targetRole;
      // IS MESSAGE AGREE ROLE?
      if (config.ROLES[[meta.channel_id, meta.message_id].join(':')])
        targetRole = config.ROLES[[meta.channel_id, meta.message_id].join(':')];

      // IS MESSAGE TIMEZONE?
      else if (config.TIMEZONE_ROLES[[meta.channel_id, meta.message_id].join(':')])
        giveTimezone(meta.channel_id, meta.user_id, config.TIMEZONE_ROLES[[meta.channel_id, meta.message_id].join(':')]);

      // IS MESSAGE ROLE TABLE?
      else if (objectContains(meta, config.ROLE_TABLE))
        targetRole = config.ROLES[meta.emoji.id] || config.ROLES[meta.emoji.name];
      // console.log(`<${meta.emoji.name}:${meta.emoji.id}>`);


      if (targetRole == null) return;

      if (event.t == "MESSAGE_REACTION_ADD")
        giveRole(meta.channel_id, meta.user_id, targetRole);
      if (event.t == "MESSAGE_REACTION_REMOVE")
        takeRole(meta.channel_id, meta.user_id, targetRole);
    }
  } catch (e) {
    console.log(e);
  }
}


// I've been informed several times to not store some values in global for obvious conflict reasons.
// and if not named correctly, I can see issues. 
// but i can't see much of a difference between global and process.env which seems to be a more 'sound' alternative, but is it really?


////////////////////////
// BOT CRON SCHEDULES //
////////////////////////

const UpdateTimes = new CronJob('0 */15 * * * *', function () {
  Object.keys(config.TIMEZONE_NODES).forEach((timezone, index) => {

    console.log('Updating Timezone:', config.TIMEZONE_NODES[timezone].offset);
    const UpdateTimes = (() => {
      client.guilds.cache.forEach(guild => {
        r = guild.roles.cache.get(config.TIMEZONE_NODES[timezone].role);// .find(role => role.id === 
        r.setName(moment().tz(config.TIMEZONE_NODES[timezone].offset).format("dddd, Do , h:mm a"));
      });
    });
    setTimeout(UpdateTimes, 1000 + (2500 * index));
  });
});
UpdateTimes.start();


////////////////////////
// DISCORD ON(EVENTS) //
////////////////////////
client.on('message', message => {
  if (message.author.bot) return;	// is the user someone I should respond too?
  if (message.channel.type === "text")
    ProcessMessage(message);
});
client.on('raw', event => {
  ProcessEvent(event, client);
});
client.on('error', e => {
  console.log(e);
});
client.on('error', e => {
  console.log(e);
});


async function ProcessMessage(message) {

  if (!message.content.startsWith(config.PREFIX)) return; // is this a command?
  if (message.member.roles.cache.get(config.MOD_ROLE)) {
    const parse = ParseMessage(message);
    try {
      switch (parse.command) {
        case "help": message.channel.send(`Commands:
        !link EMOTE @ROLE
        !unlink EMOTE
        !set http://discord/message/url

        !accept EMOTE
        !decline EMOTE

        !setrole @ROLE http://discord/message/url
        !removerole http://discord/message/url
        !linktz @ROLE @ROLETRACKER moment-timezone-offset`);
          break;

        case "link": UpdateLink(parse); break;
        case "unlink": DeleteLink(parse); break;
        case "set": SetTable(parse); break;

        case "accept": SetAccept(parse); break;
        case "decline": SetDecline(parse); break;

        case "setrole": SetRole(parse); break;
        case "removerole": RemoveRole(parse); break;

        case "linktz": LinkTz(parse); break;
        case "settz": SetTz(parse); break;
        case "removetz": RemoveTz(parse); break;
      }
    } catch (error) {
      console.error(error);
      message.reply('there was an error trying to execute that command!');
    }
  }
}

function ParseMessage(msg) {
  // Clean message content
  _args = msg.content.replace(/ /g, ' ').split(/\s+/); //split message into sections based on spaces, ignore any 0 length values
  try {
    _args[0] = _args[0].replace(config.PREFIX, ''); // purge prefix from first arg to get pure value
    if (_args[0] == '')
      _args.shift();
    _command = _args.shift() || ""; // shift command from array list and save as a command
    _argresult = _args.join(' '); //condense array into simplified string for secondary parsing
    _command = _command.toLowerCase();
  }
  catch (e) {
    console.log(e);
    Log.LogEvent(msg, { command: "FATAL ERROR", args: [], argresult: msg.content }, 0xe52dbd);
  }
  return {
    command: _command,
    args: _args,
    argresult: _argresult
  };
}

function objectContains(input, mask) {
  for (let key of Object.keys(mask)) {
    if (input[key] !== mask[key]) {
      return false;
    }
  }
  return true;
}

async function giveRole(channel, user, role_id) {
  try {
    c = client.channels.cache.get(channel);
    m = await c.guild.members.fetch(user);
    console.log(role_id);
    r = c.guild.roles.cache.get(role_id);
    m.roles.add(r);
  }
  catch (e) {
    console.log(e);
  }
}

async function takeRole(channel, user, role_id) {
  try {
    c = client.channels.cache.get(channel);
    m = await c.guild.members.fetch(user);
    console.log(role_id);
    r = c.guild.roles.cache.get(role_id);
    m.roles.remove(r);
  }
  catch (e) {
    console.log(e);
  }
}


async function SetRole(parse) {
  const urlMessage = config.ROLE_TABLE = DecodeUrl(parse.args[1]);
  const targetRole = EmoteID(parse.args[0]);
  if (urlMessage != null) {
    if (!config.ACCEPT) return;
    const newMessage = await client.channels.cache.get(urlMessage.channel).fetchMessage(urlMessage.message);
    newMessage.react(config.ACCEPT);
    config.ROLES[[newMessage.channel.id, newMessage.id].join(':')] = targetRole;
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
  }
}
async function RemoveRole(parse) {
  const urlMessage = config.ROLE_TABLE = DecodeUrl(parse.args[0]);
  if (urlMessage != null) {
    const newMessage = await client.channels.cache.get(urlMessage.channel).fetchMessage(urlMessage.message);
    newMessage.reactions.cache.get(config.ACCEPT).remove().catch(error => console.error('Failed to remove reactions: ', error));
    delete config.ROLES[[newMessage.channel.id, newMessage.id].join(':')];
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
  }
}

// CONFIGURE ACCEPT AND DECLINE EMOTES
function SetAccept(parse) {
  config.ACCEPT = EmoteID(parse.args[0]);
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}
function SetDecline(parse) {
  config.DECLINE = EmoteID(parse.args[0]);
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}


// MANAGE EMOTE AND ROLE LINKS
function UpdateLink(parse) {
  const emote = EmoteID(parse.args[0]);
  const role = EmoteID(parse.args[1]);
  config.ROLES[emote] = role;
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}
function DeleteLink(parse) {
  const emote = EmoteID(parse.args[0]);
  delete config.ROLES[emote];
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}

// DEPLOY ROLE TABLE TO MESSAGE
async function SetTable(parse) {
  const urlMessage = config.ROLE_TABLE = DecodeUrl(parse.argresult);
  if (urlMessage != null) {
    const newMessage = await client.channels.cache.get(urlMessage.channel).fetchMessage(urlMessage.message);
    SetEmotes(newMessage);
    config.ROLE_TABLE = urlMessage;
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
  }
}

function LinkTz(parse) {
  // LINK A PARENT ROLE WITH A ROLLING ROLL FOR TIMEZONE WITH OFFSET
  //if (!moment.tz.names()[parse.args[2]]) return;

  fs.writeFileSync("./timezones.json", JSON.stringify(moment.tz.names(), null, 4));
  // needs to ensure both arg0 and arg 1 are both roles
  config.TIMEZONE_NODES[EmoteID(parse.args[0])] = { role: EmoteID(parse.args[1]), offset: parse.args[2] };
  console.log(config.TIMEZONE_NODES[EmoteID(parse.args[0])]);
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
}
async function SetTz(parse) {
  // LINK TIMEZONE PARENT ROLE TO MESSAGE
  const urlMessage = config.ROLE_TABLE = DecodeUrl(parse.args[1]);
  const targetRole = EmoteID(parse.args[0]);
  if (!config.TIMEZONE_NODES[targetRole]) return;
  if (urlMessage != null) {
    if (!config.ACCEPT) return;
    const newMessage = await client.channels.cache.get(urlMessage.channel).messages.fetch(urlMessage.message);
    newMessage.react(config.ACCEPT);
    config.TIMEZONE_ROLES[[newMessage.channel.id, newMessage.id].join(':')] = targetRole;
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
  }
}
async function RemoveTz(parse) {
  // REMOVE TIMEZONE PARENT ROLE TO MESSAGE
  const urlMessage = config.ROLE_TABLE = DecodeUrl(parse.args[0]);
  if (urlMessage != null) {
    const newMessage = await client.channels.cache.get(urlMessage.channel).fetchMessage(urlMessage.message);
    newMessage.reactions.cache.get(config.ACCEPT).remove().catch(error => console.error('Failed to remove reactions: ', error));
    delete config.TIMEZONE_ROLES[[newMessage.channel.id, newMessage.id].join(':')];
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
  }
}

async function giveTimezone(channel, user, targetRole) {
  // REMOVE OTHER TIMEZONE ROLES
  // CLEAR OTHER TIMEZONE REACTS
  try {
    c = client.channels.cache.get(channel);
    m = await c.guild.members.cache.get(user);
    if (m.user.bot) return;
    var rolesList = Object.values(config.TIMEZONE_ROLES);
    var clockRoles = Object.entries(config.TIMEZONE_NODES).map((clock) => clock[1].role);
    rolesList = rolesList.concat(clockRoles);
    rolesList = rolesList.filter(item => item != targetRole && item != config.TIMEZONE_NODES[targetRole].role);
    // r1 = c.guild.roles.cache.get(targetRole);
    // r2 = c.guild.roles.cache.get(config.TIMEZONE_NODES[targetRole].role);

    console.log("TARGET ROLE:" + targetRole);
    m.roles.remove(rolesList)
      .then(() => m.roles.add([targetRole, config.TIMEZONE_NODES[targetRole].role]))
      .finally(async () => {
        const timezoneRoles = Object.keys(config.TIMEZONE_ROLES);
        for (let index = 0; index < timezoneRoles.length; index++) {
          // console.log(timezoneRoles[index]);
          // console.log(timezoneRoles[index].split(':')[1]);
          message = await c.messages.fetch(timezoneRoles[index].split(':')[1]);

          finalList = Object.keys(config.TIMEZONE_ROLES).map(item => config.TIMEZONE_ROLES[item] != targetRole);

          // GOD this is a mess


          // i'm not 100%, but what I remember doing for uncached reactions was I retrieved the MessageReaction 
          // object by the emoji, there's a method on reaction.users.fetch() you call to get all of the users that 
          // reacted to the message w/ that emoji and then you can remove it
          // it only returns 100 max so you would need to handle getting the other reactions after the 100th one

          const selected = !rolesList.includes(config.TIMEZONE_ROLES[[message.channel.id, message.id].join(':')]);
          if (selected) console.log(message.content);
          if (selected) continue;
          // if (finalList[[message.channel.id, message.id].join(':')]) continue;
          // console.log(targetRole.split(':')[1]);

          await message.reactions.resolveID(config.ACCEPT);
          const userReactions = await message.reactions.cache.filter(reaction => reaction.users.cache.has(user));
          console.log(JSON.stringify(userReactions));
          try {
            for (const reaction of userReactions.values()) {
              await reaction.users.remove(user);
            }
          } catch (error) {
            console.log(error);
            console.error('Failed to remove reactions.');
          }
        }
      });
    // m.roles.remove(c.guild.roles.cache.filter(roles => rolesList.includes(roles.id)));
    // m.roles.remove(rolesList);
    // m.roles.add([targetRole, config.TIMEZONE_NODES[targetRole].role]);
  }
  catch (e) {
    console.log(e);
  }
}


// CORE FUNCTIONS
function DecodeUrl(url) {
  if (typeof url != "string") return null;
  var properties = url.toString().split("/");
  if (properties.length == 7) {
    var _channelID = properties[5];
    var _messageID = properties[6];
    return {
      channel: _channelID,
      message: _messageID
    };
  }
  else return null;
}

function SetEmotes(msg) {
  Object.keys(config.ROLES).forEach(item => {
    console.log(item);
    msg.react(item);//item.match(fetchNumbers).join(""));
  });
}

const fetchNumbers = /[0-9]*/g;
function EmoteID(_emote) {
  var emote = _emote.match(fetchNumbers).join("");
  if (emote.length <= 1)
    emote = _emote;
  return emote;
}