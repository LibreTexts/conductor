import { Organization } from "../../types";
import { Link } from "@libretexts/davis-react";

interface AboutOrgLinkProps {
  org: Organization;
}

const AboutOrgLink: React.FC<AboutOrgLinkProps> = ({
  org,
}) => {
  return (
    <Link
      href={org.aboutLink}
      target="_blank"
      rel="noopener noreferrer"
      external
    >
      About {org.shortName}
    </Link>
  );
};

export default AboutOrgLink;
