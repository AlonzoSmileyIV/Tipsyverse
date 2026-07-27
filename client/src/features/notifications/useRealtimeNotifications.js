import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import CustomToast from "../../components/CustomToast/CustomToast";
import socket from "../../services/socket";
import { playNotificationSound } from "../../utils/notificationAudio";
import {
  addNotification,
  fetchNotificationsByUserId,
  toggleMarkAllReadOrUnread,
} from "./notificationSlice";

export default function useRealtimeNotifications(user) {
  const dispatch = useDispatch();
  const mute = Boolean(user?.preferences?.notifications?.onMute);
  const inWebsite = user?.preferences?.notifications?.inWebsite;
  const canShowWebsiteNotifications = inWebsite !== false && !mute;

  useEffect(() => {
    if (!user?._id) return undefined;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [user?._id]);

  useEffect(() => {
    const handleBulkRead = ({ read }) =>
      dispatch(toggleMarkAllReadOrUnread(Boolean(read)));
    socket.on("notifications:bulkReadUpdated", handleBulkRead);
    return () => socket.off("notifications:bulkReadUpdated", handleBulkRead);
  }, [dispatch]);

  useEffect(() => {
    if (!user?._id) return undefined;
    const handleNotification = (data) => {
      dispatch(addNotification(data));
      dispatch(fetchNotificationsByUserId());
      if (!canShowWebsiteNotifications) return;
      playNotificationSound();
      toast(
        <CustomToast
          {...data}
          actors={data?.actors?.map((actor) => actor.actor)}
        />
      );
    };
    socket.on("notifications:new", handleNotification);
    return () => socket.off("notifications:new", handleNotification);
  }, [canShowWebsiteNotifications, dispatch, user?._id]);

  return { canShowWebsiteNotifications };
}
