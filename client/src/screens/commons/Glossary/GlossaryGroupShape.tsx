import React from "react";

/**
 * Shape is paired 1:1 with `getGroupColor`'s hue order (same index, same
 * cycle length) so a group's color+shape combination is always the same
 * regardless of how many groups exist. Shape carries identity on its own —
 * a colorblind viewer (or anyone once colors repeat past 8 groups) can
 * still tell groups apart without relying on hue at all.
 */
const SHAPE_COUNT = 8;

interface GroupShapeProps {
  index: number;
  color: string;
  size?: number;
  className?: string;
}

const GroupShape: React.FC<GroupShapeProps> = ({
  index,
  color,
  size = 10,
  className,
}) => {
  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    className,
    "aria-hidden": true as const,
  };

  switch (index % SHAPE_COUNT) {
    case 0: // circle
      return (
        <svg {...svgProps}>
          <circle cx="8" cy="8" r="7" fill={color} />
        </svg>
      );
    case 1: // square
      return (
        <svg {...svgProps}>
          <rect x="1.5" y="1.5" width="13" height="13" fill={color} />
        </svg>
      );
    case 2: // triangle
      return (
        <svg {...svgProps}>
          <polygon points="8,1 15,14.5 1,14.5" fill={color} />
        </svg>
      );
    case 3: // diamond
      return (
        <svg {...svgProps}>
          <polygon points="8,1 15,8 8,15 1,8" fill={color} />
        </svg>
      );
    case 4: // pentagon
      return (
        <svg {...svgProps}>
          <polygon points="8,1 15,6.3 12.3,15 3.7,15 1,6.3" fill={color} />
        </svg>
      );
    case 5: // hexagon
      return (
        <svg {...svgProps}>
          <polygon
            points="4.5,1.5 11.5,1.5 15,8 11.5,14.5 4.5,14.5 1,8"
            fill={color}
          />
        </svg>
      );
    case 6: // star
      return (
        <svg {...svgProps}>
          <polygon
            points="8,1 9.8,6 15,6 10.8,9.3 12.4,14.5 8,11.3 3.6,14.5 5.2,9.3 1,6 6.2,6"
            fill={color}
          />
        </svg>
      );
    case 7: // plus
    default:
      return (
        <svg {...svgProps}>
          <polygon
            points="6,1 10,1 10,6 15,6 15,10 10,10 10,15 6,15 6,10 1,10 1,6 6,6"
            fill={color}
          />
        </svg>
      );
  }
};

export default GroupShape;
