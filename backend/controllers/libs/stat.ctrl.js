import {
  DrinkModel as Drink,
  CommentModel as Comment,
  UserModel as User,
  EventModel as Event,
} from "../../models/index.js";

const statCtrl = {
  getAppStats: async (req, res) => {
    try {
      const [totalDrinks, totalUsers, totalComments, totalEventsCompleted, sharesAgg] = await Promise.all([
        Drink.countDocuments(),
        User.countDocuments(),
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

      return res.status(200).json({
        totalDrinks,
        totalUsers,
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
