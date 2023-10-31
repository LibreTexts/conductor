import DefaultLayout from "../../../components/kb/DefaultLayout";
import { useEffect, useState } from "react";
import { useTypedSelector } from "../../../state/hooks";
import StaffDashboard from "../../../components/support/StaffDashboard";
import UserDashboard from "../../../components/support/UserDashboard";

const SupportDashboard = () => {
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    document.title = "LibreTexts | Support Dashboard";
  }, []);

  return (
    <DefaultLayout>
      {user.isSuperAdmin ? <StaffDashboard /> : <UserDashboard />}
    </DefaultLayout>
  );
};

export default SupportDashboard;
