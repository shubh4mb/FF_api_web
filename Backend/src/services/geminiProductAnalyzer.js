import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import Category from "../models/category.model.js";

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function getCategoryOptions() {
  const categories = await Category.find({ isActive: true })
    .select("_id name parentId level allowedGenders isTriable description prompts promptFront promptBack promptCloseUp")
    .lean();

  const categoryMap = new Map(
    categories.map((category) => [String(category._id), category])
  );

  return categories.map((category) => ({
    id: String(category._id),
    name: category.name,
    level: category.level,
    description: category.description || "",
    prompts: {
      front: category.promptFront || category.prompts?.front || "",
      back: category.promptBack || category.prompts?.back || "",
      closeUp: category.promptCloseUp || category.prompts?.closeUp || "",
    },
    parentId: category.parentId ? String(category.parentId) : null,
    parentName: category.parentId
      ? categoryMap.get(String(category.parentId))?.name || null
      : null,
    allowedGenders: category.allowedGenders || [],
    isTriable: Boolean(category.isTriable),
  }));
}

function normalizeString(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function matchName(name1, name2) {
  const n1 = normalizeString(name1);
  const n2 = normalizeString(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  // Handle simple plurals/singulars (e.g., tshirt vs tshirts, jean vs jeans)
  if (n1 === n2 + "s" || n2 === n1 + "s") return true;
  if (n1 === n2 + "es" || n2 === n1 + "es") return true;
  return false;
}

function normalizeGender(gender, allowedGenders = []) {
  const validGenders = ["MEN", "WOMEN", "KIDS", "BOYS", "GIRLS", "UNISEX"];

  const genders = Array.isArray(gender)
    ? gender
    : typeof gender === "string"
    ? [gender]
    : [];

  const normalized = genders
    .map((g) => String(g).trim().toUpperCase())
    .filter((g) => validGenders.includes(g));

  let resolved = [];

  if (normalized.includes("UNISEX")) {
    const adultGenders = ["MEN", "WOMEN"].filter(
      (g) => allowedGenders.length === 0 || allowedGenders.includes(g)
    );
    if (adultGenders.length > 0) {
      resolved = adultGenders;
    } else {
      resolved = allowedGenders.length > 0 ? allowedGenders : ["MEN", "WOMEN"];
    }
  } else {
    resolved = normalized.filter((g) =>
      allowedGenders.length === 0 || allowedGenders.includes(g)
    );
  }

  if (resolved.length > 0) {
    return resolved;
  }

  const defaultAdult = ["MEN", "WOMEN"].filter(
    (g) => allowedGenders.length === 0 || allowedGenders.includes(g)
  );
  return defaultAdult.length > 0 ? defaultAdult : (allowedGenders.length > 0 ? allowedGenders : ["MEN", "WOMEN"]);
}

function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") return "#808080";
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) {
    return h.toUpperCase();
  }
  return "#808080";
}

