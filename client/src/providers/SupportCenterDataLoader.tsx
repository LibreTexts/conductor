import { useEffect } from "react";
import { useSupportCenterContext } from "../context/SupportCenterContext";
import useSupportQueues from "../hooks/useSupportQueues";

const SupportCenterDataLoader = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { setQueues } = useSupportCenterContext();
  const { data } = useSupportQueues({ withCount: false });

  useEffect(() => {
    if (data) {
      setQueues(data);
    }
  }, [data, setQueues]);

  return <>{children}</>;
};

export default SupportCenterDataLoader;
