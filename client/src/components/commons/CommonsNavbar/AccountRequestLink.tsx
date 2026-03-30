import useClientConfig from "../../../hooks/useClientConfig";
import { Link } from "@libretexts/davis-react";

const AccountRequestLink = ({ isMobile = false }) => {
  const { clientConfig } = useClientConfig();
  if (!clientConfig?.instructor_verification_url) {
    return null;
  }

  return (
    <Link
      href={clientConfig?.instructor_verification_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Instructor Verification Request
    </Link>
  );
};

export default AccountRequestLink;
