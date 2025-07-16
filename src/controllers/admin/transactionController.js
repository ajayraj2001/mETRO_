const asyncHandler = require("../../utils/asyncHandler");
const {Transaction, User} = require("../../models");

const getAllTransactions = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search = "", status, type } = req.query;

  const query = {};

  // Step 1: Filter by User fullName or phone if search is provided
  if (search) {
    const users = await User.find({
      $or: [
        { fullName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    }).select("_id");

    const userIds = users.map(user => user._id);
    query.userId = { $in: userIds };
  }

  // Step 2: Optional status/type filters
  if (status) query.status = status;
  if (type) query.type = type;

  // Step 3: Pagination
  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "fullName phone email")
      .populate("metadata.planId", "planName durationInMonths"),
      Transaction.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    message: "Transactions fetched successfully",
    total,
    page: Number(page),
    limit: Number(limit),
    data: transactions
  });
});

module.exports = {
  getAllTransactions
};
