const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const spamMap = new Map();
const joinTimes = [];

function isStaff(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID);
}

async function log(guild, title, desc, color = 0x8b00ff) {
  const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Le Terrain Sécurité • Logs" });

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 CENTRE D’AIDE — LE TERRAIN DES ROIS")
    .setDescription(
      "Choisis une catégorie pour ouvrir un ticket.\n\n" +
      "🛠️ **Support** — problème général\n" +
      "🚨 **Signalement** — tricheur / comportement toxique\n" +
      "🏀 **Pro-Am** — recrutement équipe\n" +
      "🤝 **Partenariat** — collaboration"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain Sécurité • Tickets" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_support").setLabel("Support").setEmoji("🛠️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket_signalement").setLabel("Signalement").setEmoji("🚨").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_proam").setLabel("Pro-Am").setEmoji("🏀").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket_partenaire").setLabel("Partenariat").setEmoji("🤝").setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = `ticket-${type}-${username}`;

  const existing = guild.channels.cache.find(c => c.name === name);
  if (existing) return interaction.reply({ content: `❌ Tu as déjà un ticket : ${existing}`, ephemeral: true });

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket ${type}`)
    .setDescription(`Salut ${interaction.user}, explique ta demande clairement.\nUn staff va te répondre.`)
    .setColor(0x8b00ff)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fermer").setEmoji("🔒").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`, embeds: [embed], components: [row] });
  await log(guild, "🎫 Ticket créé", `${interaction.user.tag} a ouvert ${channel}.`, 0x00ff00);
  return interaction.reply({ content: `✅ Ticket créé : ${channel}`, ephemeral: true });
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === "!ticketpanel") {
    if (!isStaff(message.member)) {
      return message.reply("❌ Tu n’es pas reconnu staff. Vérifie `STAFF_ROLE_ID` ou mets le rôle du bot au-dessus.");
    }
    return sendTicketPanel(message.channel);
  }

  if (isStaff(message.member)) return;

  if (/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(message.content)) {
    await message.delete().catch(() => {});
    await message.member.timeout(15 * 60 * 1000, "Pub Discord interdite").catch(() => {});
    return log(message.guild, "🚫 Pub Discord bloquée", `${message.author.tag} a envoyé une invite dans ${message.channel}.`, 0xff0000);
  }

  const now = Date.now();
  const id = message.author.id;
  const list = (spamMap.get(id) || []).filter(t => now - t < 5000);
  list.push(now);
  spamMap.set(id, list);

  if (list.length >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(10 * 60 * 1000, "Spam rapide").catch(() => {});
    return log(message.guild, "⚠️ Anti-spam", `${message.author.tag} a spam.`, 0xffaa00);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith("ticket_")) {
    return createTicket(interaction, interaction.customId.replace("ticket_", ""));
  }

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Seul le staff peut fermer.", ephemeral: true });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");
    await log(interaction.guild, "🔒 Ticket fermé", `${interaction.user.tag} a fermé ${interaction.channel}.`, 0xffaa00);
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
});

client.once("ready", () => {
  console.log(`✅ Le Terrain Sécurité connecté : ${client.user.tag}`);
});

client.login(process.env.TOKEN);
