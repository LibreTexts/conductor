interface KBFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
const KBFooter: React.FC<KBFooterProps> = ({ ...rest }) => {
  return (
    <div className="flex w-full text-center justify-center">
      <p className="text-sm text-gray-500 italic">Need help? Contact support</p>
    </div>
  );
};

export default KBFooter;
