import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Button, Modal, Loader, Icon, Table, Form } from "semantic-ui-react";
import isURL from "validator/lib/isURL";
import useGlobalError from "../error/ErrorHooks";

/**
 * Modal tool to manage the Reader Resources set for a Commons Book
 * linked to a Conductor Project.
 */
const ReaderResourcesManager = ({ projectID, show, onClose, ...props }) => {

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // Data
  const [resources, setResources] = useState([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  /**
   * Load the Reader Resources list from the server, prepare it for the UI, then save it to state.
   */
  const getResources = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/project/${projectID}/book/readerresources`
      );
      if (!response.data.err) {
        if (Array.isArray(response.data.readerResources)) {
          const withKey = response.data.readerResources.map((item) => ({
            ...item,
            key: crypto.randomUUID(),
          }));
          //Random key used here for UI management purposes. Existing resources have Mongo _id
          setResources(withKey);
        }
      } else {
        throw new Error(response.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [projectID, setLoading, setResources, handleGlobalError]);

  /**
   * Load the Resources list on open.
   */
  useEffect(() => {
    if (show) {
      getResources();
    }
  }, [show, getResources]);

  /**
   * Validates each row of the table and sets error states, if necessary.
   *
   * @returns {boolean} True if all rows are valid, false otherwise.
   */
  function validateRows() {
    let valid = true;
    const validated = resources.map((item) => {
      if (!item.name || item.name.trim().length < 2 || item.name.trim().length > 100) {
        valid = false;
        item.nameErr = true;
      }
      if (!item.url || !isURL(item.url.trim())) {
        valid = false;
        item.urlErr = true;
      }

      return item;
    });
    if (!valid) {
      setResources(validated);
    }
    return valid;
  }

  /**
   * Saves resources changes to the server, if all rows are valid.
   */
  async function handleSaveResources() {
    if (validateRows()) {
      setLoading(true);
      try {
        const updateRes = await axios.put(
          `/project/${projectID}/book/readerresources`,
          { readerResources: resources }
        );
        if (!updateRes.data.err) {
          setUnsaved(false);
          onClose();
        } else {
          throw new Error(updateRes.data.errMsg);
        }
      } catch (e) {
        handleGlobalError(e);
      }
      setLoading(false);
    }
  }

  /**
   * Deletes a resource entry from the roster.
   *
   * @param {string} key - UI management key of the entry.
   */
  function handleRowDelete(key) {
    const updated = resources.filter((item) => item.key !== key);
    setResources(updated);
    if (!unsaved) {
      setUnsaved(true);
    }
  }

  /**
   * Adds a new, empty row to the roster.
   */
  function handleRowAdd() {
    const updated = [
      ...resources,
      { key: crypto.randomUUID(), name: "", url: "" }, //Random key generated, will be replaced by mongo id after saving
    ];
    setResources(updated);
  }

  /**
   * Saves updates to a field within a row to state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that triggered the handler.
   */
  function handleRowDataChange(e) {
    const rowID = e.target.id.split(".")[1];
    const updated = resources.map((item) => {
      if (rowID === item.key) {
        return {
          ...item,
          [e.target.name]: e.target.value,
        };
      }
      return item;
    });
    setResources(updated);
    if (!unsaved) {
      setUnsaved(true);
    }
  }

  return (
    <Modal size="fullscreen" open={show} onClose={onClose} {...props}>
      <Modal.Header>Manage Reader Resources</Modal.Header>
      <Modal.Content scrolling>
        <p>
          If your book has external resources you'd like to share with your
          readers, use this tool to link and share them. These resources will be
          visible to the public using Reader View on the LibreTexts libraries.
        </p>
        {!loading ? (
          <>
            <Form className="mt-1e">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell width={5} scope="col">
                      Name
                    </Table.HeaderCell>
                    <Table.HeaderCell width={5} scope="col">
                      URL
                    </Table.HeaderCell>
                    <Table.HeaderCell width={1} scope="col">
                      Actions
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {resources.map((item) => {
                    return (
                      <Table.Row key={item.key}>
                        <Table.Cell>
                          <Form.Input
                            type="text"
                            value={item.name}
                            id={`name.${item.key}`}
                            name="name"
                            onChange={handleRowDataChange}
                            error={item.nameErr}
                            fluid
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Form.Input
                            type="text"
                            value={item.url}
                            id={`url.${item.key}`}
                            name="url"
                            onChange={handleRowDataChange}
                            error={item.urlErr}
                            fluid
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            icon
                            color="red"
                            onClick={() => handleRowDelete(item.key)}
                            fluid
                          >
                            <Icon name="remove circle" />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                  {resources.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={4}>
                        <p className="muted-text text-center">
                          <em>No entries yet.</em>
                        </p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
                <Table.Footer fullWidth>
                  <Table.Row>
                    <Table.HeaderCell colSpan={4}>
                      <Button
                        onClick={handleRowAdd}
                        color="blue"
                        icon
                        labelPosition="left"
                      >
                        <Icon name="add user" />
                        Add Row
                      </Button>
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Footer>
              </Table>
            </Form>
          </>
        ) : (
          <Loader active inline="centered" className="mt-2r mb-2r" />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} color="grey">
          Cancel
        </Button>

        <Button
          onClick={handleSaveResources}
          color="green"
          icon
          labelPosition="left"
        >
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

ReaderResourcesManager.propTypes = {
  /**
   * Identifier of the project the book belongs to.
   */
  projectID: PropTypes.string.isRequired,
  /**
   * Opens or closes the modal.
   */
  show: PropTypes.bool.isRequired,
  /**
   * Handler to activate when the modal is closed.
   */
  onClose: PropTypes.func,
};

ReaderResourcesManager.defaultProps = {
  onClose: () => {},
};

export default ReaderResourcesManager;
