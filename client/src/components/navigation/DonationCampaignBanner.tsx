import { IconHeartHandshake } from "@tabler/icons-react";
import classNames from "classnames";

interface DonationCompaignBannerProps {
  className?: string;
}

const DonationCompaignBanner: React.FC<DonationCompaignBannerProps> = ({
  className,
}) => {
  return (
    <div
      className={classNames(
        "flex items-center justify-center bg-primary-dark px-8 py-2.5 w-full h-10",
        className
      )}
    >
      <IconHeartHandshake className="text-white mr-2" />
      <p className="text-xs lg:text-base text-white">
        <strong className="font-semibold">Global Translation for Good: </strong>
        Help us translate LibreTexts OER into more languages! Donate today through{" "}
        <a
          href="https://donorbox.org/libretexts-global-translation-for-good"
          className="underline text-white hover:text-white"
        >
          Donorbox
        </a>.
      </p>
    </div>
  );
};

export default DonationCompaignBanner;
