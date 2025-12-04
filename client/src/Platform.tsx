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
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import ModalsProvider from "./providers/ModalsProvider.js";
import NotificationsProvider from "./providers/NotificationsProvider.js";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { useNotifications } from "./context/NotificationContext.js";

const notificationRef: { current: ((n: any) => void) | null } = {
  current: null,
};
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      const errMsg =
        query?.meta && "errorMessage" in query.meta
          ? (query.meta.errorMessage as string)
          : "An error occurred";

      // Use a ref here since we can't use hooks outside of the component tree
      notificationRef.current?.({
        type: "error",
        message: errMsg,
      });
    },
  }),
});

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

  const commonsPaths = [
    "/",
    "/catalog",
    "/collections",
    "/commons-project",
    "/author",
    "/book",
    "/homework",
    "/libraries",
    "/search-results",
    "/file",
  ];

  axios.interceptors.response.use(
    (res) => {
      return res;
    },
    (err) => {
      if (
        err.response?.status === 401 &&
        (err.response?.data?.tokenExpired === true ||
          err.response?.data?.sessionInvalid === true)
      ) {
        const silent = commonsPaths.some((path) =>
          window.location.pathname.startsWith(path)
        );

        AuthHelper.logout(true, window.location, silent);
      }
      return Promise.reject(err);
    }
  );

  const commonsRouterPaths = [
    "/",
    "/catalog",
    "/catalog/:entryType",
    "/collections",
    "/collections/:path",
    "/collections/:path*",
    "/commons-project/:id",
    "/author/:id",
    "/book/:id",
    "/homework",
    "/libraries",
    "/search-results",
    "/file/:projectID/:fileID",
  ];

  const standalonePaths = [
    "/adopt",
    "/accessibility",
    "/translationfeedbackexport",
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
    const { addNotification } = useNotifications();

    // Keep the ref updated with the latest addNotification function
    useEffect(() => {
      notificationRef.current = addNotification;
      return () => {
        notificationRef.current = null;
      };
    }, [addNotification]);

    return (
      <ErrorBoundary FallbackComponent={ErrorScreen}>
        <QueryClientProvider client={queryClient}>
          <div className="App">
            <ModalsProvider>
              <Switch>
                {/* Commons Render Tree */}
                {/* @ts-expect-error */}
                <Route exact path={commonsRouterPaths} component={Commons} />
                {/* Standalone Pages */}
                <Route exact path={standalonePaths} component={Standalone} />
                {/* Conductor and fallback Render Tree */}
                <Route component={Conductor} />
              </Switch>
            </ModalsProvider>
            <ErrorModal />
            <ReactQueryDevtools initialIsOpen={false} />
          </div>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  };
  /* Require Organization info globally */
  // @ts-expect-error
  const Application = withOrgStateDependency(ApplicationTree);

  return (
    <BrowserRouter>
      <CompatRouter>
        <NotificationsProvider>
          <Provider store={store}>
            {/* @ts-expect-error */}
            <Application />
          </Provider>
          <div id="support-widget-container" className="support-widget" />
        </NotificationsProvider>
      </CompatRouter>
    </BrowserRouter>
  );
};

export default Platform;
