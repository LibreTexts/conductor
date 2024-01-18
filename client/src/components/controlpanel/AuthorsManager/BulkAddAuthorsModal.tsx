import { useState, useRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import {
  Button,
  Icon,
  Input,
  Modal,
  ModalProps,
  Popup,
  Table,
} from "semantic-ui-react";
import { AssetTagFramework, Author } from "../../../types";
import "../../../styles/global.css";
import useGlobalError from "../../error/ErrorHooks";
import { ParseResult, parse } from "papaparse";
import LoadingSpinner from "../../LoadingSpinner";
import api from "../../../api";

interface BulkAddAuthorsModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
}

const BulkAddAuthorsModal: React.FC<BulkAddAuthorsModalProps> = ({
  open,
  onClose,
}) => {
  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);
  const [authorsToAdd, setAuthorsToAdd] = useState<Author[]>([]);
  const [didParse, setDidParse] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Handle file selection here
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      parseFile(selectedFile);
    }
  };

  async function parseFile(file: File) {
    try {
      setLoading(true);
      setDidParse(false);

      function parsePromise(file: File) {
        return new Promise<ParseResult<unknown>>((resolve, reject) => {
          // @ts-ignore
          parse(file, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
            preview: 1500, // Only parse first 1500 rows
            complete: (results) => {
              resolve(results); // Resolve the Promise with parsed data
            },
            error: (error) => {
              reject(error); // Reject the Promise with the error
            },
          });
        });
      }

      const results = await parsePromise(file);
      const dataObjs = results.data.filter(
        (r) => typeof r === "object" && r !== null
      ) as object[];
      if (dataObjs.length > 1500) {
        throw new Error(
          "Only 1500 records can be added at a time. Please reduce the number of records and try again."
        );
      }

      const authorsToAdd = dataObjs.filter(
        (obj) =>
          obj.hasOwnProperty("firstName") && obj.hasOwnProperty("lastName")
      );

      if (authorsToAdd.length === 0) {
        throw new Error("No authors to add");
      }

      setAuthorsToAdd(authorsToAdd as Author[]);
      setDidParse(true);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkUpload() {
    try {
      setLoading(true);

      if (!authorsToAdd || authorsToAdd.length === 0) {
        throw new Error("No authors to add");
      }

      const res = await api.bulkCreateAuthors(authorsToAdd);

      if (
        res.data.err ||
        !res.data.authors ||
        !Array.isArray(res.data.authors)
      ) {
        throw new Error("Error adding authors");
      }

      setAuthorsToAdd([]);
      setDidParse(false);
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose()} size="large">
      <Modal.Header>Bulk Add Authors</Modal.Header>
      <Modal.Content
        scrolling
        className="flex flex-col justify-center items-center"
      >
        <div className="flex flex-col justify-start items-center">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {didParse && (
                <p className="mt-4 !-ml-16">
                  <Icon name="check circle outline" color="green" />
                  File Parsed Successfully
                </p>
              )}
            </>
          )}
        </div>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex flex-row justify-between items-center">
          <Popup
            content="Create a CSV file with one author record per line. The first row should contain the column headers: firstName, lastName, email, url, primaryInstitution. All other columns will be ignored. Only firstName and lastName are required fields. Any duplicate records (based on email) will be ignored. To prevent misuse, only 1500 records can be added at a time."
            trigger={
              <span className="underline cursor-pointer">
                How do I use this?
              </span>
            }
          />
          <div>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpload}
              color="green"
              disabled={loading || !didParse}
              className="!ml-2"
            >
              <Icon name="save" />
              Save
            </Button>
          </div>
        </div>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkAddAuthorsModal;
