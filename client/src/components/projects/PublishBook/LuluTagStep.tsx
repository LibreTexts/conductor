import { useEffect, useId, useRef, useState } from "react";
import { Input, Text } from "@libretexts/davis-react";
import { IconTag } from "@tabler/icons-react";
import PublishStep from "./PublishStep";

/** Prefix the server enforces. Mirrors `LULU_TAG_PREFIX` on the publish service. */
const TAG_PREFIX = "lulu@";

interface LuluTagStepProps {
  index: number;
  /** The tag currently on the coverpage, read live by the status endpoint. */
  luluTag: string | null;
  /** Called with the trimmed value; an empty string removes the tag. */
  onSave: (tag: string) => void;
  isSaving: boolean;
}

/**
 * The optional Lulu printing tag row.
 *
 * Wraps {@link PublishStep} so the row's numbering, badge, and button stay
 * identical to every other step, while the input's state stays local — the
 * drawer has no business holding a half-typed tag.
 *
 * Unlike the real steps there is nothing persisted on the project: the status
 * shown here is derived from whether the coverpage currently carries a `lulu@`
 * tag, so the row never renders `failed`. A failed save surfaces through the
 * notification the hook pushes instead.
 */
const LuluTagStep: React.FC<LuluTagStepProps> = ({
  index,
  luluTag,
  onSave,
  isSaving,
}) => {
  const fieldId = useId();
  const messageId = useId();
  const [value, setValue] = useState(luluTag ?? "");

  // The drawer re-reads publishing status every few seconds while a step is
  // running. Syncing on the *server* value changing, rather than on every
  // render, is what keeps a poll from stomping what the user is typing.
  const lastServerTag = useRef(luluTag);
  useEffect(() => {
    if (lastServerTag.current === luluTag) return;
    lastServerTag.current = luluTag;
    setValue(luluTag ?? "");
  }, [luluTag]);

  const trimmed = value.trim();
  const invalid =
    trimmed.length > 0 && !trimmed.toLowerCase().startsWith(TAG_PREFIX);
  const unchanged = trimmed === (luluTag ?? "");
  const clearing = trimmed.length === 0 && !!luluTag;

  return (
    <PublishStep
      index={index}
      title="Add Lulu printing tag (optional)"
      description={
        <span>
          Override cover page values for Lulu printing. Format is{" "}
          <code>
            {
              'lulu@<cover_title>@<author_name>@<institution>@<spine_title>'
            }
          </code>.{" "}
          To use the field value as-is (no override) use an empty space in
          the corresponding segment.
        </span>
      }
      status={luluTag ? "succeeded" : "not-started"}
      // facts={[luluTag ? `Currently ${luluTag}` : undefined]}
      actionLabel={clearing ? "Remove tag" : "Save tag"}
      actionIcon={<IconTag size={16} />}
      onRun={() => onSave(trimmed)}
      isSubmitting={isSaving}
      actionDisabled={invalid || unchanged}
    >
      <div className="max-w-md">
        <Input
          id={fieldId}
          name="luluTag"
          label="Lulu Tag"
          placeholder="lulu@Introductory Chemistry@Delmar Larsen, PhD@UC Davis@Intro Chem"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={invalid}
          aria-invalid={invalid}
          aria-describedby={messageId}
          disabled={isSaving}
        />
        {/* Rendered here rather than through Davis's own `errorMessage` /
            `helperText` so the text carries an id the input can point
            `aria-describedby` at. Davis does not yet wire those props to the
            input — pending a Davis fix. */}
        <Text
          id={messageId}
          size="sm"
          color={invalid ? "danger" : "muted"}
          className="!mt-1 !mb-0"
        >
          {invalid
            ? 'The tag must start with "lulu@".'
            : 'Must start with "lulu@". Clear the field and save to remove the tag.'}
        </Text>
      </div>
    </PublishStep>
  );
};

export default LuluTagStep;
