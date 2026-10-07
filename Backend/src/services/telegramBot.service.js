import { Telegraf, Markup } from 'telegraf';
import mongoose from 'mongoose';
import Merchant from '../models/merchant.model.js';
import { createProductAi } from '../controllers/merchantController/product.controllers.js';
import { redis } from '../config/redisConfig.js';

// In-memory session cache: chatId -> { merchantId, shopName }
const userMerchantSessions = new Map();

/**
 * Retrieve active merchant session for a chat.
 * Checks in-memory cache first, then Redis, then MongoDB.
 */
async function getChatSession(chatId) {
  const key = String(chatId);
  if (userMerchantSessions.has(key)) {
    return userMerchantSessions.get(key);
  }

  // Fallback 1: Redis
  try {
    const raw = await redis.get(`telegram:session:${key}`);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed?.merchantId) {
        userMerchantSessions.set(key, parsed);
        return parsed;
      }
    }
  } catch (e) {
    // Redis optional fallback
  }

  // Fallback 2: MongoDB
  try {
    if (mongoose.connection?.readyState === 1) {
      const doc = await mongoose.connection.collection('telegram_sessions').findOne({ chatId: key });
      if (doc?.merchantId) {
        const session = { merchantId: String(doc.merchantId), shopName: doc.shopName };
        userMerchantSessions.set(key, session);
        return session;
      }
    }
  } catch (e) {
    // DB optional fallback
  }

  return null;
}

/**
 * Persist active merchant session for a chat.
 * Updates in-memory cache, Redis, and MongoDB.
 */
