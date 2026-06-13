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

function isStaff(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

async function sendLog(guild, title, description, color = 0x8b00ff) {
  try {
    if (!LOG_CHANNEL_ID) return console.log("❌ LOG_CHANNEL_ID manquant");

    const channel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return console.log("❌ Salon logs introuvable");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: "Le Terrain Sécurité" });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.log("❌ Erreur logs :", err.message);
  }
}

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 CENTRE D’AIDE — LE TERRAIN DES ROIS")
    .setDescription(
      "Bienvenue dans le **support officiel**.\n\n" +
      "Choisis une catégorie ci-dessous pour ouvrir un ticket.\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "🛠️ **Support** — problème général\n" +
      "🚨 **Signalement** — tricheur / comportement toxique\n" +
      "🏀 **Pro-Am** — recrutement équipe\n" +
      "🤝 **Partenariat** — collaboration\n" +
      "━━━━━━━━━━━━━━━━━━━━━━"
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
      .setCustomId("ticket_signalement")
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
  try {
    const guild = interaction.guild;

    if (!TICKET_CATEGORY_ID) {
      return interaction.reply({
        content: "❌ TICKET_CATEGORY_ID manque dans Railway.",
        ephemeral: true
      });
    }

    const category = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
    if (!category) {
      return interaction.reply({
        content: "❌ Catégorie ticket introuvable. Vérifie TICKET_CATEGORY_ID.",
        ephemeral: true
      });
    }

    const username = interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");

    const ticketName = `ticket-${type}-${username}`;

    const existing = guild.channels.cache.find(c => c.name === ticketName);
    if (existing) {
      return interaction.reply({
        content: `❌ Tu as déjà un ticket ouvert : ${existing}`,
        ephemeral: true
      });
    }

    const ticketChannel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: category.id,
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
      signalement: "Envoie le pseudo du joueur, une preuve et explique la situation.",
      proam: "Présente ton poste, ton build, ton niveau et tes disponibilités.",
      partenaire: "Présente ton serveur/chaîne, tes stats et ce que tu proposes."
    };

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket ${type.toUpperCase()}`)
      .setDescription(
        `Salut ${interaction.user} 👋\n\n` +
        `${questions[type] || "Explique ta demande clairement."}\n\n` +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "📌 **Règles :**\n" +
        "• Pas de spam\n" +
        "• Pas d’insultes\n" +
        "• Explique clairement\n" +
        "• Attends le staff\n" +
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

    await ticketChannel.send({
      content: `<@&${STAFF_ROLE_ID}> ${interaction.user}`,
      embeds: [embed],
      components: [row]
    });

    await sendLog(
      guild,
      "🎫 Ticket créé",
      `${interaction.user.tag} a ouvert ${ticketChannel}.`,
      0x00ff00
    );

    return interaction.reply({
      content: `✅ Ticket créé : ${ticketChannel}`,
      ephemeral: true
    });
  } catch (err) {
    console.log("❌ Erreur createTicket :", err.message);

    if (!interaction.replied) {
      return interaction.reply({
        content: `❌ Erreur ticket : ${err.message}`,
        ephemeral: true
      });
    }
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  console.log("📩 Message reçu :", message.content);

  if (message.content.toLowerCase() === "!ticketpanel") {
    console.log("🎫 Commande ticketpanel détectée");

    if (!isStaff(message.member)) {
      console.log("❌ Pas staff :", message.author.tag);

      return message.reply(
        "❌ Tu n’es pas reconnu staff. Vérifie que tu as le rôle staff ou que STAFF_ROLE_ID est bon."
      );
    }

    await sendTicketPanel(message.channel);
    return;
  }

  if (isStaff(message.member)) return;

  if (/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(message.content)) {
    await message.delete().catch(() => {});
    await message.member.timeout(15 * 60 * 1000, "Pub Discord interdite").catch(() => {});

    return sendLog(
      message.guild,
      "🚫 Pub Discord bloquée",
      `${message.author.tag} a envoyé une invitation dans ${message.channel}.`,
      0xff0000
    );
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  console.log("🔘 Bouton cliqué :", interaction.customId);

  if (interaction.customId.startsWith("ticket_")) {
    const type = interaction.customId.replace("ticket_", "");
    return createTicket(interaction, type);
  }

  if (interaction.customId === "close_ticket") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: "❌ Seul le staff peut fermer ce ticket.",
        ephemeral: true
      });
    }

    await interaction.reply("🔒 Ticket fermé dans 5 secondes.");

    await sendLog(
      interaction.guild,
      "🔒 Ticket fermé",
      `${interaction.user.tag} a fermé ${interaction.channel}.`,
      0xffaa00
    );

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

client.once("ready", () => {
  console.log(`✅ Le Terrain Sécurité connecté : ${client.user.tag}`);
  console.log("STAFF_ROLE_ID =", STAFF_ROLE_ID);
  console.log("TICKET_CATEGORY_ID =", TICKET_CATEGORY_ID);
  console.log("LOG_CHANNEL_ID =", LOG_CHANNEL_ID);
});

client.login(process.env.TOKEN);
