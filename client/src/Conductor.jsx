import React from 'react';
import { Route, Switch } from 'react-router-dom';
import { useSelector } from 'react-redux';

import AnonRoute from './components/util/AnonRoute.jsx';
import PrivateRoute from './components/util/PrivateRoute.jsx';

import AccountRequest from './components/accountrequest/AccountRequest.jsx';
import AccountRequests from './components/controlpanel/AccountRequests.jsx';
import AccountSettings from './components/auth/AccountSettings.jsx';
import AdoptionReports from './components/controlpanel/AdoptionReports.jsx';
import BooksManager from './screens/conductor/controlpanel/BooksManager';
import CampusSettings from './components/controlpanel/CampusSettings.jsx';
import CollectionsManager from './components/controlpanel/CollectionsManager.jsx';
import ControlPanel from './components/controlpanel/ControlPanel.jsx';
import HarvestingRequests from './components/controlpanel/HarvestingRequests.jsx';
import HarvestRequest from './components/harvestrequest/HarvestRequest.jsx';
import Home from './components/home/Home.jsx';
import HomeworkManager from './components/controlpanel/HomeworkManager.jsx';
import Login from './components/auth/Login.jsx';
import MyAlerts from './components/alerts/MyAlerts.jsx';
import Navbar from './components/navigation/Navbar.jsx';
import OrganizationsManager from './components/controlpanel/OrganizationsManager.jsx';
import PeerReviewPage from './components/peerreview/PeerReviewPage.jsx';
import PeerReviewRubricManage from './components/controlpanel/PeerReviewRubricManage.jsx';
import PeerReviewRubrics from './components/controlpanel/PeerReviewRubrics.jsx';
import ProjectAccessibility from './components/projects/ProjectAccessibility.jsx';
import ProjectCreate from './components/projects/ProjectCreate.jsx';
import ProjectPeerReview from './components/projects/ProjectPeerReview.jsx';
import ProjectsAvailable from './components/projects/ProjectsAvailable.jsx';
import ProjectsCompleted from './components/projects/ProjectsCompleted.jsx';
import ProjectsFlagged from './components/projects/ProjectsFlagged.jsx';
import ProjectsPortal from './components/projects/ProjectsPortal.jsx';
import ProjectTimeline from './components/projects/ProjectTimeline.jsx';
import ProjectView from './components/projects/ProjectView.jsx';
import Register from './components/auth/Register.jsx';
import ResetPassword from './components/auth/ResetPassword.jsx';
import Search from './components/search/Search.jsx';
import UserDetails from './components/controlpanel/UserDetails.jsx';
import UsersManager from './components/controlpanel/UsersManager.jsx';

/* 404 */
import PageNotFound from './components/util/PageNotFound.jsx';

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
        <PrivateRoute exact path='/projects' component={ProjectsPortal} />
        <PrivateRoute exact path='/projects/available' component={ProjectsAvailable} />
        <PrivateRoute exact path='/projects/create' component={ProjectCreate} />
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
          <Route exact path='/accountrequest' key='accountrequest' component={AccountRequest} />
        ]}
        <Route exact path='/peerreview/:id' component={PeerReviewPage} />

        {/* 404 */}
        <Route component={PageNotFound} />
      </Switch>
    </div>
  )
};

export default Conductor;
