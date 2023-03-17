import MediaQuery, { MediaQueryType } from "react-responsive";
import React, { ReactNode } from "react";

const breakpoints = {
  desktop: "(min-width: 1025px)",
  tabletOrDesktop: "(min-width: 768px)",
  tablet: "(min-width: 768px) and (max-width: 1024px)",
  mobile: "(max-width: 767px)",
  mobileOrTablet: "(max-width: 1024px)",
};

type BreakPointProps = {
  name: keyof typeof breakpoints;
  children: ReactNode;
};
const Breakpoint = (props: BreakPointProps) => {
  const breakpoint = breakpoints[props.name] || breakpoints.desktop;
  return (
    <MediaQuery {...props} query={breakpoint}>
      {props.children}
    </MediaQuery>
  );
};

export default Breakpoint;
