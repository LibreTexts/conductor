import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Loader,
  Icon,
  Button,
} from "semantic-ui-react";
import { CentralIdentityOrg, CentralIdentitySystem } from "../../../../types";
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import ManageUserModal from "../../../../components/controlpanel/CentralIdentity/ManageUserModal";

const CentralIdentityOrgs = () => {
  //Global State
  const { handleGlobalError } = useGlobalError();

  //UI
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [activeIndices, setActiveIndices] = useState<number[]>([]);

  //Data
  const [systems, setSystems] = useState<CentralIdentitySystem[]>([]);
  const [selectedSystem, setSelectedSystem] =
    useState<CentralIdentitySystem | null>(null);

  //Effects
  useEffect(() => {
    getSystems();
  }, []);

  async function getSystems() {
    try {
      setLoading(true);
      const res = await axios.get("/central-identity/systems");
      console.log(res.data);
      if (
        res.data.err ||
        !res.data.systems ||
        !Array.isArray(res.data.systems) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving organizations");
      }

      console.log(res.data.systems);
      setSystems(res.data.systems);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSystem(system: CentralIdentitySystem) {
    setSelectedSystem(system);
    setShowUserModal(true);
  }

  const AccordionPanel = ({
    system,
    idx,
  }: {
    system: CentralIdentitySystem;
    idx: number;
  }) => {
    return (
      <>
        <Accordion.Title
          active={activeIndices.includes(idx)}
          index={idx}
          key={system.id}
          onClick={() => activeIndices.push(idx)}
        >
          <Icon name="dropdown" />
          {system.name}
        </Accordion.Title>
        <Accordion.Content active={activeIndices.includes(idx)}>
          <p>
            A dog is a type of domesticated animal. Known for its loyalty and
            faithfulness, it can be found as a welcome guest in many households
            across the world.
          </p>
        </Accordion.Content>
      </>
    );
  };

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Central Identity: Organizations & Systems
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section
                  as={Link}
                  to="/controlpanel/central-identity"
                >
                  Central Identity
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Organizations & Systems
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            {loading && (
              <Segment>
                <Loader active inline="centered" />
              </Segment>
            )}
            <Segment>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={systems.length}
              />
            </Segment>
            <Segment>
              {systems.length > 0 && (
                <Accordion
                  panels={systems.map((system, idx) => {
                    return (
                      <AccordionPanel
                        system={system}
                        idx={idx}
                        key={system.id}
                      />
                    );
                  })}
                  exclusive={false}
                  fluid
                />
              )}
              {systems.length === 0 && <p>No organizations found</p>}
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={systems.length}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityOrgs;
