import { Skeleton } from "@libretexts/davis-react";
import classNames from "classnames";

type BoneShape = "text" | "control" | "round";

const SHAPE_CLASSES: Record<BoneShape, string> = {
  text: "rounded",
  control: "rounded-md",
  round: "rounded-full",
};

interface SkeletonBoneProps {
  className?: string;
  shape?: BoneShape;
  /** Tints the placeholder so a primary action's position reads early. */
  primary?: boolean;
}

/**
 * A decorative skeleton shape. The surrounding region owns `aria-busy` and the
 * single `role="status"` message, so each shape is hidden from assistive tech.
 */
const SkeletonBone = ({ className, shape = "text", primary = false }: SkeletonBoneProps) => (
  <Skeleton
    aria-hidden="true"
    role="presentation"
    className={classNames(
      SHAPE_CLASSES[shape],
      primary ? "bg-primary-100!" : "bg-neutral-100!",
      className
    )}
  />
);

export default SkeletonBone;
