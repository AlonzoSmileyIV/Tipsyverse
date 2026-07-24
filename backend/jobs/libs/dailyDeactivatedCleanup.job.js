import cron from "node-cron";
import { UserModel as User} from "../../models/index.js";
import { addMonthsUTC, deleteUserHandler } from "../../utils/index.js";


const clearOldDeactivatedUsers = async () =>{
try {
    const nowUTC = new Date();
    const candidates = await User.find({
      "accountStatus.state": "Deactivated",
      "accountStatus.deactivationDateStarted": { $ne: null },
    }).select("_id accountStatus.deactivationDateStarted");

    for (const u of candidates) {
      const started = new Date(u.accountStatus.deactivationDateStarted);
      const deadline = addMonthsUTC(started, 6);
      if (deadline && deadline <= nowUTC) {
        // bypass state check — deactivated/expired users
        await deleteUserHandler(u._id, { bypassStateCheck: true });
      }
    }
    console.log(`✅ Deactivated users cleanup ${new Date().toISOString()} — sweep complete`);
  } catch (err) {
    console.error("[deactivatedCleanup] Error:", err);
  }
}

const dailyDeactivatedCleanup = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log(`📬 Daily deactivated clean up job triggered.`);
    await clearOldDeactivatedUsers();
  }, {timezone: 'UTC'});
};

export default dailyDeactivatedCleanup;
