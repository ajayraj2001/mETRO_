const { ApiError } = require('../../errorHandler');
const { Blog } = require('../../models');

const getAllBlogs = async (req, res, next) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Blogs fetched successfully',
            data: blogs,
        });
    } catch (error) {
        next(error);
    }
};

const getBlogById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);
        if (!blog) {
            throw new ApiError('Blog not found', 404);
        }

        return res.status(200).json({
            success: true,
            message: 'Blog fetched successfully',
            data: blog,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllBlogs, getBlogById }