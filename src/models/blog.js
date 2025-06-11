const mongoose = require('mongoose');
const { getCurrentIST } = require('../utils/timeUtils');

// Function to generate slug from title
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Function to ensure unique slug
const ensureUniqueSlug = async function (slug, excludeId = null) {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
        const query = { slug: uniqueSlug };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existingBlog = await mongoose.model('Blog').findOne(query);
        if (!existingBlog) {
            break;
        }

        uniqueSlug = `${slug}-${counter}`;
        counter++;
    }

    return uniqueSlug;
};

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Blog title is required'],
        trim: true,
    },
    slug: {
        type: String,
        unique: true,
        trim: true,
    },
    excerpt: {
        type: String,
        default: '',
        trim: true,
    },
    author: {
        type: String,
        default: '',
        trim: true,
    },
    html: {
        type: String,
        required: [true, 'Blog content is required'],
    },
    featuredImage: {
        type: String,
        default: '',
    },
    tags: {
        type: [String],
        default: [],
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Draft'],
        default: 'Active',
    },
}, {
    timestamps: {
        currentTime: getCurrentIST, // Use Indian Standard Time
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

// Pre-save middleware to generate slug
blogSchema.pre('save', async function (next) {
    if (this.isModified('title') || !this.slug) {
        const baseSlug = this.slug || generateSlug(this.title);
        this.slug = await ensureUniqueSlug(baseSlug, this._id);
    }
    next();
});

// Pre-update middleware to handle slug updates
blogSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();

    if (update.title || update.slug) {
        const doc = await this.model.findOne(this.getQuery());
        if (doc) {
            let baseSlug;
            if (update.slug) {
                baseSlug = generateSlug(update.slug);
            } else if (update.title) {
                baseSlug = generateSlug(update.title);
            } else {
                baseSlug = doc.slug;
            }

            const uniqueSlug = await ensureUniqueSlug(baseSlug, doc._id);
            this.setUpdate({ ...update, slug: uniqueSlug });
        }
    }
    next();
});

// Add indexes for better query performance
blogSchema.index({ status: 1, createdAt: -1 });
blogSchema.index({ author: 1 });
blogSchema.index({ slug: 1 }); // Index for slug queries

module.exports = mongoose.model('Blog', blogSchema);