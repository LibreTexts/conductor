import React from "react";
import { Skeleton, Stack } from "@libretexts/davis-react";

const TreeSkeleton: React.FC = () => (
  <Stack direction="vertical" gap="md">
    <Skeleton
      variant="text"
      lines={1}
      aria-label="Loading book tree"
      width="70%"
      height="10px"
    />
    <Skeleton
      variant="text"
      lines={1}
      aria-label="Loading book tree"
      width="60%"
      height="10px"
    />
    <Skeleton
      variant="text"
      lines={1}
      aria-label="Loading book tree"
      width="60%"
      height="10px" 
    />
    <Skeleton
      variant="text"
      lines={1}
      aria-label="Loading book tree"
      width="70%"
      height="10px" 
    />
    <Skeleton
      variant="text"
      lines={1}
      aria-label="Loading book tree"
      width="60%"
      height="10px" 
    />
    <Skeleton
      variant="text"
      lines={1}
      aria-label="Loading book tree"
      width="60%"
      height="10px" 
    />

    </Stack>
);

export default TreeSkeleton;
