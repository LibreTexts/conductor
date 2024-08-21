import React, { useEffect } from "react";
import { Routes, CompatRoute, CompatRouter } from "react-router-dom-v5-compat";
import { Provider } from "react-redux";
import axios from "axios";
import store from "./state/store.js";
import AuthHelper from "./components/util/AuthHelper.js";
import Commons from "./Commons.js";
import Conductor from "./Conductor.jsx";
import Standalone from "./Standalone.jsx";
import ErrorModal from "./components/error/ErrorModal.js";
import withOrgStateDependency from "./enhancers/withOrgStateDependency.jsx";
import "./styles/global.css";
import { ErrorBoundary } from "react-error-boundary";
import ErrorScreen from "./screens/ErrorScreen.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import ModalsProvider from "./providers/ModalsProvider.js";
import NotificationsProvider from "./providers/NotificationsProvider.js";
import { BrowserRouter, Route, Switch } from "react-router-dom";

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
    "/collections/:path",
    "/collections/:path*",
    "/commons-project/:id",
    "/author/:id",
    "/book/:id",
    "/homework",
    "/underdevelopment",
    "/libraries",
    "/search-results",
    "/file/:projectID/:fileID",
  ];
  const standalonePaths = [
    "/adopt",
    "/accessibility",
    "/translationfeedbackexport",
    "/oauthconsent",
  ];

  useEffect(() => {
    if (window && document) {
      const script = document.createElement("script");
      const body = document.getElementsByTagName("body")[0];
      script.src =
        "https://cdn.libretexts.net/libretexts-support-widget.min.js";
      body.appendChild(script);
    }
  }, []);

  const ApplicationTree = () => {
    return (
      <ErrorBoundary FallbackComponent={ErrorScreen}>
        <div className="App">
          <NotificationsProvider>
            <ModalsProvider>
              <Switch>
                {/* Commons Render Tree */}
                {/* @ts-expect-error */}
                <Route exact path={commonsPaths} component={Commons} />
                {/* Standalone Pages */}
                <Route exact path={standalonePaths} component={Standalone} />
                {/* Conductor and fallback Render Tree */}
                <Route component={Conductor} />
              </Switch>
            </ModalsProvider>
          </NotificationsProvider>
          <ErrorModal />
        </div>
      </ErrorBoundary>
    );
  };
  /* Require Organization info globally */
  // @ts-expect-error
  const Application = withOrgStateDependency(ApplicationTree);

  const queryClient = new QueryClient();

  return (
    <BrowserRouter>
      <CompatRouter>
        <QueryClientProvider client={queryClient}>
          <Provider store={store}>
            {/* @ts-expect-error */}
            <Application />
          </Provider>
          <ReactQueryDevtools initialIsOpen={false} />
          <div id="support-widget-container" className="support-widget" />
        </QueryClientProvider>
      </CompatRouter>
    </BrowserRouter>
  );
};

export default Platform;
