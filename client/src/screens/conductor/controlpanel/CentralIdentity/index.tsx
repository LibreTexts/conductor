import "../../../../components/controlpanel/ControlPanel.css";

import {
  Grid,
  Header,
  Segment,
  Icon,
  List,
  Breadcrumb,
  SemanticICONS,
} from "semantic-ui-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTypedSelector } from "../../../../state/hooks";

type CentralIdentityListItem = {
  url: string;
  icon: SemanticICONS;
  title: string;
  description: string;
};

const CentralIdentity = () => {
  // Global State
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
  const org = useTypedSelector((state) => state.org);

  /**
   * Set page title on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | LibreOne Management";
  }, []);

  const listItems: CentralIdentityListItem[] = [
    {
      url: "/controlpanel/libreone/app-licenses",
      icon: "key",
      title: "App Licenses",
      description: "View and manage App Licenses",
    },
    {
      url: "/controlpanel/libreone/instructor-verifications",
      icon: "check circle",
      title: "Instructor Verification Requests",
      description: "View and manage Instructor Verification Requests",
    },
    {
      url: "/controlpanel/libreone/orgs",
      icon: "building",
      title: "Organizations & Systems",
      description:
        "View and manage Organizations and Systems on the LibreOne platform",
    },
    {
      url: "/controlpanel/libreone/users",
      icon: "users",
      title: "Users",
      description: "View and manage Users on the LibreOne platform",
    },
    {
      url: "/controlpanel/libreone/services",
      icon: "server",
      title: "Services",
      description: "View and manage Services on the LibreOne platform",
    },
  ];

  const renderListItem = (item: CentralIdentityListItem, idx: number) => {
    return (
      <List.Item as={Link} to={item.url} key={idx}>
        <div className="flex-row-div">
          <div className="left-flex">
            <Icon name={item.icon} />
            <div className="flex-col-div ml-1p">
              <Header as="span" size="small">
                {item.title}
              </Header>
              <span>{item.description}</span>
            </div>
          </div>
          <div className="right-flex">
            <Icon name="chevron right" />
          </div>
        </div>
      </List.Item>
    );
  };

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">LibreOne Admin Consoles</Header>
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
                <Breadcrumb.Section active>
                  LibreOne Admin Consoles
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <p className="mt-1p mb-1p">
                Welcome to the LibreOne Admin Consoles. Here, you will find
                several tools to manage users throughout the LibreVerse via the
                LibreOne CAS.
              </p>
              <Segment basic>
                {isSuperAdmin && org.orgID === "libretexts" && (
                  <div className="mb-2r">
                    <Header as="h5" dividing>
                      LibreOne Admin Consoles
                    </Header>
                    <List relaxed="very" divided selection>
                      {listItems.map((item, idx) => renderListItem(item, idx))}
                    </List>
                  </div>
                )}
              </Segment>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentity;
