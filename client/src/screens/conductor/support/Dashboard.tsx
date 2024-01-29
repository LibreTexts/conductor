import DefaultLayout from "../../../components/kb/DefaultLayout";
import { useEffect, lazy } from "react";
import { useTypedSelector } from "../../../state/hooks";
import { isSupportStaff } from "../../../utils/supportHelpers";
const StaffDashboard = lazy(
  () => import("../../../components/support/StaffDashboard")
);
const UserDashboard = lazy(
  () => import("../../../components/support/UserDashboard")
);

const SupportDashboard = () => {
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    document.title = "LibreTexts | Support Dashboard";
  }, []);

  return (
    <DefaultLayout>
      {isSupportStaff(user) ? <StaffDashboard /> : <UserDashboard />}
    </DefaultLayout>
  );
};

export default SupportDashboard;
