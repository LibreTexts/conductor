import classNames from "classnames";


const DefaultScreenContainer = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return (
        <div className={classNames(`h-full px-8 pt-8`, className)}>
            {children}
        </div>
    );
};

export default DefaultScreenContainer;