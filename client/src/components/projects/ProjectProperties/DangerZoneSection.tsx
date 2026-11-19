import { Suspense, useState } from "react";
import { Button, Text } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import lazyWithRetry from "../../../utils/lazyWithRetry";
import SectionCard from "../ProjectView/SectionCard";

const DeleteProjectModal = lazyWithRetry(() => import("../DeleteProjectModal"));

/** Project admins only: the server rejects deletes from anyone else. */
const DangerZoneSection = ({ projectID }: { projectID: string }) => {
  const [showDelete, setShowDelete] = useState(false);
  return (
    <SectionCard
      id="danger"
      title="Danger Zone"
      className="border-red-300!"
      bodyClassName="flex flex-wrap items-center justify-between gap-4 p-5"
    >
      <div className="min-w-0">
        <Text weight="medium">Delete this project</Text>
        <Text as="p" size="sm" color="muted" className="m-0">
          Removes its tasks, discussions and metadata for good. This can&apos;t be undone.
        </Text>
      </div>
      <Button variant="destructive" icon={<IconTrash size={14} />} onClick={() => setShowDelete(true)}>
        Delete Project
      </Button>
      {showDelete && (
        <Suspense fallback={null}>
          <DeleteProjectModal show projectID={projectID} onCancel={() => setShowDelete(false)} />
        </Suspense>
      )}
    </SectionCard>
  );
};

export default DangerZoneSection;
