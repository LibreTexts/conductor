import { Suspense, lazy } from 'react';
import { Route, Switch } from 'react-router-dom';
import { useSelector } from 'react-redux';

import AnonRoute from './components/util/AnonRoute';
import PrivateRoute from './components/util/PrivateRoute';

const AccountSettings = lazy(() => import('./screens/conductor/AccountSettings'));
const AdoptionReports = lazy(() => import('./screens/conductor/controlpanel/AdoptionReports'));
const AnalyticsCourseView = lazy(() => import('./screens/conductor/analytics/AnalyticsCourseView'));
const AnalyticsInvites = lazy(() => import('./screens/conductor/analytics/AnalyticsInvites'));
const AnalyticsPortal = lazy(() => import('./screens/conductor/analytics/AnalyticsPortal'));
const AnalyticsRequestAccess = lazy(() => import('./screens/conductor/analytics/AnalyticsRequestAccess'));
const AnalyticsRequests = lazy(() => import('./screens/conductor/controlpanel/AnalyticsRequests'));
const AssetTagsManager = lazy(() => import('./screens/conductor/controlpanel/AssetTagsManager'));
const BooksManager = lazy(() => import('./screens/conductor/controlpanel/BooksManager'));
const CampusSettings = lazy(() => import('./components/controlpanel/CampusSettings'));
const CollectionsManager = lazy(() => import('./components/controlpanel/Collections/CollectionsManager'));
const ControlPanel = lazy(() => import('./components/controlpanel/ControlPanel'));
import EventsManager from './screens/conductor/controlpanel/EventsManager';
import EventRegistration from './screens/conductor/OrgEvents/EventRegistration';
const FallbackAuth = lazy(() => import('./screens/conductor/FallbackAuth'));
import HarvestingRequests from './components/controlpanel/HarvestingRequests';
import HarvestRequest from './components/harvestrequest/HarvestRequest';
import Home from './screens/conductor/Home';
import HomeworkManager from './components/controlpanel/HomeworkManager';
const KnowledgeBase = lazy(() => import('./screens/conductor/kb'));
const KBEditPage = lazy(() => import('./screens/conductor/kb/KBEditPage'));
const Login = lazy(() => import('./screens/conductor/Login'));
import ManageEvent from './screens/conductor/controlpanel/EventsManager/ManageEvent';
import MyAlerts from './components/alerts/MyAlerts';
import Navbar from './components/navigation/Navbar';
import KBNavbar from './components/kb/Navbar';
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
import Search from './components/search/Search';
import UserDetails from './components/controlpanel/UserDetails';
import UsersManager from './components/controlpanel/UsersManager';
import LoadingSpinner from './components/LoadingSpinner';
const CentralIdentity = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity'));
const CentralIdentityInstructorVerifications = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityInstructorVerifications'));
const CentralIdentityOrgs = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityOrgs'));
const CentralIdentityServices = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityServices'));
const CentralIdentityUsers = lazy(() => import('./screens/conductor/controlpanel/CentralIdentity/CentralIdentityUsers'));

/* 404 */
import PageNotFound from './components/util/PageNotFound';

const RenderNavbar = () => {
  if(window.location.pathname.includes('/kb')){
    return <KBNavbar />;
  }
  return <Navbar />
}

/**
 * The project planning and internal tools system. Requires authentication to access most pages.
 */
const Conductor = () => {

  // Global State and Location
  const org = useSelector((state) => state.org);

  return (
    <div className='conductor'>
      <RenderNavbar />
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
        <AnonRoute exact path='/login' component={Login} />
        <AnonRoute exact path='/fallback-auth' component={FallbackAuth} />
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
        <PrivateRoute exact path='/analytics/(create)?' component={AnalyticsPortal} />
        <PrivateRoute exact path='/analytics/invites' component={AnalyticsInvites} />
        <PrivateRoute exact path='/analytics/requestaccess' component={AnalyticsRequestAccess} />
        <PrivateRoute exact path='/analytics/:courseID/:pane?/:settingsPane?' component={AnalyticsCourseView} />
        <PrivateRoute exact path='/account/:activePane?' component={AccountSettings} />
        <PrivateRoute exact path='/controlpanel' component={ControlPanel} />
        <PrivateRoute exact path='/controlpanel/adoptionreports' component={AdoptionReports} />
        <PrivateRoute exact path='/controlpanel/analyticsrequests' component={AnalyticsRequests} />
        {/*<PrivateRoute exact path='/controlpanel/assettagsmanager' component={AssetTagsManager} />*/}
        <PrivateRoute exact path='/controlpanel/booksmanager' component={BooksManager} />
        <PrivateRoute exact path='/controlpanel/campussettings' component={CampusSettings} />
        <PrivateRoute exact path='/controlpanel/collectionsmanager' component={CollectionsManager} />
        <PrivateRoute exact path='/controlpanel/eventsmanager' component={EventsManager} />
        <PrivateRoute exact path='/controlpanel/eventsmanager/:mode/:eventID?' component={ManageEvent} />
        <PrivateRoute exact path='/controlpanel/harvestingrequests' component={HarvestingRequests} />
        <PrivateRoute exact path='/controlpanel/homeworkmanager' component={HomeworkManager} />
        <PrivateRoute exact path='/controlpanel/libreone' component={CentralIdentity} />
        <PrivateRoute exact path='/controlpanel/libreone/instructor-verifications' component={CentralIdentityInstructorVerifications} />
        <PrivateRoute exact path='/controlpanel/libreone/orgs' component={CentralIdentityOrgs} />
        <PrivateRoute exact path='/controlpanel/libreone/services' component={CentralIdentityServices} />
        <PrivateRoute exact path='/controlpanel/libreone/users' component={CentralIdentityUsers} />
        <PrivateRoute exact path='/controlpanel/orgsmanager' component={OrganizationsManager} />
        <PrivateRoute exact path='/controlpanel/peerreviewrubrics' component={PeerReviewRubrics} />
        <PrivateRoute exact path='/controlpanel/peerreviewrubrics/:mode/:rubricID?' component={PeerReviewRubricManage} />
        <PrivateRoute exact path='/controlpanel/usersmanager' component={UsersManager} />
        <PrivateRoute exact path='/controlpanel/usersmanager/:uuid' component={UserDetails} />
        <PrivateRoute exact path='/events/:eventID/:status?' component={EventRegistration} unAuthSrc="eventregistration" />
        {(org.orgID === 'libretexts') && [
          <Route exact path='/harvestrequest' key='harvestrequest' component={HarvestRequest} />,
          <Route exact path='/kb' key='kb' component={KnowledgeBase} />,
          <Route exact path='/kb/page/edit/:id' key='kbpage' component={KBEditPage} />
        ]}
        <Route exact path='/peerreview/:id' component={PeerReviewPage} />

        {/* 404 */}
        <Route component={PageNotFound} />
        </Switch>
      </Suspense>
    </div>
  )
};

export default Conductor;
