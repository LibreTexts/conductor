import { useMemo } from "react";
import useClientConfig from "../../hooks/useClientConfig";
import classNames from "classnames";

interface EnvironmentBannerProps {
  className?: string;
}

const EnvironmentBanner: React.FC<EnvironmentBannerProps> = ({ className }) => {
  const { clientConfig, loading } = useClientConfig();
  const isNotProduction = useMemo(() => {
    return clientConfig?.env !== "production";
  }, [clientConfig]);

  if (loading || !isNotProduction) {
    return null; // Don't render the banner if loading or in production
  }

  return (
    <div
      className={classNames(
        "flex items-center justify-center bg-primary px-8 py-2.5 w-full h-10",
        className
      )}
    >
      <p className="text-xs lg:text-sm/6 text-white">
        <strong className="font-semibold">Staging Environment: </strong>
        This is a staging environment for testing purposes only. Please visit
        the{" "}
        <a
          href="https://commons.libretexts.org"
          className="underline text-white hover:text-white"
        >
          production site
        </a>
        {" "}for the live version.
      </p>
    </div>
  );
};

export default EnvironmentBanner;
