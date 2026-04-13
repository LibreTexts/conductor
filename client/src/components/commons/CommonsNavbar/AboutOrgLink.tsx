import { Organization } from "../../../types";
import { Link } from "@libretexts/davis-react";

interface AboutOrgLinkProps {
  org: Organization;
  isMobile?: boolean;
}

const AboutOrgLink: React.FC<AboutOrgLinkProps> = ({
  org,
  isMobile = false,
}) => {
  return (
    <Link
      href={org.aboutLink}
      target="_blank"
      rel="noopener noreferrer"
    >
      About {org.shortName}
    </Link>
  );
};

export default AboutOrgLink;
