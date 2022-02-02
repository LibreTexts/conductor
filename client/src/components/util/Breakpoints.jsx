import MediaQuery from 'react-responsive';
import PropTypes from 'prop-types';
import React from 'react';

const breakpoints = {
    desktop: '(min-width: 1025px)',
    tabletOrDesktop: '(min-width: 768px)',
    tablet: '(min-width: 768px) and (max-width: 1024px)',
    mobile: '(max-width: 767px)',
    mobileOrTablet: '(max-width: 1024px)'
};

const Breakpoint = (props) => {
    const breakpoint = breakpoints[props.name] || breakpoints.desktop;
    return (
        <MediaQuery {...props } query={breakpoint}>
            {props.children}
        </MediaQuery>
    );
}

Breakpoint.propTypes = {
    name: PropTypes.string,
    children: PropTypes.node,
};

export default Breakpoint;
