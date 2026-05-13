import { useState } from "react";
import { ToastContainer } from "@libretexts/davis-react";
import type { Notification as DavisNotification } from "@libretexts/davis-react";
import {
  NotificationContext,
  Notification,
} from "../context/NotificationContext";

const variantMap: Record<string, DavisNotification["variant"]> = {
  success: "success",
  error: "error",
  info: "info",
};

const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<
    (Notification & { id: string })[]
  >([]);

  const addNotification = (newNotif: Notification) => {
    const { message, type, duration = 5000 } = newNotif;
    const id = crypto.randomUUID();
    setNotifications((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const removeAllNotifications = () => setNotifications([]);

  const davisNotifications: DavisNotification[] = notifications.map((n) => ({
    id: n.id,
    message: n.message,
    variant: variantMap[n.type] ?? "info",
    duration: n.duration ?? 5000,
  }));

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        removeAllNotifications,
      }}
    >
      {children}
      <ToastContainer
        notifications={davisNotifications}
        onRemove={removeNotification}
        position="bottom-right"
      />
    </NotificationContext.Provider>
  );
};

export default NotificationsProvider;
