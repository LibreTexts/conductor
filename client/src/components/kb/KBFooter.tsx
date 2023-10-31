interface KBFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
const KBFooter: React.FC<KBFooterProps> = ({ ...rest }) => {
  return (
    <div className="flex w-full text-center justify-center">
      <a href="/support" className="text-md text-gray-500 italic">
        Didn't find what you were looking for? <span className="underline">Contact support</span>
      </a>
    </div>
  );
};

export default KBFooter;
