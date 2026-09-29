import "dotenv/config";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const imagePath = "./test-product.jpg";

const imageBase64 = fs.readFileSync(imagePath).toString("base64");

async function test() {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",

    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      },
      {
        text: `
Analyze this clothing product image for the FlashFits fashion catalog.

Identify the actual clothing item from the image.

Rules:

- Return ONLY valid JSON.
- category must be one of the FlashFits categories.
- For this test, use these category/subcategory mappings:
  - Topwear: T-Shirt, Shirt, Top, Hoodie, Sweatshirt, Sweater, Jacket, Blazer, Cardigan, Shrug
  - Bottomwear: Jeans
- Use gender values exactly as: MEN, WOMEN, UNISEX.
- attributes MUST be an empty array [].
- isTriable should normally be true for wearable clothing suitable for Try & Buy.
- Do not invent material information unless it can reasonably be determined from the image.
- Identify the dominant visible color.
- Generate a practical e-commerce product name.
- Generate a short product description suitable for FlashFits.
- Do not include brand information in the response.
        `,
      },
    ],

    config: {
      responseMimeType: "application/json",

      responseSchema: {
        type: "object",

        properties: {
          name: {
            type: "string",
          },

          styleName: {
            type: "string",
          },

          description: {
            type: "string",
          },

          gender: {
            type: "array",
            items: {
              type: "string",
              enum: ["MEN", "WOMEN", "UNISEX"],
            },
          },

          category: {
            type: "string",
            enum: ["Topwear", "Bottomwear"],
          },

          subCategory: {
            type: "string",
            enum: [
              "T-Shirt",
              "Shirt",
              "Top",
              "Hoodie",
              "Sweatshirt",
              "Sweater",
              "Jacket",
              "Blazer",
              "Cardigan",
              "Shrug",
              "Jeans",
            ],
          },

          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },

          color: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              hex: {
                type: "string",
              },
            },
            required: ["name", "hex"],
          },

          isTriable: {
            type: "boolean",
          },

          attributes: {
            type: "array",
            items: {
              type: "object",
            },
          },
        },

        required: [
          "name",
          "styleName",
          "description",
          "gender",
          "category",
          "subCategory",
          "tags",
          "color",
          "isTriable",
          "attributes",
        ],
      },
    },
  });

  console.log(response.text);
}

test().catch(console.error);