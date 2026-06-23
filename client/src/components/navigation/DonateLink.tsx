import { Link } from "@libretexts/davis-react";
import { IconHeart } from "@tabler/icons-react";

const DonateLink = () => {
  return (
    <Link
      href="https://donate.libretexts.org"
      target="_blank"
      rel="noopener noreferrer"
      external
      underline="hover" // hover acceptable here for WCAG because not in prose + we have external icon
    >
      <IconHeart className="float-right" size={14} />
      Donate
    </Link>
  );
};

export default DonateLink;
