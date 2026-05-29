import { Control, FormState, useFieldArray } from "react-hook-form";
import {
  AssetTagFramework,
  AssetTagTemplate,
  AssetTagValue,
  ProjectFile,
} from "../../types";
import { Button } from "@libretexts/davis-react";
import { DataTable, ColumnDef } from "@libretexts/davis-react-table";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { RenderTagInput } from "./RenderTagInput";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";
import { useModals } from "../../context/ModalContext";
import SelectFramework from "./SelectFramework";
import { getInitValueFromTemplate } from "../../utils/assetHelpers";
import api from "../../api";
import { useQuery } from "@tanstack/react-query";

type RenderTagFieldsProps = {
  control: Control<ProjectFile, any>;
  formState: FormState<ProjectFile>;
};

type AddTagParams = {
  key?: string;
  value?: AssetTagValue;
  framework?: AssetTagFramework;
};

type RenderTagFieldsRef = {
  addTag: (params: AddTagParams) => void;
  changeSelectedFramework: (framework: AssetTagFramework) => void;
};

const RenderTagFields = forwardRef(
  (
    props: RenderTagFieldsProps,
    ref: React.ForwardedRef<RenderTagFieldsRef>
  ) => {
    useImperativeHandle(ref, () => ({
      addTag: addTag,
      changeSelectedFramework(framework) {
        setFrameworkId(framework.uuid);
      },
    }));

    const [frameworkId, setFrameworkId] = useState<string>("");
    const { openModal, closeModal } = useModals();
    const { fields, append, remove } = useFieldArray({
      control: props.control,
      name: "tags",
    });
    const tagRows = fields.map((tag, index) => ({ tag, index }));

    const tagColumns = useMemo<ColumnDef<(typeof tagRows)[number]>[]>(
      () => [
        {
          id: "title",
          header: "Tag Title",
          cell: ({ row }) => {
            const { tag, index } = row.original;
            return tag.framework ? (
              <p>
                {isAssetTagKeyObject(tag.key) ? tag.key.title : tag.key}
              </p>
            ) : (
              <CtlTextInput
                name={`tags.${index}.key`}
                control={props.control}
                fluid
              />
            );
          },
        },
        {
          id: "value",
          header: "Value",
          cell: ({ row }) => {
            const { tag, index } = row.original;
            return (
              <RenderTagInput
                tag={tag}
                index={index}
                control={props.control}
                formState={props.formState}
              />
            );
          },
        },
        {
          id: "actions",
          header: "Actions",
          cell: ({ row }) => (
            <Button
              variant="primary"
              className="!bg-red-600 hover:!bg-red-700 active:!bg-red-800 focus-visible:!ring-red-600"
              onClick={() => remove(row.original.index)}
              aria-label="Remove tag"
              icon={<IconTrash size={16} />}
            />
          ),
        },
      ],
      [props.control, props.formState, remove]
    );

    const { data: selectedFramework, isFetching } =
      useQuery<AssetTagFramework | null>({
        queryKey: ["selectedFramework"],
        queryFn: async () => {
          if (!frameworkId) return null;

          const res = await api.getFramework(frameworkId);
          if (res.data.err) {
            throw new Error(res.data.errMsg);
          }

          if (!res.data.framework) {
            throw new Error("Failed to load framework");
          }

          const parsed: AssetTagTemplate[] = res.data.framework.templates.map(
            (t) => {
              return {
                ...t,
                key: isAssetTagKeyObject(t.key) ? t.key.title : t.key,
              };
            }
          );

          return {
            ...res.data.framework,
            templates: parsed,
          };
        },
        enabled: !!frameworkId,
      });

    useEffect(() => {
      if (selectedFramework) {
        genTagsFromFramework();
      }
    }, [selectedFramework]);

    function addTag(params: AddTagParams) {
      append(
        {
          uuid: crypto.randomUUID(), // Random UUID for new tags, will be replaced with real UUID server-side on save
          key: params.key ?? "",
          value: params.value ?? "",
          framework: params.framework ?? undefined,
        },
        { shouldFocus: false }
      );
    }

    function openSelectFrameworkModal() {
      const MODAL_ID = "select-framework-modal";
      openModal(
        <SelectFramework
          show={true}
          onClose={() => closeModal(MODAL_ID)}
          onSelected={(id) => {
            setFrameworkId(id);
            closeModal(MODAL_ID);
          }}
        />,
        MODAL_ID
      );
    }

    function genTagsFromFramework() {
      if (!selectedFramework || !selectedFramework.templates) return;

      // Don't duplicate tags when adding from framework
      const existingTags = { ...fields };
      let filtered: AssetTagTemplate[] = [];

      if (existingTags && existingTags.length > 0) {
        const valsToCheck = existingTags.map((t) =>
          isAssetTagKeyObject(t.key) ? t.key.title : t.key
        );
        filtered = selectedFramework.templates.filter(
          (t) =>
            !valsToCheck.includes(
              isAssetTagKeyObject(t.key) ? t.key.title : t.key
            )
        );
      } else {
        filtered = selectedFramework.templates;
      }

      filtered.forEach((t) => {
        addTag({
          key: isAssetTagKeyObject(t.key) ? t.key.title : t.key,
          value: getInitValueFromTemplate(t),
          framework: selectedFramework,
        });
      });
    }

    return (
      <>
        <div className="border border-gray-200 rounded-lg overflow-hidden mt-4">
          <DataTable
            data={tagRows}
            columns={tagColumns}
            loading={isFetching}
            density="compact"
            bordered
            striped
            caption="Asset tags"
            emptyState={
              <div className="py-8 text-center">
                No tags have been added to this file.
              </div>
            }
          />
        </div>
        <div className="flex flex-row gap-4 mt-6 mb-6">
          <Button
            variant="primary"
            onClick={() =>
              append({
                uuid: crypto.randomUUID(),
                key: "",
                value: "",
              })
            }
            icon={<IconPlus size={16} />}
          >
            Add Tag
          </Button>
          <Button
            variant="primary"
            onClick={() => openSelectFrameworkModal()}
            icon={<IconPlus size={16} />}
          >
            Add From Framework
          </Button>
        </div>
        {props.formState.errors.tags && (
          <p className="text-red-500 text-center mt-4 italic">
            {props.formState.errors.tags &&
              "One or more tags are missing values. If you do not wish to provide a value for an input, delete the tag before saving."}
          </p>
        )}
      </>
    );
  }
);

export default RenderTagFields;
