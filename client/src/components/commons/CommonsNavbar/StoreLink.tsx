import useClientConfig from "../../../hooks/useClientConfig";
import { Link } from "@libretexts/davis-react";

const StoreLink = ({ isMobile = false }) => {
  const { clientConfig } = useClientConfig();
  return (
    <Link
      href={`${clientConfig?.main_commons_url || "https://commons.libretexts.org"}/store`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Store
    </Link>
  );
};

export default StoreLink;
