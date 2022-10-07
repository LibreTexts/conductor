import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Button,
  Divider,
  Form,
  Icon,
  Label,
  Loader,
  Segment,
  Table,
} from 'semantic-ui-react';
import useGlobalError from 'components/error/ErrorHooks';

/**
 * An interface to view and manage the student roster of an Analytics Course.
 */
const AnalyticsCourseRoster = () => {

  const DEFAULT_SORT_METHOD = 'lastName';

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const { courseID } = useParams();

  // Data
  const [students, setStudents] = useState([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  /**
   * Retrieves the course roster from the server, assigns each entry a unique ID for UI
   * management, then saves it to state.
   */
  const getStudents = useCallback(async () => {
    setLoading(true);
    try {
      const rosterRes = await axios.get(`/analytics/courses/${courseID}/roster`, {
        params: { sort: DEFAULT_SORT_METHOD },
      });
      if (!rosterRes.data.err) {
        if (Array.isArray(rosterRes.data.students)) {
          const roster = rosterRes.data.students.map((item) => {
            return {
              ...item,
              key: crypto.randomUUID(),
            };
          });
          setStudents(roster);
        }
      } else {
        throw (new Error(rosterRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoading(false);
  }, [courseID, setStudents, setLoading, handleGlobalError]);

  /**
   * Retrieve the list of students from the server on first load.
   */
  useEffect(() => {
    getStudents();
  }, [getStudents]);

  /**
   * Validates each row of the table and sets error states, if necessary.
   *
   * @returns {boolean} True if all rows are valid, false otherwise.
   */
  function validateRows() {
    let valid = true;
    const discoveredEmails = new Set();
    const validated = students.map((item) => {
      if (!item.firstName || item.firstName.trim().length < 1 || item.firstName.length > 50) {
        valid = false;
        item.firstErr = true;
      } else {
        item.firstErr = false;
      }
      if (!item.lastName || item.lastName.trim().length < 1 || item.lastName.length > 50) {
        valid = false;
        item.lastErr = true;
      } else {
        item.lastErr = false;
      }
      if (
        !item.email
        || item.email.trim().length < 1
        || item.email.length > 320
        || discoveredEmails.has(item.email)
      ) {
        valid = false;
        item.emailErr = true;
      } else {
        discoveredEmails.add(item.email);
        item.emailErr = false;
      }
      return item;
    });
    if (!valid) {
      setStudents(validated);
    }
    return valid;
  }

  /**
   * Saves roster changes to the server, if all rows are valid.
   */
  async function handleSaveRoster() {
    if (validateRows()) {
      setLoading(true);
      try {
        const updateRes = await axios.put(`/analytics/courses/${courseID}/roster`, {
          students,
        });
        if (!updateRes.data.err) {
          setUnsaved(false);
        } else {
          throw (new Error(updateRes.data.errMsg));
        }
      } catch (e) {
        handleGlobalError(e);
      }
      setLoading(false);
    }
  }

  /**
   * Deletes a student entry from the roster.
   *
   * @param {string} key - UI management key of the entry.
   */
  function handleRowDelete(key) {
    const updated = students.filter((item) => item.key !== key);
    setStudents(updated);
    if (!unsaved) {
      setUnsaved(true);
    }
  }

  /**
   * Adds a new, empty row to the roster.
   */
  function handleRowAdd() {
    const updated = [
      ...students,
      { key: crypto.randomUUID(), email: '', firstName: '', lastName: '' },
    ];
    setStudents(updated);
  }

  /**
   * Saves updates to a field within a row to state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that triggered the handler. 
   */
  function handleRowDataChange(e) {
    const rowID = e.target.id.split('.')[1];
    const updated = students.map((item) => {
      if (rowID === item.key) {
        return {
          ...item,
          [e.target.name]: e.target.value,
        };
      }
      return item;
    });
    setStudents(updated);
    if (!unsaved) {
      setUnsaved(true);
    }
  }

  return (
    <Segment basic className="pane-segment">
      <h2>Course Roster</h2>
      <Divider />
      <p>To help protect the privacy of students and other readers, LibreTexts requires that you upload a course roster to determine for which students you can view data.</p>
      <div className="flex-row-div">
        <div className="left-flex">
          {unsaved && (
            <Label icon="warning sign" content="Unsaved Changes" color="yellow" />
          )}
          <Loader active={loading} inline="centered" />
        </div>
        <div className="right-flex">
          <Button color="green" icon labelPosition="left" onClick={handleSaveRoster}>
            <Icon name="save" />
            Save Roster
          </Button>
        </div>
      </div>
      <Form className="mt-1e">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={5} scope="col">First Name</Table.HeaderCell>
              <Table.HeaderCell width={5} scope="col">Last Name</Table.HeaderCell>
              <Table.HeaderCell width={5} scope="col">Email</Table.HeaderCell>
              <Table.HeaderCell width={1} scope="col">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {students.map((item) => {
              return (
                <Table.Row key={item.key}>
                  <Table.Cell>
                    <Form.Input
                      type="text"
                      value={item.firstName}
                      id={`firstName.${item.key}`}
                      name="firstName"
                      onChange={handleRowDataChange}
                      error={item.firstErr}
                      fluid
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Form.Input
                      type="text"
                      value={item.lastName}
                      id={`lastName.${item.key}`}
                      name="lastName"
                      onChange={handleRowDataChange}
                      error={item.lastErr}
                      fluid
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Form.Input
                      type="email"
                      value={item.email}
                      id={`email.${item.key}`}
                      name="email"
                      onChange={handleRowDataChange}
                      error={item.emailErr}
                      fluid
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Button icon color="red" onClick={() => handleRowDelete(item.key)} fluid>
                      <Icon name="remove circle" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
          <Table.Footer fullWidth>
            <Table.Row>
              <Table.HeaderCell colSpan={4}>
                <Button onClick={handleRowAdd} color="blue" icon labelPosition="left">
                  <Icon name="add user" />
                  Add Row
                </Button>
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>
      </Form>
    </Segment>
  );
};

export default AnalyticsCourseRoster;