function resolveAndValidateProduct(product, categoryOptions) {
  const level0Categories = categoryOptions.filter((c) => c.level === 0);
  const level1Categories = categoryOptions.filter((c) => c.level === 1);

  // 1. Match category
  let category = level0Categories.find((c) => matchName(c.name, product.category));

  // 1b. Substring or inclusion match for category
  if (!category && product.category) {
    const normP = normalizeString(product.category);
    category = level0Categories.find((c) => {
      const normC = normalizeString(c.name);
      return normC.includes(normP) || normP.includes(normC);
    });
  }

  // 2. Match subcategory under identified category
  let subCategory = null;
  if (category) {
    subCategory = level1Categories.find(
      (c) => String(c.parentId) === String(category.id) && matchName(c.name, product.subCategory)
    );
  }

  // 3. Self-healing fallback: if subcategory wasn't found under category, search globally
  if (!subCategory && product.subCategory) {
    subCategory = level1Categories.find((c) => matchName(c.name, product.subCategory));
    if (subCategory && subCategory.parentId) {
      const parent = level0Categories.find((c) => String(c.id) === String(subCategory.parentId));
      if (parent) {
        category = parent;
      }
    }
  }

  // 3b. Partial/substring match for subcategory globally
  if (!subCategory && product.subCategory) {
    const normSub = normalizeString(product.subCategory);
    subCategory = level1Categories.find((c) => {
      const normC = normalizeString(c.name);
      return normC.includes(normSub) || normSub.includes(normC);
    });
    if (subCategory && subCategory.parentId) {
      const parent = level0Categories.find((c) => String(c.id) === String(subCategory.parentId));
      if (parent) {
        category = parent;
      }
    }
  }

  // 4. Safe fallback if still not matched
  if (!category && level0Categories.length > 0) {
    category = level0Categories[0];
  }

  if ((!subCategory || !subCategory.id) && category) {
    const defaultSub = level1Categories.find((c) => String(c.parentId) === String(category.id));
    if (defaultSub) {
      subCategory = defaultSub;
    } else if (level1Categories.length > 0) {
      subCategory = level1Categories[0];
      const parent = level0Categories.find((c) => String(c.id) === String(subCategory.parentId));
      if (parent) category = parent;
    }
  }

  if (!category && level0Categories.length > 0) {
    category = level0Categories[0];
  }

  if (!subCategory && level1Categories.length > 0) {
    subCategory = level1Categories[0];
  }

  if (!category) {
    throw new Error(`Invalid or unrecognized category returned by AI: "${product.category}"`);
  }

  if (!subCategory || !subCategory.id) {
    throw new Error(
      `Invalid or unrecognized subcategory "${product.subCategory}" under category "${category.name}"`
    );
  }

  return {
    name: product.name?.trim() || "New Product",
    styleName: product.styleName?.trim() || product.name?.trim() || "New Product",
    description: product.description?.trim() || "",
    gender: normalizeGender(product.gender, subCategory.allowedGenders),
    category: category.name,
    categoryId: category.id,
    subCategory: subCategory.name,
    subCategoryId: subCategory.id,
    tags: Array.isArray(product.tags)
      ? product.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    color: {
      name: product.color?.name?.trim() || "Unknown",
      hex: normalizeHex(product.color?.hex),
    },
    isTriable: Boolean(subCategory.isTriable),
    attributes: [],
  };
}

function normalizeSingleImage(img, fallbackMime = "image/jpeg") {
  if (!img) return null;
  let base64 = "";
  let mimeType = fallbackMime;

  if (Buffer.isBuffer(img)) {
    base64 = img.toString("base64");
  } else if (typeof img === "object" && img !== null) {
    if (img.buffer && Buffer.isBuffer(img.buffer)) {
      base64 = img.buffer.toString("base64");
      mimeType = img.mimetype || img.mimeType || fallbackMime;
    } else if (img.data) {
      base64 = String(img.data);
      mimeType = img.mimeType || img.mimetype || fallbackMime;
    }
  } else if (typeof img === "string") {
    const dataUriMatch = img.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUriMatch) {
      mimeType = dataUriMatch[1];
      base64 = dataUriMatch[2];
    } else {
      base64 = img;
    }
  }

  if (!base64) return null;
  return { base64, mimeType };
}

