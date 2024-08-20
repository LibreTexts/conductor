import { useState } from "react";
import {
  NotificationContext,
  Notification,
} from "../context/NotificationContext";
import { Icon } from "semantic-ui-react";

const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<
    (Notification & { id: string })[]
  >([]);

  const addNotification = (newNotif: Notification) => {
    const { message, type, duration = 5000 } = newNotif;
    const id = crypto.randomUUID();
    setNotifications((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const removeAllNotifications = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "error":
        return "exclamation circle";
      case "success":
        return "check circle";
      case "info":
        return "info circle";
      default:
        return "info circle";
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "error":
        return "red";
      case "success":
        return "green";
      case "info":
        return "blue";
      default:
        return "blue";
    }
  };

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
      <div className="!fixed bottom-16 right-0 p-4 z-[9999]">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`mb-4 p-4 rounded shadow-md border border-slate-300 bg-white max-w-96`}
            onClick={() => removeNotification(notification.id)}
          >
            <div className="flex flex-row justify-between items-center">
              <div className="mr-2">
                <Icon
                  name={getIcon(notification.type)}
                  size={"large"}
                  color={getColor(notification.type)}
                />
              </div>
              <div>
                <p className="text-lg">{notification.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationsProvider;
