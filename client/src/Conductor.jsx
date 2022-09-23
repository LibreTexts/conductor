import React from 'react';
import { Route, Switch } from 'react-router-dom';
import { useSelector } from 'react-redux';

import AnonRoute from './components/util/AnonRoute';
import PrivateRoute from './components/util/PrivateRoute';

import AccountRequest from './screens/conductor/AccountRequest';
import AccountRequests from './screens/conductor/controlpanel/AccountRequests';
import AccountSettings from './screens/conductor/AccountSettings';
import AdoptionReports from './screens/conductor/controlpanel/AdoptionReports';
import BooksManager from './screens/conductor/controlpanel/BooksManager';
import CampusSettings from './components/controlpanel/CampusSettings';
import CollectionsManager from './components/controlpanel/CollectionsManager';
import ControlPanel from './components/controlpanel/ControlPanel';
import HarvestingRequests from './components/controlpanel/HarvestingRequests';
import HarvestRequest from './components/harvestrequest/HarvestRequest';
import Home from './screens/conductor/Home';
import HomeworkManager from './components/controlpanel/HomeworkManager';
import Login from './components/auth/Login';
import MyAlerts from './components/alerts/MyAlerts';
import Navbar from './components/navigation/Navbar';
import OrganizationsManager from './components/controlpanel/OrganizationsManager';
import PeerReviewPage from './components/peerreview/PeerReviewPage';
import PeerReviewRubricManage from './components/controlpanel/PeerReviewRubricManage';
import PeerReviewRubrics from './components/controlpanel/PeerReviewRubrics';
import ProjectAccessibility from './components/projects/ProjectAccessibility';
import ProjectPeerReview from './components/projects/ProjectPeerReview';
import ProjectsAvailable from './components/projects/ProjectsAvailable';
import ProjectsCompleted from './components/projects/ProjectsCompleted';
import ProjectsFlagged from './components/projects/ProjectsFlagged';
import ProjectsPortal from './components/projects/ProjectsPortal';
import ProjectTimeline from './components/projects/ProjectTimeline';
import ProjectView from './components/projects/ProjectView';
import Register from './components/auth/Register';
import ResetPassword from './components/auth/ResetPassword';
import Search from './components/search/Search';
import UserDetails from './components/controlpanel/UserDetails';
import UsersManager from './components/controlpanel/UsersManager';

/* 404 */
import PageNotFound from './components/util/PageNotFound';

/**
 * The project planning and internal tools system. Requires authentication to access most pages.
 */
const Conductor = () => {

  // Global State and Location
  const org = useSelector((state) => state.org);

  return (
    <div className='conductor'>
      <Navbar />
      <Switch>
        <AnonRoute exact path='/login' component={Login} />
        <AnonRoute exact path='/register' component={Register} />
        <AnonRoute exact path='/resetpassword' component={ResetPassword} />
        <PrivateRoute exact path='/home' component={Home} />
        <PrivateRoute exact path='/search' component={Search} />
        <PrivateRoute exact path='/alerts' component={MyAlerts} />
        <PrivateRoute exact path='/projects/(create)?' component={ProjectsPortal} />
        <PrivateRoute exact path='/projects/available' component={ProjectsAvailable} />       
        <PrivateRoute exact path='/projects/completed' component={ProjectsCompleted} />
        <PrivateRoute exact path='/projects/flagged' component={ProjectsFlagged} />
        <PrivateRoute exact path='/projects/:id' component={ProjectView} />
        <PrivateRoute exact path='/projects/:id/accessibility' component={ProjectAccessibility} />
        <PrivateRoute exact path='/projects/:id/peerreview' component={ProjectPeerReview} />
        <PrivateRoute exact path='/projects/:id/timeline' component={ProjectTimeline} />
        <PrivateRoute exact path='/account' component={AccountSettings} />
        <PrivateRoute exact path='/controlpanel' component={ControlPanel} />
        <PrivateRoute exact path='/controlpanel/accountrequests' component={AccountRequests} />
        <PrivateRoute exact path='/controlpanel/adoptionreports' component={AdoptionReports} />
        <PrivateRoute exact path='/controlpanel/booksmanager' component={BooksManager} />
        <PrivateRoute exact path='/controlpanel/campussettings' component={CampusSettings} />
        <PrivateRoute exact path='/controlpanel/collectionsmanager' component={CollectionsManager} />
        <PrivateRoute exact path='/controlpanel/harvestingrequests' component={HarvestingRequests} />
        <PrivateRoute exact path='/controlpanel/homeworkmanager' component={HomeworkManager} />
        <PrivateRoute exact path='/controlpanel/orgsmanager' component={OrganizationsManager} />
        <PrivateRoute exact path='/controlpanel/peerreviewrubrics' component={PeerReviewRubrics} />
        <PrivateRoute exact path='/controlpanel/peerreviewrubrics/:mode/:rubricID?' component={PeerReviewRubricManage} />
        <PrivateRoute exact path='/controlpanel/usersmanager' component={UsersManager} />
        <PrivateRoute exact path='/controlpanel/usersmanager/:uuid' component={UserDetails} />
        {(org.orgID === 'libretexts') && [
          <Route exact path='/harvestrequest' key='harvestrequest' component={HarvestRequest} />,
          <PrivateRoute exact path="/accountrequest" key="accountrequest" component={AccountRequest} unAuthSrc="accountrequest" />
        ]}
        <Route exact path='/peerreview/:id' component={PeerReviewPage} />

        {/* 404 */}
        <Route component={PageNotFound} />
      </Switch>
    </div>
  )
};

export default Conductor;
