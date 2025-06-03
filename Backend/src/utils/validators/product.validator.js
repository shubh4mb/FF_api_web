import Joi from 'joi';

export const productSchema = Joi.object({
  name: Joi.string().required(),
  brandId: Joi.string().hex().length(24).optional(),
  description: Joi.string().optional(),
  gender: Joi.string().valid('men', 'women', 'unisex', 'boys', 'girls', 'babies').default('unisex'),
  mrp: Joi.number().required(),
  price: Joi.number().required(),
  categoryId: Joi.string().hex().length(24).required(),
  subCategoryId: Joi.string().hex().length(24).optional(),
  subSubCategoryId: Joi.string().hex().length(24).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  merchantId: Joi.string().hex().length(24).required(),

  variants: Joi.array().items(
    Joi.object({
      size: Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL').optional(),
      color: Joi.object({
        name: Joi.string().optional(),
        hex: Joi.string().pattern(/^#([0-9A-F]{3}){1,2}$/i).optional()
      }).optional(),
      stock: Joi.number().default(0),
      price: Joi.number().required(),
      discount: Joi.number().default(0),
    })
  ).optional()
});