export async function analyzeProductImage(imageInput, defaultMimeType = "image/jpeg") {
  if (!imageInput) {
    throw new Error("Image data is required");
  }

  // Normalize single image or array of images
  const rawImages = Array.isArray(imageInput) ? imageInput : [imageInput];
  const imageList = rawImages
    .map((img) => normalizeSingleImage(img, defaultMimeType))
    .filter(Boolean);

  if (imageList.length === 0) {
    throw new Error("No valid image data could be extracted for analysis");
  }

  const categoryOptions = await getCategoryOptions();
  if (!categoryOptions.length) {
    throw new Error("No active categories found in database");
  }

  // Build clean category tree for prompt
  const categoryTree = {};
  for (const cat of categoryOptions) {
    if (cat.level === 0) {
      if (!categoryTree[cat.name]) categoryTree[cat.name] = [];
    } else if (cat.level === 1 && cat.parentName) {
      if (!categoryTree[cat.parentName]) categoryTree[cat.parentName] = [];
      categoryTree[cat.parentName].push(cat.name);
    }
  }

  const categoryPromptText = Object.entries(categoryTree)
    .map(([parent, subs]) => `- ${parent}: ${subs.join(", ")}`)
    .join("\n");

  const imageCountDesc =
    imageList.length > 1
      ? `${imageList.length} product images showing different angles/details of the same fashion item`
      : "product image";

  const prompt = `
You are a fashion product catalog AI for FlashFits.
Analyze the supplied ${imageCountDesc} and return ONLY valid JSON.

Synthesize all visible angles (front view, back view, fabric details, cuts, trims) to produce an accurate catalog listing.

Identify:
- product name (name): concise, appealing e-commerce title
- style name (styleName): specific garment style / cut / pattern
- product description (description): concise highlight of back/neckline/sleeve/fabric design details visible across angles
- gender (gender): array containing one or more of: MEN, WOMEN, KIDS, BOYS, GIRLS, UNISEX
- category (category): MUST be strictly selected from the top-level categories below
- subcategory (subCategory): MUST be strictly selected from the allowed subcategories under that category
- tags (tags): array of 4-8 useful search tags (fabric, style, sleeve type, pattern, occasion)
- primary color (color): object with "name" (e.g. "Navy Blue", "Olive Green", "Black") and "hex" (valid 6-character hex code starting with #)
- attributes: MUST always be []

ALLOWED CATEGORIES & SUBCATEGORIES:
${categoryPromptText}

IMPORTANT CATEGORY RULES:
1. "category" MUST be one of the top-level categories above.
2. "subCategory" MUST be one of the subcategories listed under that category.
3. Do not invent any category or subcategory names.

GENDER RULES:
Use only: MEN, WOMEN, KIDS, BOYS, GIRLS, UNISEX.

DO NOT generate:
- categoryId, subCategoryId, productCode, brand, price, stock, sizes.
"attributes" MUST always be [].

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN, NO OTHER TEXT):
{
  "name": "Product Name",
  "styleName": "Style Name",
  "description": "Product Description",
  "gender": ["MEN"],
  "category": "Topwear",
  "subCategory": "T-Shirt",
  "tags": ["tag1", "tag2"],
  "color": {
    "name": "Black",
    "hex": "#000000"
  },
  "attributes": []
}
`;

  const ai = getAiClient();

  const imageParts = imageList.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64,
    },
  }));

  const requestPayload = {
    contents: [
      ...imageParts,
      {
        text: prompt,
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  };

  const candidateModels = [
    process.env.GEMINI_MODEL,
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
  ].filter(Boolean);

  const modelPool = [...new Set(candidateModels)];

  let response = null;
  let lastError = null;

  for (let i = 0; i < modelPool.length; i++) {
    const model = modelPool[i];
    try {
      // 12-second per-model attempt timeout to prevent UI hanging
      const attemptPromise = ai.models.generateContent({
        model,
        ...requestPayload,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout: ${model} took longer than 12000ms`)), 12000);
      });

      response = await Promise.race([attemptPromise, timeoutPromise]);
      if (response && response.text) {
        break;
      }
    } catch (err) {
      lastError = err;
      const isTransient =
        err.message?.includes("503") ||
        err.message?.includes("UNAVAILABLE") ||
        err.message?.includes("429") ||
        err.message?.includes("RESOURCE_EXHAUSTED") ||
        err.message?.includes("high demand") ||
        err.message?.includes("Timeout");

      console.warn(`[Gemini AI] Model ${model} failed (${err.message}). ${i < modelPool.length - 1 ? `Retrying with ${modelPool[i + 1]}...` : "No more fallback models."}`);

      if (isTransient && i < modelPool.length - 1) {
        const delay = 400 + Math.floor(Math.random() * 400);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  if (!response || !response.text) {
    const errorDetails = lastError?.message || "All Gemini models unavailable";
    throw new Error(`AI product analysis is currently experiencing high demand. Please try again in a few moments. (${errorDetails})`);
  }

  let parsed;
  const rawText = (response.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Gemini returned invalid JSON: ${response.text}`);
  }

  return resolveAndValidateProduct(parsed, categoryOptions);
}