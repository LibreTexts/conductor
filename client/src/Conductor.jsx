import React from 'react';
import { Route, Switch } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './components/LoadingSpinner';
import Navbar from './components/navigation/Navbar';

const AnonRoute = React.lazy(() => import('./components/util/AnonRoute'));
const PrivateRoute = React.lazy(() => import('./components/util/PrivateRoute'));

const AccountRequest = React.lazy(() => import('./screens/conductor/AccountRequest'));
const AccountRequests = React.lazy(() => import('./screens/conductor/controlpanel/AccountRequests'));
const AccountSettings = React.lazy(() => import('./screens/conductor/AccountSettings'));
const AdoptionReports = React.lazy(() => import('./screens/conductor/controlpanel/AdoptionReports'));
const AnalyticsCourseView = React.lazy(() => import('./screens/conductor/analytics/AnalyticsCourseView'));
const AnalyticsInvites = React.lazy(() => import('./screens/conductor/analytics/AnalyticsInvites'));
const AnalyticsPortal = React.lazy(() => import('./screens/conductor/analytics/AnalyticsPortal'));
const AnalyticsRequestAccess = React.lazy(() => import('./screens/conductor/analytics/AnalyticsRequestAccess'));
const AnalyticsRequests = React.lazy(() => import('./screens/conductor/controlpanel/AnalyticsRequests'));
const BooksManager = React.lazy(() => import('./screens/conductor/controlpanel/BooksManager'));
const CampusSettings = React.lazy(() => import('./components/controlpanel/CampusSettings'));
const CollectionsManager = React.lazy(() => import('./components/controlpanel/CollectionsManager'));
const ControlPanel = React.lazy(() => import('./components/controlpanel/ControlPanel'));
const HarvestingRequests = React.lazy(() => import('./components/controlpanel/HarvestingRequests'));
const HarvestRequest = React.lazy(() => import('./components/harvestrequest/HarvestRequest'));
const Home = React.lazy(() => import('./screens/conductor/Home'));
const HomeworkManager = React.lazy(() => import('./components/controlpanel/HomeworkManager'));
const Login = React.lazy(() => import('./components/auth/Login'));
const MyAlerts = React.lazy(() => import('./components/alerts/MyAlerts'));
const OrganizationsManager = React.lazy(() => import('./components/controlpanel/OrganizationsManager'));
const PeerReviewPage = React.lazy(() => import('./components/peerreview/PeerReviewPage'));
const PeerReviewRubricManage = React.lazy(() => import('./components/controlpanel/PeerReviewRubricManage'));
const PeerReviewRubrics = React.lazy(() => import('./components/controlpanel/PeerReviewRubrics'));
const ProjectAccessibility = React.lazy(() => import('./components/projects/ProjectAccessibility'));
const ProjectPeerReview = React.lazy(() => import('./components/projects/ProjectPeerReview'));
const ProjectsAvailable = React.lazy(() => import('./components/projects/ProjectsAvailable'));
const ProjectsCompleted = React.lazy(() => import('./components/projects/ProjectsCompleted'));
const ProjectsFlagged = React.lazy(() => import('./components/projects/ProjectsFlagged'));
const ProjectsPortal = React.lazy(() => import('./components/projects/ProjectsPortal'));
const ProjectTimeline = React.lazy(() => import('./components/projects/ProjectTimeline'));
const ProjectView = React.lazy(() => import('./components/projects/ProjectView'));
const Register = React.lazy(() => import('./components/auth/Register'));
const ResetPassword = React.lazy(() => import('./components/auth/ResetPassword'));
const Search = React.lazy(() => import('./components/search/Search'));
const UserDetails = React.lazy(() => import('./components/controlpanel/UserDetails'));
const UsersManager = React.lazy(() => import('./components/controlpanel/UsersManager'));

/* 404 */
const PageNotFound = React.lazy(() => import('./components/util/PageNotFound'));

/**
 * The project planning and internal tools system. Requires authentication to access most pages.
 */
const Conductor = () => {

  // Global State and Location
  const org = useSelector((state) => state.org);

  return (
    <div className='conductor'>
      <Navbar />
      <React.Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <AnonRoute exact path='/login' component={Login} />
          <AnonRoute exact path='/register' component={Register} />
          <AnonRoute exact path='/resetpassword' component={ResetPassword} />
          <PrivateRoute exact path='/home' component={Home}/>
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
          <PrivateRoute exact path='/analytics/(create)?' component={AnalyticsPortal} />
          <PrivateRoute exact path='/analytics/invites' component={AnalyticsInvites} />
          <PrivateRoute exact path='/analytics/requestaccess' component={AnalyticsRequestAccess} />
          <PrivateRoute exact path='/analytics/:courseID/:pane?/:settingsPane?' component={AnalyticsCourseView} />
          <PrivateRoute exact path='/account/:activePane?' component={AccountSettings} />
          <PrivateRoute exact path='/controlpanel' component={ControlPanel} />
          <PrivateRoute exact path='/controlpanel/accountrequests' component={AccountRequests} />
          <PrivateRoute exact path='/controlpanel/adoptionreports' component={AdoptionReports} />
          <PrivateRoute exact path='/controlpanel/analyticsrequests' component={AnalyticsRequests} />
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
      </React.Suspense>
    </div>
  )
};

export default Conductor;
