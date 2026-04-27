import {
  Grid,
  Header,
  Icon,
  Image,
  Segment,
  Divider,
  List,
  Button,
} from 'semantic-ui-react';
import useGlobalError from '../error/ErrorHooks';
import { Account, Organization } from '../../types';
import { getCentralAuthProfileEditURL } from '../../utils/centralIdentityHelpers';

/** 
 * The Account Overview pane displays general Conductor account information and allows
 * users to edit their name or avatar.
 */
const AccountOverview = ({ account, onDataChange }: {account: Account, onDataChange: Function}) => {

  const DEFAULT_AVATAR = '/mini_logo.png';

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  return (
    <Segment basic className="pane-segment">
      <h2>Account Overview</h2>
      <Divider />
      <Grid divided="vertically">
        <Grid.Row>
          <Grid.Column width={4}>
            <Image
              src={account?.avatar || DEFAULT_AVATAR}
              size="medium"
              circular
            />
          </Grid.Column>
          <Grid.Column width={12}>
            <Header as="h2">
              {account?.firstName} {account?.lastName}
            </Header>
            <Button
              as="a"
              href={getCentralAuthProfileEditURL()}
              target="_blank"
              color="blue"
            >
              <Icon name="external" />
              Edit profile in LibreOne
            </Button>
            <Header sub>Roles</Header>
            {Array.isArray(account?.roles)
              ? (
                <List verticalAlign="middle" celled relaxed>
                  {account.roles.map((item, idx) => {
                    let orgName = 'Unknown Organization';
                    const org = item?.org as Organization;
                    if (org) {
                      if (org.shortName) {
                        orgName = org.shortName;
                      } else if (org.name) {
                        orgName = org.name;
                      }
                    }
                    return (
                      <List.Item key={idx}>
                        <List.Icon name="building" />
                        <List.Content>
                          <List.Header>{orgName}</List.Header>
                          <List.Description>
                            {item.role || 'Unknown Role'}
                          </List.Description>
                        </List.Content>
                      </List.Item>
                    );
                  })}
                </List>
              )
              : <p><em>No roles available.</em></p>
            }
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </Segment>
  );
};

export default AccountOverview;
