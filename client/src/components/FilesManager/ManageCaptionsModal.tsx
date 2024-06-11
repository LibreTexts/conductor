import { Button, Form, Icon, Input, Modal, Table } from "semantic-ui-react";
import { CloudflareCaptionData } from "../../types/Misc";
import { useRef, useState } from "react";
import useGlobalError from "../error/ErrorHooks";
import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import api from "../../api";
import LoadingSpinner from "../LoadingSpinner";

interface ManageCaptionsModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
  fileID: string;
}

const ManageCaptionsModal: React.FC<ManageCaptionsModalProps> = ({
  show,
  onClose,
  projectID,
  fileID,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = new QueryClient();
  const { handleGlobalError } = useGlobalError();
  const { data: captions, isFetching } = useQuery<CloudflareCaptionData[]>({
    queryKey: ["getProjectFileCaptions", projectID, fileID],
    queryFn: async () => getFileCaptions(),
    enabled: show,
  });
  const [languageCode, setLanguageCode] = useState("");
  const [captionFile, setCaptionFile] = useState<File | null>(null);

  async function getFileCaptions() {
    try {
      if (!projectID || !fileID) return [];
      const res = await api.getProjectFileCaptions(projectID, fileID);
      if (!res.data?.captions) return [];
      return res.data.captions;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const fileUploadMutation = useMutation({
    mutationFn: async () => {
      if (!languageCode) throw new Error("Language code is required");
      if (!captionFile) throw new Error("Caption file is required");

      const _formData = new FormData();
      _formData.append("files", captionFile);
      _formData.append("language", languageCode);

      const res = await api.uploadProjectFileCaptions(
        projectID,
        fileID,
        _formData
      );
      return res.data;
    },
    onError: (err) => {
      handleGlobalError(err);
    },
    onSettled: () => {
      setCaptionFile(null);
      setLanguageCode("");
      queryClient.invalidateQueries({
        queryKey: ["getProjectFileCaptions", projectID, fileID],
      });
    },
  });

  function handleOpenFileExplorer() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setCaptionFile(files[0]);
  }

  return (
    <Modal open={show} onClose={onClose} size="small">
      <Modal.Header>Manage Video Captions</Modal.Header>
      <Modal.Content scrolling className="p-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileUpload(e)}
          max={1}
          accept=".vtt"
          className="hidden"
        />
        {isFetching && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!isFetching && (
          <div>
            <div className="">
              <Table striped celled size="large" compact className="mx-auto !mb-0">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Caption Language</Table.HeaderCell>
                    <Table.HeaderCell>Language Code</Table.HeaderCell>
                  </Table.Row>
                  <Table.Row></Table.Row>
                </Table.Header>
                <Table.Body>
                  {captions &&
                    captions.length > 0 &&
                    captions.map((capt) => {
                      return (
                        <Table.Row key={capt.language} className="break-words">
                          <Table.Cell>
                            <span>{capt.label}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{capt.language}</span>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {captions && captions.length === 0 && (
                    <Table.Row textAlign="center">
                      <Table.Cell colSpan={2}>
                        <em>No caption files found.</em>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
              <p className="italic muted-text text-center text-sm mt-2">
                It may take a few moments for newly uploaded captions to appear.
              </p>
            </div>
            <hr className="my-4" />
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <p className="font-semibold text-center text-lg !mt-8">
                Upload a new caption file
              </p>
              <p className="text-center italic muted-text">
                Uploading a new caption file will overwrite any existing
                captions for the same language.
              </p>
              <div className="flex flex-col mt-4 mb-3">
                <label
                  className="form-field-label form-required mb-0.5"
                  htmlFor="language-code-input"
                >
                  Language Code
                </label>
                <Input
                  id="language-code-input"
                  placeholder="Language Code (e.g. en)"
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value)}
                  maxLength={2}
                />
              </div>
              <Button color="blue" onClick={handleOpenFileExplorer}>
                <Icon name="folder" />
                Choose File
              </Button>
              {captionFile && (
                <div className="mt-4 flex flex-row justify-center">
                  <Button
                    onClick={() => fileUploadMutation.mutateAsync()}
                    color="green"
                    disabled={!languageCode || !captionFile}
                    loading={fileUploadMutation.isLoading}
                  >
                    <Icon name="save" />
                    Upload & Save
                  </Button>
                </div>
              )}
            </Form>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ManageCaptionsModal;
