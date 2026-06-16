const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log("MESSAGE RECU :", message.content);

  if (message.content === "!test") {
    message.reply("✅ Bot sécurité fonctionne !");
  }
});

client.once("ready", () => {
  console.log(`✅ Connecté : ${client.user.tag}`);
});

client.login(process.env.TOKEN);
