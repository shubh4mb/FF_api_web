import { Telegraf, Markup } from 'telegraf';
import Merchant from '../models/merchant.model.js';
import { createProductAi } from '../controllers/merchantController/product.controllers.js';

// In-memory session map: chatId -> { merchantId, shopName }
const userMerchantSessions = new Map();

/**
 * Parses Telegram photo caption into structured SKU, Price, MRP, and dynamic Sizes.
 * Supports:
 * - Formats like "914 \n 1099 \n M 1"
 * - Numeric sizes like "914 \n 1099 \n 28 1, 30 2, 32 1"
 * - Labeled formats like "SKU: 914 \n Price: 1099 \n Sizes: 30: 2, 32: 3"
 */
export function parseTelegramCaption(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let sku = null;
  let price = null;
  let mrp = null;
  const sizes = [];

  // 1. Explicit label extraction
  const skuMatch = raw.match(/(?:sku|id|code)\s*[:=\-]?\s*([a-zA-Z0-9_\-]+)/i);
  if (skuMatch) sku = skuMatch[1].trim();

  const priceMatch = raw.match(/(?:price|rate|sp)\s*[:=\-]?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  if (priceMatch) price = Number(priceMatch[1]);

  const mrpMatch = raw.match(/(?:mrp)\s*[:=\-]?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
  if (mrpMatch) mrp = Number(mrpMatch[1]);

  // 2. Size token extraction: letter sizes (XS..4XL, FS) or numeric waist/bust sizes (24..54)
  const sizeTokenRegex = /\b(XS|S|M|L|XL|XXL|2XL|3XL|4XL|FS|FREE\s*SIZE|\d{2})\b\s*[:=\-]?\s*(\d+)?/gi;
  let match;
  const sizeTokensFound = [];
  while ((match = sizeTokenRegex.exec(raw)) !== null) {
    const sizeName = match[1].toUpperCase().replace(/\s+/g, '');
    const stockQty = match[2] ? parseInt(match[2], 10) : 1;
    sizeTokensFound.push({ size: sizeName, stock: stockQty });
  }

  // 3. Fallback token extraction for SKU and Price if not labeled
  const remainingTokens = raw.split(/[\s,]+/).filter(Boolean);

  if (!sku && remainingTokens.length > 0) {
    sku = remainingTokens[0];
  }

  if (!price) {
    for (let i = 1; i < remainingTokens.length; i++) {
      const num = Number(remainingTokens[i].replace(/[^0-9.]/g, ''));
      if (num && num >= 50 && String(num) !== String(sku)) {
        price = num;
        break;
      }
    }
  }

  // 4. Clean sizes list
  for (const s of sizeTokensFound) {
    if (String(s.size) === String(sku) || String(s.size) === String(price)) continue;
    if (!sizes.find((existing) => existing.size === s.size)) {
      sizes.push({
        size: s.size,
        stock: s.stock || 1,
        merchantSizeCode: sku ? `${sku}-${s.size}` : undefined,
      });
    }
  }

  if (!price || sizes.length === 0) {
    return null;
  }

  return {
    sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
    price,
    mrp: mrp || price,
    sizes,
  };
}

let botInstance = null;

export async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[TelegramBot] TELEGRAM_BOT_TOKEN not configured. Telegram bot disabled.');
    return null;
  }

  try {
    const bot = new Telegraf(token);
    botInstance = bot;

    // Helper: Build merchant selection keyboard
    const getMerchantKeyboard = async () => {
      const merchants = await Merchant.find({ status: 'active' })
        .select('_id shopName ownerName')
        .sort({ shopName: 1 })
        .lean();

      if (!merchants.length) return null;

      const buttons = merchants.map((m) =>
        Markup.button.callback(`🏪 ${m.shopName || m.ownerName}`, `select_merchant_${m._id}`)
      );

      // 2 buttons per row
      const rows = [];
      for (let i = 0; i < buttons.length; i += 2) {
        rows.push(buttons.slice(i, i + 2));
      }

      return Markup.inlineKeyboard(rows);
    };

    // --- Command: /start or /help ---
    bot.start(async (ctx) => {
      const keyboard = await getMerchantKeyboard();
      const welcomeText =
        `👋 *Welcome to the FlashFits Product Automation Bot\\!*\n\n` +
        `This bot turns dress photos into live FlashFits catalog products instantly using Gemini AI\\.\n\n` +
        `📌 *How it works:*\n` +
        `1\\. Select your active merchant below\\.\n` +
        `2\\. Take or send a photo of the clothing item\\.\n` +
        `3\\. Add a caption with: \`<SKU> <Price> <Sizes & Stock>\`\n\n` +
        `*Examples:*\n` +
        `• Letter sizes: \`914\\n1099\\nM 1, L 2\`\n` +
        `• Numeric sizes: \`914\\n1099\\n28 1, 30 2, 32 1\`\n\n` +
        `🏪 *Please select your active merchant to begin:*`;

      if (keyboard) {
        await ctx.replyWithMarkdownV2(welcomeText, keyboard);
      } else {
        await ctx.reply(
          '👋 Welcome to FlashFits Bot!\nNo active merchants found in database. Please check your merchant accounts.'
        );
      }
    });

    bot.help(async (ctx) => {
      await ctx.reply(
        '📖 FlashFits Bot Commands:\n\n' +
          '/switch - Select active merchant\n' +
          '/status - Check currently selected merchant\n' +
          '/help - Show this guide\n\n' +
          '📸 Uploading Products:\n' +
          'Send a photo with caption:\n' +
          '<SKU>\n' +
          '<Price>\n' +
          '<Size Stock>\n\n' +
          'Example:\n' +
          '914\n' +
          '1099\n' +
          '28 1, 30 2, 32 1'
      );
    });

    // --- Command: /switch or /merchants ---
    bot.command(['switch', 'merchants'], async (ctx) => {
      const keyboard = await getMerchantKeyboard();
      if (keyboard) {
        await ctx.reply('🏪 Please choose the active merchant for catalog uploads:', keyboard);
      } else {
        await ctx.reply('❌ No active merchants found in the database.');
      }
    });

    // --- Command: /status or /current ---
    bot.command(['status', 'current', 'whoami'], async (ctx) => {
      const session = userMerchantSessions.get(ctx.chat.id);
      if (session) {
        await ctx.reply(
          `🏪 Active Merchant: *${session.shopName}*\nID: \`${session.merchantId}\`\n\nSend a photo anytime to add products to this store! Use /switch to change.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        const keyboard = await getMerchantKeyboard();
        await ctx.reply(
          '⚠️ No active merchant selected yet. Please pick one below:',
          keyboard || undefined
        );
      }
    });

    // --- Action: Select Merchant Button Click ---
    bot.action(/^select_merchant_(.+)$/, async (ctx) => {
      const merchantId = ctx.match[1];
      const merchant = await Merchant.findById(merchantId).select('_id shopName ownerName').lean();

      if (!merchant) {
        await ctx.answerCbQuery('Merchant not found.');
        return ctx.reply('❌ Merchant not found.');
      }

      const shopName = merchant.shopName || merchant.ownerName || 'Merchant';
      userMerchantSessions.set(ctx.chat.id, {
        merchantId: merchant._id.toString(),
        shopName,
      });

      await ctx.answerCbQuery(`Active merchant: ${shopName}`);
      await ctx.reply(
        `✅ Active merchant set to: *${shopName}*!\n\n` +
          `📸 Now send any dress photo with caption:\n` +
          `\`<SKU> <Price> <Sizes & Stock>\`\n\n` +
          `Example:\n` +
          `\`914\`\n\`1099\`\n\`28 1, 30 2\``,
        { parse_mode: 'Markdown' }
      );
    });

    // --- Photo Message Handler ---
    bot.on('photo', async (ctx) => {
      const chatId = ctx.chat.id;
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      let session = userMerchantSessions.get(chatId);

      const caption = ctx.message.caption;

      // In group chats, ignore photos without captions so we don't spam regular conversations
      if (!caption) {
        if (!isGroup) {
          return ctx.reply(
            '⚠️ Photo received, but caption is missing!\n\n' +
              'Please add product details in the caption:\n' +
              '`<SKU>`\n`<Price>`\n`<Sizes & Stock>`\n\n' +
              'Example:\n' +
              '`914`\n`1099`\n`28 1, 30 2`',
            { parse_mode: 'Markdown' }
          );
        }
        return;
      }

      const parsed = parseTelegramCaption(caption);

      // In group chats, ignore captions that do not look like product catalog uploads
      if (!parsed) {
        if (!isGroup) {
          return ctx.reply(
            '⚠️ Could not parse price and sizes from the caption.\n\n' +
              'Please format your caption like:\n' +
              '`<SKU>`\n`<Price>`\n`<Sizes & Stock>`\n\n' +
              'Examples:\n' +
              '• `914\\n1099\\n28 1, 30 2`\n' +
              '• `914\\n1099\\nM 1, L 2`',
            { parse_mode: 'Markdown' }
          );
        }
        return;
      }

      // Check if active merchant has been set for this chat/group
      if (!session) {
        const keyboard = await getMerchantKeyboard();
        return ctx.reply(
          '⚠️ Please select an active merchant for this chat first!\nUse /switch or pick below:',
          {
            reply_to_message_id: ctx.message.message_id,
            ...(keyboard || {})
          }
        );
      }

      // Send status message to user
      const progressMsg = await ctx.reply(
        `⏳ Processing dress for *${session.shopName}*...\n` +
          `• SKU: \`${parsed.sku}\`\n` +
          `• Price: ₹${parsed.price}\n` +
          `• Sizes: ${parsed.sizes.map((s) => `${s.size} (qty: ${s.stock})`).join(', ')}\n\n` +
          `Analyzing image with Gemini AI...`,
        { parse_mode: 'Markdown' }
      );

      try {
        // 1. Download highest-resolution photo from Telegram
        const photos = ctx.message.photo;
        const bestPhoto = photos[photos.length - 1];
        const fileLink = await ctx.telegram.getFileLink(bestPhoto.file_id);

        const response = await fetch(fileLink.href);
        if (!response.ok) {
          throw new Error(`Failed to download image from Telegram: ${response.statusText}`);
        }
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // 2. Build simulated req and res for createProductAi
        const req = {
          merchantId: session.merchantId,
          files: [
            {
              fieldname: 'image',
              buffer: imageBuffer,
              mimetype: 'image/jpeg',
              originalname: `telegram_${parsed.sku}.jpg`,
            },
          ],
          body: {
            price: String(parsed.price),
            mrp: String(parsed.mrp || parsed.price),
            productSku: parsed.sku,
            sizes: JSON.stringify(parsed.sizes),
          },
        };

        let responseCode = 200;
        let responsePayload = null;

        const res = {
          status: (code) => {
            responseCode = code;
            return res;
          },
          json: (data) => {
            responsePayload = data;
            return res;
          },
        };

        await createProductAi(req, res);

        if (responseCode === 201 && responsePayload?.success) {
          const ai = responsePayload.aiMetadata || {};
          const sizeListText = parsed.sizes
            .map((s) => `  • Size *${s.size}*: ${s.stock} pcs`)
            .join('\n');

          const successCard =
            `🎉 *Product Created Successfully\\!*\n\n` +
            `👗 *Name:* ${escapeMarkdown(ai.name || 'Dress')}\n` +
            `📁 *Category:* ${escapeMarkdown(ai.category || 'Apparel')} → ${escapeMarkdown(ai.subCategory || 'General')}\n` +
            `🎨 *Color:* ${escapeMarkdown(ai.color?.name || 'Standard')} \\(${escapeMarkdown(ai.color?.hex || '#000000')}\\)\n` +
            `💰 *Price:* ₹${parsed.price}\n` +
            `📦 *Product Code:* \`${escapeMarkdown(responsePayload.productId || parsed.sku)}\`\n` +
            `📏 *Inventory:*\n${sizeListText}\n` +
            `🚚 *Try & Buy:* ${ai.isTriable ? '✅ Yes' : '❌ No'}\n` +
            `🔒 *Status:* Inactive \\(Pending Admin Approval\\)\n\n` +
            `🏪 *Merchant:* ${escapeMarkdown(session.shopName)}\n\n` +
            `📸 _Send the next photo when ready\\!_`;

          await ctx.replyWithMarkdownV2(successCard, {
            reply_parameters: { message_id: ctx.message.message_id }
          });
        } else {
          const errMsg = responsePayload?.message || 'Unknown error occurred during product creation.';
          await ctx.reply(`❌ Could not create product:\n${errMsg}`, {
            reply_parameters: { message_id: ctx.message.message_id }
          });
        }
      } catch (err) {
        console.error('[TelegramBot] Error processing photo:', err);
        await ctx.reply(`❌ Error processing photo: ${err.message}`, {
          reply_parameters: { message_id: ctx.message.message_id }
        });
      }
    });

    // Helper for escaping Telegram MarkdownV2 special characters
    function escapeMarkdown(text) {
      if (!text) return '';
      return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    }

    // Launch polling in background
    bot.launch({ dropPendingUpdates: true });
    console.log('[TelegramBot] FlashFits Telegram Catalog Bot is running and listening for photos!');

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
  } catch (err) {
    console.error('[TelegramBot] Failed to initialize Telegram Bot:', err);
    return null;
  }
}

export default { initTelegramBot, parseTelegramCaption };
