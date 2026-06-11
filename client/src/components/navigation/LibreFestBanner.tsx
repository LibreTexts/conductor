import { IconConfetti, IconHeartHandshake } from "@tabler/icons-react";
import classNames from "classnames";

interface LibreFestBannerProps {
  className?: string;
}

const LibreFestBanner: React.FC<LibreFestBannerProps> = ({
  className,
}) => {
  return (
    <div
      className={classNames(
        "flex items-center justify-center bg-[#127bc4] px-8 py-2.5 w-full h-10",
        className
      )}
    >
      <IconConfetti className="text-white mr-2" />
      <p className="text-xs lg:text-base text-white">
        Registration is now open for this year's LibreFest! Join us virtually the week of July 13. {" "}
        <a
          href="https://academy.libretexts.org/event/librefest-2026-1/register"
          className="!underline text-white"
          target="_blank"
          rel="noopener noreferrer"
        >
          Register Here
        </a>
      </p>
    </div>
  );
};

export default LibreFestBanner;
