import mongoose from 'mongoose';

const attributeValueSchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true }
}, { _id: false });

const attributeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            unique: true,
            trim: true,
            lowercase: true
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: true
        },
        inputType: {
            type: String,
            enum: ['select', 'multiselect', 'text', 'number', 'boolean'],
            required: true
        },
        isFilterable: {
            type: Boolean,
            default: false
        },
        isRequired: {
            type: Boolean,
            default: false
        },
        values: {
            type: [attributeValueSchema],
            default: undefined
        }
    },
    { timestamps: true }
);

// Auto-generate slug from name before validation
attributeSchema.pre('validate', function (next) {
    if (this.name && !this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    next();
});

const Attribute = mongoose.model('Attribute', attributeSchema);

export default Attribute;
