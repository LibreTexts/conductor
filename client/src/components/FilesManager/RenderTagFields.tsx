import { Control, FormState, useFieldArray } from "react-hook-form";
import {
  AssetTagFramework,
  AssetTagTemplate,
  AssetTagValue,
  ProjectFile,
} from "../../types";
import { Button, Icon, Table } from "semantic-ui-react";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { RenderTagInput } from "./RenderTagInput";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";
import { useModals } from "../../context/ModalContext";
import SelectFramework from "./SelectFramework";
import { getInitValueFromTemplate } from "../../utils/assetHelpers";
import api from "../../api";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "../LoadingSpinner";

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
        <Table celled>
          <Table.Header fullWidth>
            <Table.Row key="header">
              <Table.HeaderCell>Tag Title</Table.HeaderCell>
              <Table.HeaderCell>Value</Table.HeaderCell>
              <Table.HeaderCell width={1}>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isFetching && <LoadingSpinner />}
            {fields && fields.length > 0 ? (
              fields.map((tag, index) => (
                <Table.Row key={tag.id}>
                  <Table.Cell>
                    {tag.framework ? (
                      <div className="flex flex-col">
                        <p>
                          {isAssetTagKeyObject(tag.key)
                            ? tag.key.title
                            : tag.key}
                        </p>
                      </div>
                    ) : (
                      <CtlTextInput
                        name={`tags.${index}.key`}
                        control={props.control}
                        fluid
                      />
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <RenderTagInput
                      tag={tag}
                      index={index}
                      control={props.control}
                      formState={props.formState}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      color="red"
                      icon="trash"
                      onClick={() => remove(index)}
                      className="!ml-1"
                    ></Button>
                  </Table.Cell>
                </Table.Row>
              ))
            ) : (
              <Table.Row>
                <Table.Cell colSpan={3} className="text-center">
                  No tags have been added to this file.
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
        <div className="flex flex-row">
          <Button
            color="blue"
            onClick={() =>
              append({
                uuid: crypto.randomUUID(),
                key: "",
                value: "",
              })
            }
          >
            <Icon name="plus" />
            Add Tag
          </Button>
          <Button color="blue" onClick={() => openSelectFrameworkModal()}>
            <Icon name="plus" />
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
