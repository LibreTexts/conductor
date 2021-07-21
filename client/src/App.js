import './App.css';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import React from 'react';
import axios from 'axios';

import { UserProvider } from './providers.js';
import { userInitialState, userReducer } from './reducers.js';
import AccountSettings from './components/auth/AccountSettings.js';
import AdminCompletedProjects from './components/administration/AdminCompletedProjects.js';
import AdminProjectAddExisting from './components/administration/AdminProjectAddExisting.js';
import AdminProjectDetail from './components/administration/AdminProjectDetail.js';
import AdminProjectEdit from './components/administration/AdminProjectEdit.js';
import AdminTaskAdd from './components/administration/taskqueue/AdminTaskAdd.js';
import AdminTaskDetail from './components/administration/taskqueue/AdminTaskDetail.js';
import AdminTaskEdit from './components/administration/taskqueue/AdminTaskEdit.js';
import AdminTaskQueue from './components/administration/taskqueue/AdminTaskQueue.js';
import AdministrationPortal from './components/administration/AdministrationPortal.js';
import Dashboard from './components/dashboard/Dashboard.js';
import DevAIOFeed from './components/development/DevAIOFeed.js';
import DevCompletedProjects from './components/development/DevCompletedProjects.js';
import DevProjectAddExisting from './components/development/DevProjectAddExisting.js';
import DevProjectDetail from './components/development/DevProjectDetail.js';
import DevProjectEdit from './components/development/DevProjectEdit.js';
import DevTaskAdd from './components/development/taskqueue/DevTaskAdd.js';
import DevTaskDetail from './components/development/taskqueue/DevTaskDetail.js';
import DevTaskEdit from './components/development/taskqueue/DevTaskEdit.js';
import DevTaskQueue from './components/development/taskqueue/DevTaskQueue.js';
import DevelopmentPortal from './components/development/DevelopmentPortal.js';
import HarvestingCompletedProjects from './components/harvesting/HarvestingCompletedProjects.js';
import HarvestingPortal from './components/harvesting/HarvestingPortal.js';
import HarvestingProjectAddExisting from './components/harvesting/HarvestingProjectAddExisting.js';
import HarvestingProjectDetail from './components/harvesting/HarvestingProjectDetail.js';
import HarvestingProjectEdit from './components/harvesting/HarvestingProjectEdit.js';
import HarvestingTargetAdd from './components/harvesting/targetlist/HarvestingTargetAdd.js';
import HarvestingTargetDetail from './components/harvesting/targetlist/HarvestingTargetDetail.js';
import HarvestingTargetEdit from './components/harvesting/targetlist/HarvestingTargetEdit.js';
import HarvestingTargetlist from './components/harvesting/targetlist/HarvestingTargetlist.js';
import Login from './components/auth/Login.js';
import Navbar from './components/navigation/Navbar.js';
import Search from './components/search/Search.js';
import SupervisorDashboard from './components/supervisor/SupervisorDashboard.js';

import HarvestRequest from './components/harvestrequest/HarvestRequest.js';

import AnonRoute from './components/util/AnonRoute.js';
import PrivateRoute from './components/util/PrivateRoute.js';

function App() {
    axios.defaults.baseURL = '/api/v1';
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    axios.defaults.headers.withCredentials = true;
    axios.defaults.headers.post['Content-Type'] = 'application/json';
    axios.interceptors.response.use((res) => {
        return res;
    }, (err) => {
        if (err.response !== undefined) {
            if (err.response.status === 401 && err.response.data.tokenExpired === true) {
                window.location.assign('/login?src=tokenexp')
            }
        }
        return Promise.reject(err);
    });

    console.log(process.env);

    return (
        <BrowserRouter>
          <div className='App'>
            <UserProvider initialState={userInitialState} reducer={userReducer}>
                <Switch>
                    <AnonRoute exact path = '/login' component={Login}/>
                    <Route exact path = '/harvestrequest' component={HarvestRequest} />
                    <div>
                        <Navbar />
                        <PrivateRoute exact path = '/' component={Dashboard} />
                        <PrivateRoute exact path = '/search' component={Search} />
                        <PrivateRoute exact path = '/harvesting' component={HarvestingPortal} />
                            <PrivateRoute exact path = '/harvesting/projects/addexisting' component={HarvestingProjectAddExisting} />
                            <PrivateRoute exact path = '/harvesting/projects/completed' component={HarvestingCompletedProjects} />
                            <PrivateRoute exact path = '/harvesting/projects/:id/edit' component={HarvestingProjectEdit} />
                            <PrivateRoute path = '/harvesting/projects/:id' component={HarvestingProjectDetail} />
                            <PrivateRoute exact path = '/harvesting/targetlist' component={HarvestingTargetlist} />
                            <PrivateRoute exact path = '/harvesting/targetlist/add' component={HarvestingTargetAdd} />
                            <PrivateRoute exact path = '/harvesting/targetlist/:id/edit' component={HarvestingTargetEdit} />
                            <PrivateRoute path = '/harvesting/targetlist/:id' component={HarvestingTargetDetail} />
                        <PrivateRoute exact path = '/development' component={DevelopmentPortal} />
                            <PrivateRoute exact path = '/development/aiofeed' component={DevAIOFeed} />
                            <PrivateRoute exact path = '/development/projects/addexisting' component={DevProjectAddExisting} />
                            <PrivateRoute exact path = '/development/projects/completed' component={DevCompletedProjects} />
                            <PrivateRoute exact path = '/development/projects/:id/edit' component={DevProjectEdit} />
                            <PrivateRoute path = '/development/projects/:id' component={DevProjectDetail} />
                            <PrivateRoute exact path = '/development/taskqueue' component={DevTaskQueue} />
                            <PrivateRoute exact path = '/development/taskqueue/add' component={DevTaskAdd} />
                            <PrivateRoute exact path = '/development/taskqueue/:id/edit' component={DevTaskEdit} />
                            <PrivateRoute path = '/development/taskqueue/:id' component={DevTaskDetail} />
                        <PrivateRoute exact path = '/admin' component={AdministrationPortal} />
                            <PrivateRoute exact path = '/admin/projects/addexisting' component={AdminProjectAddExisting} />
                            <PrivateRoute exact path = '/admin/projects/completed' component={AdminCompletedProjects} />
                            <PrivateRoute exact path = '/admin/projects/:id/edit' component={AdminProjectEdit} />
                            <PrivateRoute path = '/admin/projects/:id' component={AdminProjectDetail} />
                            <PrivateRoute exact path = '/admin/taskqueue' component={AdminTaskQueue} />
                            <PrivateRoute exact path = '/admin/taskqueue/add' component={AdminTaskAdd} />
                            <PrivateRoute exact path = '/admin/taskqueue/:id/edit' component={AdminTaskEdit} />
                            <PrivateRoute path = '/admin/taskqueue/:id' component={AdminTaskDetail} />
                        <PrivateRoute exact path = '/account/settings' component={AccountSettings} />
                        <PrivateRoute exact path = '/supervisors' component={SupervisorDashboard} />
                    </div>
                </Switch>
            </UserProvider>
          </div>
        </BrowserRouter>
    );
};

export default App;
