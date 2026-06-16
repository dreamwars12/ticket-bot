```js
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`✅ Le Terrain Sécurité connecté : ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log(`📩 Message reçu : ${message.content}`);

  if (message.content.toLowerCase() === "!test") {
    await message.reply("✅ Le bot fonctionne !");
  }

  if (message.content.toLowerCase() === "!ping") {
    await message.reply("🏓 Pong !");
  }

  if (message.content.toLowerCase() === "!help") {
    await message.reply(`
📋 Commandes disponibles :

!test → Vérifier que le bot fonctionne
!ping → Tester la latence
!help → Voir les commandes
    `);
  }
});

client.on("guildMemberAdd", async (member) => {
  console.log(`👤 Nouveau membre : ${member.user.tag}`);
});

client.login(process.env.TOKEN);
```
