import useClientConfig from "../../hooks/useClientConfig";
import { Link } from "@libretexts/davis-react";

const StoreLink = () => {
  const { clientConfig } = useClientConfig();
  return (
    <Link
      href={`${clientConfig?.main_commons_url || "https://commons.libretexts.org"}/store`}
      target="_blank"
      rel="noopener noreferrer"
      external
    >
      Store
    </Link>
  );
};

export default StoreLink;
