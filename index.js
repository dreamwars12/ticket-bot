const {
  Client,
  GatewayIntentBits,
  Partials,
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
  ],
  partials: [Partials.Channel]
});

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const spamMap = new Map();
const joinTimes = [];

function isStaff(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID);
}

async function log(guild, title, desc, color = 0xff0000) {
  const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => {});
}

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 SUPPORT — LE TERRAIN DES ROIS")
    .setDescription(
      "Besoin d’aide ? Ouvre un ticket avec le bouton adapté.\n\n" +
      "🛠️ **Support**\n" +
      "🚨 **Signaler un tricheur**\n" +
      "🏀 **Recrutement Pro-Am**\n" +
      "🤝 **Partenariat**"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain des Rois • Tickets" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_support").setLabel("Support").setEmoji("🛠️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket_tricheur").setLabel("Tricheur").setEmoji("🚨").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_proam").setLabel("Pro-Am").setEmoji("🏀").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket_partenaire").setLabel("Partenariat").setEmoji("🤝").setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const name = `ticket-${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

  const existing = guild.channels.cache.find(c => c.name === name);
  if (existing) {
    return interaction.reply({ content: `Tu as déjà un ticket : ${existing}`, ephemeral: true });
  }

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket ${type}`)
    .setDescription(`Salut ${interaction.user}, explique ton problème.\nUn staff va te répondre bientôt.`)
    .setColor(0x8b00ff)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("Fermer").setEmoji("🔒").setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`, embeds: [embed], components: [row] });
  await log(guild, "🎫 Ticket créé", `${interaction.user.tag} a ouvert un ticket **${type}** dans ${channel}.`, 0x00ff00);
  await interaction.reply({ content: `Ticket créé : ${channel}`, ephemeral: true });
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === "!ticketpanel") {
    if (!isStaff(message.member)) return;
    return sendTicketPanel(message.channel);
  }

  if (isStaff(message.member)) return;

  if (/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(message.content)) {
    await message.delete().catch(() => {});
    await log(message.guild, "🚫 Pub Discord bloquée", `${message.author.tag} a envoyé une invitation dans ${message.channel}.`);
    return;
  }

  if (message.mentions.everyone || message.mentions.users.size >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(10 * 60 * 1000, "Anti mass mention").catch(() => {});
    await log(message.guild, "🚨 Anti-mass mention", `${message.author.tag} mute 10 minutes.`);
    return;
  }

  const now = Date.now();
  const id = message.author.id;
  if (!spamMap.has(id)) spamMap.set(id, []);

  const list = spamMap.get(id).filter(t => now - t < 5000);
  list.push(now);
  spamMap.set(id, list);

  if (list.length >= 5) {
    await message.delete().catch(() => {});
    await message.member.timeout(5 * 60 * 1000, "Anti spam").catch(() => {});
    await log(message.guild, "⚠️ Anti-spam", `${message.author.tag} mute 5 minutes.`);
  }
});

client.on("guildMemberAdd", async (member) => {
  const now = Date.now();
  joinTimes.push(now);

  while (joinTimes.length && now - joinTimes[0] > 30000) joinTimes.shift();

  const age = now - member.user.createdTimestamp;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  await log(member.guild, "👤 Nouveau membre", `${member.user.tag} a rejoint.`, 0x00ff00);

  if (age < sevenDays) {
    await log(member.guild, "🔒 Anti-alt", `${member.user.tag} a un compte de moins de 7 jours.`);
  }

  if (joinTimes.length >= 8) {
    await log(member.guild, "🚨 ALERTE RAID", `${joinTimes.length} membres ont rejoint en 30 secondes.`);
  }
});

client.on("guildMemberRemove", async (member) => {
  await log(member.guild, "📤 Départ", `${member.user.tag} a quitté le serveur.`, 0xffaa00);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith("ticket_")) {
    const type = interaction.customId.replace("ticket_", "");
    return createTicket(interaction, type);
  }

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "Tu n’as pas la permission.", ephemeral: true });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");
    await log(interaction.guild, "🔒 Ticket fermé", `${interaction.user.tag} a fermé ${interaction.channel}.`, 0xffaa00);

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

client.once("ready", () => {
  console.log(`✅ Ticket bot connecté : ${client.user.tag}`);
});

client.login(process.env.TOKEN);
