import { Link } from "@libretexts/davis-react";
import { IconHeart } from "@tabler/icons-react";

const DonateLink = () => {
  return (
    <Link
      href="https://donate.libretexts.org"
      target="_blank"
      rel="noopener noreferrer"
      external
    >
      <IconHeart className="float-right" size={14} />
      Donate
    </Link>
  );
};

export default DonateLink;
