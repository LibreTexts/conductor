import "../../../styles/global.css";
import {
    Modal,
    Button,
    Icon,
    ModalProps,
    Header,
    Table,
    ModalActions,
  } from "semantic-ui-react";
import { useState, useEffect, lazy } from "react";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks";
import LoadingSpinner from "../../LoadingSpinner";
import { CentralIdentityApp } from "../../../types/CentralIdentity";
import { Project } from "../../../types";
import { useTypedSelector } from "../../../state/hooks";

interface ViewUserProjectsModalProps extends ModalProps {
  show: boolean;
  userId: string;
  onClose: () => void;
}

const ViewUserProjectsModal: React.FC<ViewUserProjectsModalProps> = ({
  show, 
  userId,
  onClose,
  ...rest
}) => {

  // Global state & hooks 
  const { handleGlobalError } = useGlobalError();
 // const user = useTypedSelector((state) => state.user);

  // Data & UI
  const [loading, setLoading] = useState(false);
  //const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);

  // Effects
  useEffect(() => {
  if (!show) return;
  getUserProjects();
}, [show, userId]);

  async function getUserProjects() {
    try {
      if (!userId) return;

      setLoading(true);

      const res = await axios.get('/user/projects', {
        params: {
          uuid: userId,
        },
      }
      );
      if (res.data.err || !res.data.projects || !Array.isArray(res.data.projects)) {
        handleGlobalError(res.data.errMsg);
        return;
      } 

      setUserProjects(res.data.projects);

    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }  
  }

  function goToProjectPage(slug: string) {
   // window.location.href = `/projects/${slug}`;
   window.open(`/projects/${slug}`, '_blank');
  }

  return (
    <Modal open={show} onClose={onClose} {...rest} size="large">
      <Modal.Header>View User Projects</Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div>
            <div className="">
              <Table
                striped
                celled
                size="large"
                compact
                className="mx-auto"
              >
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Project Title</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                  <Table.Row></Table.Row>
                </Table.Header>
                <Table.Body>
                  {userProjects &&
                    userProjects.length > 0 &&
                    userProjects.map((proj) => {
                      return (
                        <Table.Row key={proj.projectID} className="word-break-all">
                          <Table.Cell>
                            <span>{proj.title}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <Button 
                              className="cursor-pointer flex align-middle"
                              onClick={() => goToProjectPage(proj.projectID)}>                          
                              Open 
                              <Icon
                                name="external"
                                className="pl-2"
                              />
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {userProjects && userProjects.length === 0 && (
                    <Table.Row textAlign="center">
                      <Table.Cell>
                        <em>No projects found.</em>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Close</Button>
      </Modal.Actions>

    </Modal>
  );  
};

export default ViewUserProjectsModal;