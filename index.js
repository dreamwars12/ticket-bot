```js
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`✅ Connecté : ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  console.log(`📩 Message reçu : ${message.content}`);

  if (message.content.toLowerCase() === "!test") {
    await message.reply("✅ Bot sécurité fonctionne !");
  }

  if (message.content.toLowerCase() === "!ping") {
    await message.reply("🏓 Pong !");
  }
});

client.login(process.env.TOKEN);
```
