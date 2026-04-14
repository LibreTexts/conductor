import { Link } from "@libretexts/davis-react";
import { IconHeart } from "@tabler/icons-react";

const DonateLink = ({ isMobile = false }) => {
  return (
    <Link
      href="https://donate.libretexts.org"
      target="_blank"
      rel="noopener noreferrer"
    >
      Donate
      {isMobile && <IconHeart className="float-right" />}
    </Link>
  );
};

export default DonateLink;
