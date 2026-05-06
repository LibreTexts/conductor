import React from "react";
import { Placeholder } from "semantic-ui-react";


 const TreeSkeleton: React.FC = () => (
    <div
      style={{
        padding: 16,
        background: "#f9f9f9",
        borderRadius: 8,
        // width: 320,
        marginTop: 12,
      }}
    >
      <Placeholder fluid>
        <Placeholder.Header>
          <Placeholder.Line length="medium" />
        </Placeholder.Header>
        <Placeholder.Paragraph>
          <Placeholder.Line length="short" />
          <Placeholder.Line length="medium" />
          <Placeholder.Line length="long" />
          <Placeholder.Line length="medium" />
          <Placeholder.Line length="short" />
        </Placeholder.Paragraph>
      </Placeholder>
    </div>
  );

  export default TreeSkeleton