import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { Provider } from "react-redux";
import axios from "axios";
import store from "./state/store.ts";
import AuthHelper from "./components/util/AuthHelper";
import Commons from "./Commons";
import Conductor from "./Conductor";
import Standalone from "./Standalone";
import ErrorModal from "./components/error/ErrorModal";
import withOrgStateDependency from "./enhancers/withOrgStateDependency";
import "./styles/global.css";
import { ErrorBoundary } from "react-error-boundary";
import ErrorScreen from "./screens/ErrorScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

/**
 * Exposes the applications and global configuration.
 */
const Platform = () => {
  /* Configure global Axios defaults */
  axios.defaults.baseURL =
    import.meta.env.MODE === "development"
      ? `${import.meta.env.VITE_DEV_BASE_URL}/api/v1`
      : "/api/v1";
  axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
  axios.defaults.headers.post["Content-Type"] = "application/json";
  axios.defaults.withCredentials = true;
  axios.interceptors.response.use(
    (res) => {
      return res;
    },
    (err) => {
      if (
        err.response?.status === 401 &&
        err.response?.data?.tokenExpired === true
      ) {
        AuthHelper.logout(true, window.location);
      }
      return Promise.reject(err);
    }
  );
  /* Set up render trees */
  const commonsPaths = [
    "/",
    "/catalog",
    "/collections",
    "/collection/:id",
    "/book/:id",
    "/homework",
    "/underdevelopment",
    "/libraries",
    "/search-results",
  ];
  const standalonePaths = [
    "/adopt",
    "/accessibility",
    "/translationfeedbackexport",
    "/oauthconsent",
  ];
  const ApplicationTree = () => {
    return (
      <ErrorBoundary FallbackComponent={ErrorScreen}>
        <div className="App">
          <Switch>
            {/* Commons Render Tree */}
            <Route exact path={commonsPaths} component={Commons} />
            {/* Standalone Pages */}
            <Route exact path={standalonePaths} component={Standalone} />
            {/* Conductor and fallback Render Tree */}
            <Route component={Conductor} />
          </Switch>
          <ErrorModal />
        </div>
      </ErrorBoundary>
    );
  };
  /* Require Organization info globally */
  const Application = withOrgStateDependency(ApplicationTree);

  const queryClient = new QueryClient();

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <Application />
        </Provider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default Platform;
