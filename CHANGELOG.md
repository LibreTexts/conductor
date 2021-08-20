# Changelog

## 08-20-2021
#### :art: UI/UX
* Converted Dashboard to the new functional component design
* Completed the New Announcement modal following new User role(s) implementation
* Updates to the Dashboard and Announcements UIs
* More work on the Adoption Reports dashboard
* Completed the Adoption Report View modal

#### :satellite: Server
* Improved new authentication middleware

## 08-19-2021
**IMPORTANT: As of 08-19-2021, the Conductor development database has diverged from the original development database
due to backwards-incompatible/breaking changes. Data will *NOT* be synced between them automatically.**
#### :art: UI/UX
* Added View Assignments & the Course Information modal in the ADAPT Catalog
* Added new SEO tags (WIP)
* Updated visual form validation in Login
* Added new buttons in Login for Registration & SSO Login

#### :satellite: Server
* Upgraded authentication middleware
* Updated the Announcement model
* Added new validation methods for Announcements
* Upgraded backend logic for Announcements to follow the new modular style and the new User role(s) implementation

## 08-18-2021
#### :art: UI/UX
* More work on the Adoption Reports dashboard

#### :satellite: Server
* More backend logic for Adoption Reports
* Updated validation and CORS logic for Adoption Reports

## 08-11-2021
#### :art: UI/UX
* Completed Adoption Report validation and data handling
* Implemented responsive behavior in Conductor Login

#### :satellite: Server
* Completed backend logic for Adoption Report validation and submission

## 08-10-2021
#### :art: UI/UX
* Completed implementing responsive behavior(s) in the Commons UI and navbar(s)
* More work on Adoption Report validation and data handling

## 08-09-2021
#### :art: UI/UX
* Integrated Visual & Itemized Modes in the Commons Catalogs, Collections, and ADAPT listings
* Implemented a 404 Not Found page
* Started implementing a Commons book thumbnail attribution & license display
* Reconfigured Login & OER Integration Request to use the global error handling mechanism
* Started adding responsive behavior(s) to the Commons interface

#### :satellite: Server
* Updated validation logic for login

## 08-06-2021
#### :art: UI/UX
* Designed the Adoption Report form
* Started Adoption Report data handling

#### :satellite: Server
* Updated the server Content Security Policy
* Resolved several security vulnerabilities in the application framework
* Started integrating a global debugger tool

## 08-05-2021
#### :art: UI/UX
* Introduced the ADAPT Commons Catalog
* Implemented pagination in the Textbook & ADAPT Catalogs
* Added a global error handling mechanism

## 08-03-2021
#### :art: UI/UX
* Implemented the Catalog filters
* More work on Commons multi-tenancy
* Finished Commons demo data
* Started designing Collections

## 08-02-2021
#### :art: UI/UX
* More work on the Commons Book UI
* Preparations for multi-tenancy in Commons
* Setup Commons demo data

#### :satellite: Server
* Middleware updates
* Started defining routes for Organizations API


## 07-30-2021
#### :art: UI/UX
* Started interactivity in the Commons UI
* Started designing the Commons Book UI
* App/Routing reorganization
* Fixes for application rendering quirks

## 07-29-2021
#### :art: UI/UX
* Added Commons Navbar to the Commons UI
* Added Commons Footer to the Commons UI
* More client routing work

## 07-28-2021
#### :art: UI/UX
* More design work on the Commons UI

## 07-27-2021
#### :art: UI/UX
* Started designing the Commons UI
* Debugged application rendering quirks

## 07-23-2021
#### :art: UI/UX
* Started integrating the updated Projects UI
* Added 'Harvesting Request' to the Tools menu

#### :satellite: Server
* Started Organizations paradigm:
  * Defined new Organization model
  * Started writing new backend logic
* Upgraded more authentication logic


## 07-22-2021
#### :satellite: Server
* Started redesigning Projects:
  * Defined new Project model
  * Started writing new backend logic
* Upgraded middleware functions
* Started restructuring API functions to avoid code repetition

## 07-21-2021
#### :art: UI/UX
* Completed the OER Integration Request interface

#### :satellite: Server
* Setup backend logic for OER Integration Requests
* Added a new validation library and helper functions

## 07-20-2021

#### :art: UI/UX
* Started restructuring of the application for new features
* Started designing the OER Integration Request form
* Added the Tools menu to the Navbar
* Internal updates to authentication handling and redirection

## 07-19-2021

#### :art: UI/UX
* Upgrades to the Announcements UI
* Removed the Open button on Project listings
* The Flagged Projects section now only appears above Current Projects when there are unresolved flags

## 07-15-2021

#### :art: UI/UX
* Removed the redundant 'Status' column in the project portals
* Removed the "Recently Completed" section in project portals
* Removed the initial concept disclaimer during Login
* Removed the LibreTexts status monitor
* Started upgrades to the Announcements features

#### :satellite: Server
* Switched to cookie authentication methods

#### :memo: Documentation
* Created the Changelog
