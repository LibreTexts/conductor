import DefaultLayout from "../../../components/kb/DefaultLayout";
import { useEffect, lazy, useMemo } from "react";
import { useTypedSelector } from "../../../state/hooks";
import { isSupportStaff } from "../../../utils/supportHelpers";
const StaffDashboard = lazy(
  () => import("../../../components/support/StaffDashboard"),
);
const UserDashboard = lazy(
  () => import("../../../components/support/UserDashboard"),
);

const SupportDashboard = () => {
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    document.title = "LibreTexts | Support Dashboard";
  }, []);

  // Prevent UserDashboard from loading if user obj is not yet available
  const toRender = useMemo(() => {
    if (!user || !user.uuid) return <></>;
    if (isSupportStaff(user)) {
      return <StaffDashboard />;
    }
    return <UserDashboard />;
  }, [user]);

  return (
    <DefaultLayout>
      {toRender}
    </DefaultLayout>
  );
};

export default SupportDashboard;
