import {
  DrinkModel as Drink,
  CommentModel as Comment,
  UserModel as User,
  EventModel as Event,
} from "../../models/index.js";

const statCtrl = {
  getAppStats: async (req, res) => {
    try {
      const [
        totalDrinks,
        accountCount,
        duplicateOwnerAliases,
        totalBartenders,
        totalComments,
        totalEventsCompleted,
        sharesAgg,
      ] = await Promise.all([
        Drink.countDocuments(),
        User.countDocuments(),
        User.countDocuments({ username: { $in: ["tipsyverse", "alonzo.smiley"] } }),
        User.countDocuments({ role: "bartender" }),
        Comment.countDocuments(),
        Event.countDocuments({ status: { $in: ["completed", "closed"] } }),
        Drink.aggregate([
          {
            $group: {
              _id: null,
              totalShares: {
                $sum: { $ifNull: ["$analytics.counts.shares", 0] }, // coalesce missing shares to 0
              },
            },
          },
        ]),
      ]);

      const totalShares = sharesAgg[0]?.totalShares || 0;
      const totalUsers = Math.max(0, accountCount - Math.max(0, duplicateOwnerAliases - 1));

      return res.status(200).json({
        totalDrinks,
        totalUsers,
        totalBartenders,
        totalComments,
        totalEventsCompleted,
        totalShares,
      });
    } catch (err) {
      console.error("getAppStats error:", err);
      return res.status(500).json({ message: "Error fetching stats" });
    }
  },
};

export default statCtrl;
