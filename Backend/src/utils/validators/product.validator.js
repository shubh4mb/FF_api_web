import Joi from 'joi';

export const productSchema = Joi.object({
  name: Joi.string().required(),
  brandId: Joi.string().hex().length(24).optional(),
  description: Joi.string().optional(),
  gender: Joi.array().items(Joi.string().valid('MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS')).min(1).required(),
  categoryId: Joi.string().hex().length(24).required(),
  subCategoryId: Joi.string().hex().length(24).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  collectionIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
  merchantId: Joi.string().hex().length(24).required(),

  soldBy: Joi.string().optional(),
  styleName: Joi.string().optional(),

  features: Joi.object().optional(),
  attributes: Joi.array().items(
    Joi.object({
      attributeId: Joi.string().hex().length(24).required(),
      value: Joi.any().optional().allow('', null)
    })
  ).optional(),
  isActive: Joi.boolean().default(true),
  isTriable: Joi.boolean().default(true),

  variants: Joi.array().items(
    Joi.object({
      // Sizes are free text ("M", "32", "30-23 cm") — shape only, no vocabulary.
      // The enum that used to be here never ran (its only caller deletes `size`
      // before validating) but it is exactly the rule that broke the merchant
      // web form. See docs/reports/numeric-size-variants-bug.md.
      size: Joi.string().trim().max(20).pattern(/^[A-Za-z0-9][A-Za-z0-9./\s-]*$/).optional(),
      color: Joi.object({
        name: Joi.string().optional(),
        hex: Joi.string().pattern(/^#([0-9A-F]{3}){1,2}$/i).optional()
      }).optional(),
      stock: Joi.number().default(0),
      mrp: Joi.number().required(),
      price: Joi.number().required(),
      discount: Joi.number().default(0),
    })
  ).optional()
});
