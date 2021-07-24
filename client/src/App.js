import './App.css';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import React from 'react';
import axios from 'axios';

import { UserProvider } from './providers.js';
import { userInitialState, userReducer } from './reducers.js';
import AccountSettings from './components/auth/AccountSettings.js';
import Dashboard from './components/dashboard/Dashboard.js';
import ProjectsPortal from './components/projects/ProjectsPortal.js';


import Login from './components/auth/Login.js';
import Navbar from './components/navigation/Navbar.js';
import Search from './components/search/Search.js';
import SupervisorDashboard from './components/supervisor/SupervisorDashboard.js';

import HarvestRequest from './components/harvestrequest/HarvestRequest.js';



import HarvestingCompletedProjects from './components/harvesting/HarvestingCompletedProjects.js';
import HarvestingPortal from './components/harvesting/HarvestingPortal.js';
import HarvestingProjectAddExisting from './components/harvesting/HarvestingProjectAddExisting.js';
import HarvestingProjectDetail from './components/harvesting/HarvestingProjectDetail.js';
import HarvestingProjectEdit from './components/harvesting/HarvestingProjectEdit.js';
import HarvestingTargetAdd from './components/harvesting/targetlist/HarvestingTargetAdd.js';
import HarvestingTargetDetail from './components/harvesting/targetlist/HarvestingTargetDetail.js';
import HarvestingTargetEdit from './components/harvesting/targetlist/HarvestingTargetEdit.js';
import HarvestingTargetlist from './components/harvesting/targetlist/HarvestingTargetlist.js';


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

    return (
        <BrowserRouter>
          <div className='App'>
            <UserProvider initialState={userInitialState} reducer={userReducer}>
                <Navbar />
                <Switch>
                    <AnonRoute exact path = '/login' component={Login}/>
                    <Route exact path = '/harvestrequest' component={HarvestRequest} />
                    <PrivateRoute exact path = '/' component={Dashboard} />
                    <PrivateRoute exact path = '/search' component={Search} />
                    <PrivateRoute exact path = '/projects' component={ProjectsPortal} />

                    <PrivateRoute exact path = '/harvesting' component={HarvestingPortal} />
                        <PrivateRoute exact path = '/harvesting/projects/addexisting' component={HarvestingProjectAddExisting} />
                        <PrivateRoute exact path = '/harvesting/projects/completed' component={HarvestingCompletedProjects} />
                        <PrivateRoute exact path = '/harvesting/projects/:id/edit' component={HarvestingProjectEdit} />
                        <PrivateRoute path = '/harvesting/projects/:id' component={HarvestingProjectDetail} />
                        <PrivateRoute exact path = '/harvesting/targetlist' component={HarvestingTargetlist} />
                        <PrivateRoute exact path = '/harvesting/targetlist/add' component={HarvestingTargetAdd} />
                        <PrivateRoute exact path = '/harvesting/targetlist/:id/edit' component={HarvestingTargetEdit} />
                        <PrivateRoute path = '/harvesting/targetlist/:id' component={HarvestingTargetDetail} />
                    <PrivateRoute exact path = '/account/settings' component={AccountSettings} />
                    <PrivateRoute exact path = '/supervisors' component={SupervisorDashboard} />
                </Switch>
            </UserProvider>
          </div>
        </BrowserRouter>
    );
};

export default App;
