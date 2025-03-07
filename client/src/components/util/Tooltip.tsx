import classNames from "classnames";
import React, { useState } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  disabled?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  children,
  position = "top",
  className,
  disabled = false,
}) => {
  // generate a short random id for the tooltip
  const id = Math.random().toString(36).substring(7);
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // Add "aria-describedby" to the children element to associate the tooltip with the element
  const childrenWithProps = React.Children.map(children, (child) => {
    return React.cloneElement(child as React.ReactElement, {
      "aria-describedby": id,
    });
  });

  const handleUpdateVisibility = (newVisibility: boolean) => {
    if (!disabled) {
      setVisible(newVisibility);
    }
  };

  return (
    <div
      className={classNames(
        "relative flex items-center",
        disabled ? "" : "cursor-pointer",
        className
      )}
      onMouseEnter={() => handleUpdateVisibility(true)}
      onMouseLeave={() => handleUpdateVisibility(false)}
      tabIndex={0} // For keyboard navigation
      onFocus={() => handleUpdateVisibility(true)}
      onBlur={() => handleUpdateVisibility(false)}
      role="tooltip"
      id={id}
    >
      {childrenWithProps}
      {visible && (
        <div
          className={`absolute bg-gray-800 text-white text-sm px-2 py-1 w-48 rounded shadow-md ${positionClasses[position]}`}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
