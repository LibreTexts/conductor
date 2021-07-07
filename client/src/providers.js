import React, {useContext, useReducer} from "react";

// Contexts
export const UserContext = React.createContext();

// Providers
export const UserProvider = ({reducer, initialState, children}) => (
    <UserContext.Provider value={useReducer(reducer, initialState)}>
        {children}
    </UserContext.Provider>
);

export const useUserState = () => useContext(UserContext);
