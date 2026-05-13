import { Link } from "@libretexts/davis-react";

interface KBFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
const KBFooter: React.FC<KBFooterProps> = ({ ...rest }) => {
  return (
    <div className="flex w-full text-center justify-center" {...rest}>
      <p className="text-md text-gray-500 italic">
        Didn't find what you were looking for?{" "}
        <Link href="/support/contact">Contact support</Link>
      </p>
    </div>
  );
};

export default KBFooter;