async function setChatSession(chatId, session) {
  const key = String(chatId);
  userMerchantSessions.set(key, session);

  try {
    await redis.set(`telegram:session:${key}`, JSON.stringify(session));
  } catch (e) {}

  try {
    if (mongoose.connection?.readyState === 1) {
      await mongoose.connection.collection('telegram_sessions').updateOne(
        { chatId: key },
        { $set: { chatId: key, merchantId: session.merchantId, shopName: session.shopName, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (e) {}
}

/**
 * Parses Telegram photo caption into structured SKU, Price, MRP, and dynamic Sizes.
 * Supports:
 * - Line-based format: "914 \n 1099 \n M 1, L 2"
 * - Numeric sizes: "914 \n 1099 \n 28 1, 30 2, 32 1"
 * - Numeric size lists: "914 1099 28 30 32"
 * - Size ranges: "S to XXL" or "36 to 44"
 * - Labeled formats: "SKU: 914 \n Price: 1099 \n Sizes: 30: 2, 32: 3"
 * - Currency formats: "₹1099", "Rs. 750", "1250/-"
 * - Price with single size: "450 \n Size M"
 */
export function parseTelegramCaption(text) {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim();
  if (!raw) return null;

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let sku = null;
  let price = null;
  let mrp = null;
  let sizes = [];

  const standardLetterSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];
  const knownNumericSizes = new Set([
    '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'
  ]);

  // Helper to extract sizes from text
  function extractSizes(str) {
    const found = [];

    // 1. Check letter range: "M to XXL", "S-XL"
    const letterRangeMatch = str.match(/\b(XS|S|M|L|XL|XXL|2XL|3XL|4XL)\s*(?:to|-)\s*(XS|S|M|L|XL|XXL|2XL|3XL|4XL)\b/i);
    if (letterRangeMatch) {
      const sIdx = standardLetterSizes.indexOf(letterRangeMatch[1].toUpperCase());
      const eIdx = standardLetterSizes.indexOf(letterRangeMatch[2].toUpperCase());
      if (sIdx !== -1 && eIdx !== -1 && sIdx <= eIdx) {
        for (let i = sIdx; i <= eIdx; i++) {
          found.push({ size: standardLetterSizes[i], stock: 1 });
        }
      }
    }

    // 2. Check numeric range: "38 to 44", "28-36"
    const numRangeMatch = str.match(/\b(2[4-9]|3[0-9]|4[0-9]|5[0-4])\s*(?:to|-)\s*(2[4-9]|3[0-9]|4[0-9]|5[0-4])\b/i);
    if (numRangeMatch && found.length === 0) {
      const sNum = parseInt(numRangeMatch[1], 10);
      const eNum = parseInt(numRangeMatch[2], 10);
      if (sNum <= eNum) {
        const step = (sNum % 2 === 0 && eNum % 2 === 0) ? 2 : 1;
        for (let n = sNum; n <= eNum; n += step) {
          found.push({ size: String(n), stock: 1 });
        }
      }
    }

    // 3. Check Free Size
    if (/\b(FREE\s*SIZE|FREESIZE|FS|FREE)\b/i.test(str)) {
      if (!found.some(s => s.size === 'FS')) {
        found.push({ size: 'FS', stock: 1 });
      }
    }

    // 4. Token-based size matching
    if (found.length === 0) {
      const sizeRegex = /\b(XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|FS|FREE\s*SIZE|2[4-9]|3[0-9]|4[0-9]|5[0-4])\b(?:\s*[:=\-]\s*(\d+)|\s+(\d+))?/gi;
      let m;
      while ((m = sizeRegex.exec(str)) !== null) {
        const sizeVal = m[1].toUpperCase().replace(/\s+/g, '');
        const potentialStock = m[2] || m[3];
        let stock = 1;

        if (potentialStock) {
          const num = parseInt(potentialStock, 10);
          if (knownNumericSizes.has(potentialStock) || standardLetterSizes.includes(potentialStock)) {
            sizeRegex.lastIndex -= potentialStock.length;
            stock = 1;
          } else if (num > 0 && num <= 100) {
            stock = num;
          }
        }

        if (!found.some((existing) => existing.size === sizeVal)) {
          found.push({ size: sizeVal, stock });
        }
      }
    }

    return found;
  }

  // --- 1. Labeled Extraction ---
  const skuMatch = raw.match(/(?:sku|item\s*code|prod(?:uct)?\s*code|code|design\s*no\.?|style\s*no\.?|art\s*no\.?)\s*[:=\-]?\s*([a-zA-Z0-9_\-]+)/i);
  if (skuMatch) sku = skuMatch[1].trim();

  const priceMatch = raw.match(/(?:price|rate|sp|selling\s*price)\s*[:=\-]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (priceMatch) price = Number(priceMatch[1]);

  const mrpMatch = raw.match(/(?:mrp|original\s*price)\s*[:=\-]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (mrpMatch) mrp = Number(mrpMatch[1]);

  // Currency symbol price fallback: ₹999 or 999/-
  if (!price) {
    const symbolPriceMatch = raw.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i) || raw.match(/\b(\d{2,6})\s*\/(?:-|rs)?\b/i);
    if (symbolPriceMatch) price = Number(symbolPriceMatch[1]);
  }

  // --- 2. Line-Based Structure Extraction (Standard Flashfits Format) ---
  if (lines.length >= 2) {
    const line2PriceMatch = lines[1].match(/^(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)(?:\s*\/(?:-|rs)?)?$/i);
    if (!price && line2PriceMatch) {
      price = Number(line2PriceMatch[1]);
      if (!sku && lines[0]) {
        const potentialSku = lines[0].replace(/^(?:sku|code)[:=\-\s]*/i, '').trim();
        if (potentialSku && !potentialSku.toLowerCase().startsWith('size') && !potentialSku.toLowerCase().startsWith('rate')) {
          sku = potentialSku;
        }
      }
    }
  }

  // --- 3. Extract Sizes ---
  sizes = extractSizes(raw);

  // --- 4. Fallback Token Extraction for Price and SKU ---
  const words = raw
    .replace(/[,\/]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // Single-line format: "914 1099 28 30"
  if (!sku && !price && words.length >= 2) {
    const w0Num = Number(words[0]);
    const w1Num = Number(words[1]);
    if (!isNaN(w0Num) && !isNaN(w1Num) && w1Num >= 50) {
      sku = words[0];
      price = w1Num;
    }
  }

  if (!price) {
    for (const w of words) {
      const cleanNum = w.replace(/[^0-9.]/g, '');
      const num = Number(cleanNum);
      if (num && num >= 50 && num <= 200000) {
        if (String(num) !== String(sku)) {
          price = num;
          break;
        }
      }
    }
  }

  if (!sku) {
    const ignored = new Set([
      'PRICE', 'RATE', 'RS', 'RS.', 'INR', 'MRP', 'SIZE', 'SIZES', 'FREE', 'FREESIZE',
      'TOP', 'KURTI', 'DRESS', 'SHIRT', 'TSHIRT', 'JEANS', 'BOTTOM', 'TO', 'NEW', 'ITEM'
    ]);
    for (const w of words) {
      const clean = w.toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
      if (!clean || clean.length < 2) continue;
      if (/^[\-_]+$/.test(clean)) continue;
      if (ignored.has(clean)) continue;
      if (Number(clean) === price || Number(clean) === mrp) continue;
      if (sizes.some(s => s.size === clean || String(s.stock) === clean)) continue;
      sku = clean;
      break;
    }
  }

  // Price is mandatory
  if (!price || isNaN(price)) {
    return null;
  }

  // If no sizes were parsed, default to Free Size (FS)
  if (sizes.length === 0) {
    sizes.push({ size: 'FS', stock: 1 });
  }

  // Fallback SKU if still missing
  if (!sku) {
    sku = `FF-${Date.now().toString().slice(-6)}`;
  }

  const finalSizes = sizes.map((s) => ({
    size: s.size,
    stock: s.stock || 1,
    merchantSizeCode: `${sku}-${s.size}`,
  }));

  return {
    sku,
    price,
    mrp: mrp || price,
    sizes: finalSizes,
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

    // --- Command: /start ---
    bot.start(async (ctx) => {
      try {
        const keyboard = await getMerchantKeyboard();
        const welcomeText =
          `👋 *Welcome to the FlashFits Product Automation Bot!*\n\n` +
          `This bot turns dress photos into live FlashFits catalog products instantly using Gemini AI.\n\n` +
          `📌 *How it works:*\n` +
          `1. Select your active merchant below.\n` +
          `2. Take or send a photo of the clothing item.\n` +
          `3. Add a caption with: \`<SKU> <Price> <Sizes & Stock>\`\n\n` +
          `*Examples:*\n` +
          `• Standard: \`914\\n1099\\nM 1, L 2\`\n` +
          `• Numeric: \`914\\n1099\\n28 1, 30 2, 32 1\`\n` +
          `• Simple: \`450\\nSize M\` or \`₹799\\nS to XL\`\n\n` +
          `🏪 *Please select your active merchant to begin:*`;

        if (keyboard) {
          await ctx.reply(welcomeText, { parse_mode: 'Markdown', ...keyboard });
        } else {
          await ctx.reply(
            '👋 Welcome to FlashFits Bot!\nNo active merchants found in database. Please check your merchant accounts.'
          );
        }
      } catch (err) {
        console.error('[TelegramBot] Error in /start command:', err);
      }
    });

    // --- Command: /help ---
    bot.help(async (ctx) => {
      try {
        await ctx.reply(
          '📖 *FlashFits Bot Commands:*\n\n' +
            '/switch - Select active merchant\n' +
            '/status - Check currently selected merchant\n' +
            '/help - Show this guide\n\n' +
            '📸 *Uploading Products:*\n' +
            'Send a photo with caption:\n' +
            '`<SKU>`\n' +
            '`<Price>`\n' +
            '`<Size Stock>`\n\n' +
            '*Example:*\n' +
            '`914`\n' +
            '`1099`\n' +
            '`28 1, 30 2, 32 1`',
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('[TelegramBot] Error in /help command:', err);
      }
    });

    // --- Command: /switch or /merchants ---
    bot.command(['switch', 'merchants'], async (ctx) => {
      try {
        const keyboard = await getMerchantKeyboard();
        if (keyboard) {
          await ctx.reply('🏪 Please choose the active merchant for catalog uploads:', keyboard);
        } else {
          await ctx.reply('❌ No active merchants found in the database.');
        }
      } catch (err) {
        console.error('[TelegramBot] Error in /switch command:', err);
      }
    });

    // --- Command: /status or /current ---
    bot.command(['status', 'current', 'whoami'], async (ctx) => {
      try {
        const session = await getChatSession(ctx.chat.id);
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
      } catch (err) {
        console.error('[TelegramBot] Error in /status command:', err);
      }
    });

    // --- Action: Select Merchant Button Click ---
    bot.action(/^select_merchant_(.+)$/, async (ctx) => {
      try {
        const merchantId = ctx.match[1];
        const merchant = await Merchant.findById(merchantId).select('_id shopName ownerName').lean();

        if (!merchant) {
          await ctx.answerCbQuery('Merchant not found.');
          return ctx.reply('❌ Merchant not found.');
        }

        const shopName = merchant.shopName || merchant.ownerName || 'Merchant';
        await setChatSession(ctx.chat.id, {
          merchantId: merchant._id.toString(),
          shopName,
        });

        await ctx.answerCbQuery(`Active merchant: ${shopName}`);
        await ctx.reply(
          `✅ Active merchant set to: *${shopName}*!\n\n` +
            `📸 Now send any clothing photo with caption:\n` +
            `\`<SKU> <Price> <Sizes & Stock>\`\n\n` +
            `Example:\n` +
            `\`914\`\n\`1099\`\n\`28 1, 30 2\``,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('[TelegramBot] Error in select_merchant action:', err);
        try { await ctx.answerCbQuery('Error selecting merchant.'); } catch (e) {}
      }
    });

    // Helper for processing one or multiple product photos
    const processProductUpload = async (ctx, photos, caption) => {
      const chatId = ctx.chat.id;
      const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
      const session = await getChatSession(chatId);

      // Check caption presence
      if (!caption) {
        // If an active session exists in group or private chat, notify user
        if (session || !isGroup) {
          return ctx.reply(
            '⚠️ Photo received, but caption with price is missing!\n\n' +
              'Please send the photo with caption details:\n' +
              '`<SKU>`\n`<Price>`\n`<Sizes & Stock>`\n\n' +
              'Example:\n' +
              '`914`\n`1099`\n`28 1, 30 2`\n\n' +
              'Or simply:\n`450\\nSize M`',
            {
              parse_mode: 'Markdown',
              reply_parameters: { message_id: ctx.message.message_id },
            }
          );
        }
        return;
      }

      const parsed = parseTelegramCaption(caption);

      if (!parsed) {
        // If session exists or private chat, provide actionable feedback
        if (session || !isGroup) {
          return ctx.reply(
            '⚠️ Could not extract the selling price and sizes from the caption.\n\n' +
              'Please ensure your caption includes a price, for example:\n' +
              '• `914\\n1099\\n28 1, 30 2`\n' +
              '• `914\\n1099\\nM 1, L 2`\n' +
              '• `₹650\\nSizes: 38 40 42`\n' +
              '• `450\\nSize M`',
            {
              parse_mode: 'Markdown',
              reply_parameters: { message_id: ctx.message.message_id },
            }
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
            reply_parameters: { message_id: ctx.message.message_id },
            ...(keyboard || {}),
          }
        );
      }

      const photoCountText = photos.length > 1 ? ` (${photos.length} photos)` : '';
      await ctx.reply(
        `⏳ Processing dress${photoCountText} for *${session.shopName}*...\n` +
          `• SKU: \`${parsed.sku}\`\n` +
          `• Price: ₹${parsed.price}\n` +
          `• Sizes: ${parsed.sizes.map((s) => `${s.size} (qty: ${s.stock})`).join(', ')}\n\n` +
          `Analyzing image with Gemini AI...`,
        {
          parse_mode: 'Markdown',
          reply_parameters: { message_id: ctx.message.message_id },
        }
      );

      try {
        // 1. Download all photos in parallel
        const files = await Promise.all(
          photos.map(async (photo, idx) => {
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);
            const response = await fetch(fileLink.href);
            if (!response.ok) {
              throw new Error(`Failed to download image #${idx + 1} from Telegram`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            return {
              fieldname: `image_${idx}`,
              buffer,
              mimetype: 'image/jpeg',
              originalname: `telegram_${parsed.sku}_${idx}.jpg`,
            };
          })
        );

        // 2. Build simulated req and res for createProductAi
        const req = {
          merchantId: session.merchantId,
          files,
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
            `🎉 *Product Created Successfully!*\n\n` +
            `👗 *Name:* ${ai.name || 'Dress'}\n` +
            `📁 *Category:* ${ai.category || 'Apparel'} → ${ai.subCategory || 'General'}\n` +
            `🎨 *Color:* ${ai.color?.name || 'Standard'} (${ai.color?.hex || '#000000'})\n` +
            `💰 *Price:* ₹${parsed.price}\n` +
            `📦 *Product Code:* \`${responsePayload.productId || parsed.sku}\`\n` +
            `📸 *Images:* ${photos.length} uploaded to Cloudinary\n` +
            `📏 *Inventory:*\n${sizeListText}\n` +
            `🚚 *Try & Buy:* ${ai.isTriable ? '✅ Yes' : '❌ No'}\n` +
            `🔒 *Status:* Inactive (Pending Admin Approval)\n\n` +
            `🏪 *Merchant:* ${session.shopName}\n\n` +
            `📸 _Send the next photo when ready!_`;

          await ctx.reply(successCard, {
            parse_mode: 'Markdown',
            reply_parameters: { message_id: ctx.message.message_id },
          });
        } else {
          const errMsg = responsePayload?.message || 'Unknown error occurred during product creation.';
          await ctx.reply(`❌ Could not create product:\n${errMsg}`, {
            reply_parameters: { message_id: ctx.message.message_id },
          });
        }
      } catch (err) {
        console.error('[TelegramBot] Error processing photo:', err);
        await ctx.reply(`❌ Error processing photo: ${err.message}`, {
          reply_parameters: { message_id: ctx.message.message_id },
        });
      }
    };

    // Buffer for Telegram media groups (albums)
    const mediaGroupBuffers = new Map();

    // --- Photo Message Handler ---
    bot.on('photo', async (ctx) => {
      const mediaGroupId = ctx.message.media_group_id;

      // Handle Telegram photo albums (multiple images of same product)
      if (mediaGroupId) {
        let group = mediaGroupBuffers.get(mediaGroupId);
        if (!group) {
          group = {
            photos: [],
            caption: null,
            primaryCtx: ctx,
            timer: null,
          };
          mediaGroupBuffers.set(mediaGroupId, group);
        }

        const photos = ctx.message.photo;
        const bestPhoto = photos[photos.length - 1];
        group.photos.push(bestPhoto);

        if (ctx.message.caption) {
          group.caption = ctx.message.caption;
          group.primaryCtx = ctx;
        }

        // Wait 600ms debounce for all photos in the album to arrive
        if (group.timer) clearTimeout(group.timer);

        group.timer = setTimeout(async () => {
          mediaGroupBuffers.delete(mediaGroupId);
          await processProductUpload(group.primaryCtx, group.photos, group.caption);
        }, 600);

        return;
      }

      // Single photo
      const photos = ctx.message.photo;
      const bestPhoto = photos[photos.length - 1];
      await processProductUpload(ctx, [bestPhoto], ctx.message.caption);
    });

    // Global error handler to prevent crashing
    bot.catch((err, ctx) => {
      console.error(`[TelegramBot] Unhandled error for update ${ctx?.updateType}:`, err);
      try {
        if (ctx?.reply) {
          ctx.reply(`⚠️ Telegram Bot error: ${err.message || 'Unknown error'}`);
        }
      } catch (e) {
        console.error('[TelegramBot] Failed to send error notification:', e);
      }
    });

    // Launch polling in background (do not drop updates on restart)
    bot.launch({ dropPendingUpdates: false }).catch((err) => {
      console.error('[TelegramBot] Bot launch error:', err);
    });
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
