const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  SlashCommandBuilder
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
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;

const spamMap = new Map();
const joinTimes = [];
const warnings = new Map();

function isStaff(member) {
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

  channel.send({ embeds: [embed] }).catch(() => {});
}

async function punish(member, reason, minutes = 10) {
  await member.timeout(minutes * 60 * 1000, reason).catch(() => {});
}

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 CENTRE D’AIDE — LE TERRAIN DES ROIS")
    .setDescription(
      "Bienvenue dans le **support officiel**.\n\n" +
      "Choisis la bonne catégorie pour recevoir de l’aide rapidement.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "🛠️ **Support** — problème général\n" +
      "🚨 **Signalement** — tricheur, comportement toxique\n" +
      "🏀 **Recrutement Pro-Am** — rejoindre une équipe\n" +
      "🤝 **Partenariat** — demande de collaboration\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "⚠️ Merci d’expliquer ton problème clairement dans le ticket."
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain Sécurité • Tickets" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_support")
      .setLabel("Support")
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_tricheur")
      .setLabel("Signalement")
      .setEmoji("🚨")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("ticket_proam")
      .setLabel("Pro-Am")
      .setEmoji("🏀")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("ticket_partenaire")
      .setLabel("Partenariat")
      .setEmoji("🤝")
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = `ticket-${type}-${cleanName}`;

  const existing = guild.channels.cache.find(c => c.name === name);
  if (existing) {
    return interaction.reply({
      content: `❌ Tu as déjà un ticket ouvert : ${existing}`,
      ephemeral: true
    });
  }

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages
        ]
      }
    ]
  });

  const questions = {
    support: "Explique ton problème avec le plus de détails possible.",
    tricheur: "Envoie le pseudo du joueur, une preuve vidéo/screen et explique la situation.",
    proam: "Présente ton poste, ton build, ton niveau et tes disponibilités.",
    partenaire: "Présente ton serveur/chaîne, ton nombre de membres et ce que tu proposes."
  };

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket ${type.toUpperCase()}`)
    .setDescription(
      `Salut ${interaction.user} 👋\n\n` +
      `${questions[type] || "Explique ta demande clairement."}\n\n` +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "📌 **Règles du ticket :**\n" +
      "• Pas de spam\n" +
      "• Pas d’insultes\n" +
      "• Explique clairement ta demande\n" +
      "• Attends une réponse du staff\n" +
      "━━━━━━━━━━━━━━━━━━━━━━"
    )
    .setColor(0x8b00ff)
    .setFooter({ text: "Le Terrain Sécurité • Support" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("Fermer")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`,
    embeds: [embed],
    components: [row]
  });

  await log(guild, "🎫 Ticket créé", `${interaction.user.tag} a ouvert un ticket **${type}** dans ${channel}.`, 0x00ff00);

  await interaction.reply({
    content: `✅ Ticket créé : ${channel}`,
    ephemeral: true
  });
}

function addWarn(userId, reason) {
  const current = warnings.get(userId) || [];
  current.push({
    reason,
    date: new Date().toLocaleString("fr-FR")
  });
  warnings.set(userId, current);
  return current.length;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === "!ticketpanel") {
    if (!isStaff(message.member)) return;
    return sendTicketPanel(message.channel);
  }

  if (isStaff(message.member)) return;

  const inviteRegex = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i;
  const badLinkRegex = /(https?:\/\/|www\.)/i;

  if (inviteRegex.test(message.content)) {
    await message.delete().catch(() => {});
    await punish(message.member, "Invitation Discord interdite", 15);
    await log(
      message.guild,
      "🚫 Pub Discord bloquée",
      `${message.author.tag} a envoyé une invitation Discord dans ${message.channel}.\nSanction : mute 15 minutes.`,
      0xff0000
    );
    return;
  }

  if (message.mentions.everyone || message.mentions.users.size >= 5 || message.mentions.roles.size >= 3) {
    await message.delete().catch(() => {});
    await punish(message.member, "Mass mention", 20);
    await log(
      message.guild,
      "🚨 Anti-mass mention",
      `${message.author.tag} a fait trop de mentions.\nSanction : mute 20 minutes.`,
      0xff0000
    );
    return;
  }

  const repeatedChars = /(.)\1{12,}/i;
  if (repeatedChars.test(message.content)) {
    await message.delete().catch(() => {});
    await punish(message.member, "Spam caractères", 5);
    await log(
      message.guild,
      "⚠️ Spam caractères",
      `${message.author.tag} a envoyé un message avec trop de caractères répétés.`,
      0xffaa00
    );
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
    await punish(message.member, "Spam rapide", 10);
    const count = addWarn(message.author.id, "Spam rapide");

    await log(
      message.guild,
      "⚠️ Anti-spam",
      `${message.author.tag} a spam.\nSanction : mute 10 minutes.\nWarns : ${count}`,
      0xffaa00
    );
    return;
  }
});

client.on("guildMemberAdd", async (member) => {
  const now = Date.now();
  joinTimes.push(now);

  while (joinTimes.length && now - joinTimes[0] > 30000) {
    joinTimes.shift();
  }

  await log(member.guild, "👤 Nouveau membre", `${member.user.tag} a rejoint le serveur.`, 0x00ff00);

  const age = now - member.user.createdTimestamp;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (age < sevenDays) {
    await log(
      member.guild,
      "🔒 Anti-alt détecté",
      `${member.user.tag} a un compte créé il y a moins de 7 jours.\nAction : alerte staff.`,
      0xff0000
    );
  }

  if (joinTimes.length >= 8) {
    await log(
      member.guild,
      "🚨 ALERTE RAID",
      `Possibilité de raid détectée : **${joinTimes.length} membres** ont rejoint en 30 secondes.\nSurveille le serveur immédiatement.`,
      0xff0000
    );
  }
});

client.on("guildMemberRemove", async (member) => {
  await log(member.guild, "📤 Départ", `${member.user.tag} a quitté le serveur.`, 0xffaa00);
});

client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  await log(
    message.guild,
    "🗑️ Message supprimé",
    `Auteur : ${message.author?.tag || "Inconnu"}\nSalon : ${message.channel}\nMessage : ${message.content || "Impossible à lire"}`,
    0xffaa00
  );
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith("ticket_")) {
    const type = interaction.customId.replace("ticket_", "");
    return createTicket(interaction, type);
  }

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: "❌ Tu n’as pas la permission de fermer ce ticket.",
        ephemeral: true
      });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");
    await log(interaction.guild, "🔒 Ticket fermé", `${interaction.user.tag} a fermé ${interaction.channel}.`, 0xffaa00);

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

client.once("ready", async () => {
  console.log(`✅ Le Terrain Sécurité connecté : ${client.user.tag}`);
});

client.login(process.env.TOKEN);
