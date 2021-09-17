# Changelog

## 09-16-2021
#### :art: UI/UX
* Updated Axios to v0.21.2 to remediate security vulnerabilities
* Enabled the Maintenance in Progress page (branch `gh-pages`)
* Finished implementing the Manage Collaborators interface in Project View
* Finished implementing Complete Project interface in Project View
* Implemented project deletion flow
* Designed the Project Discussion area
* Started designing Project Tasks

#### :satellite: Server
* Updated Mongoose to v6.0.6 to remediate security vulnerabilities
    * Updated some backend functions to account for breaking changes
* Finished implementing backend logic for Project Collaborators management
* Added the ability to delete a project
* Added ability to mark a project complete
* Implemented the Added as Collaborator notification email

## 09-15-2021
#### :art: UI/UX
* Finished implementing the Create Project interface
* Started implementing the Project View interface

#### :satellite: Server
* Added several backend methods for Project and Tag management
* Updated the Project and Tag models


## 09-14-2021
#### :art: UI/UX
* Created the Adoption Report standalone page
* Updated the Adoption Reports Dashboard to handle standalone submissions
* Finished implementing Campus Settings in Control Panel
* Implemented Organizations Manager in Control Panel
* Added a branded Maintenance in Progress page
* More work on the Create Project interface

#### :satellite: Server
* Updated backend logic to support standalone Adoption Reports
* Update to Campus Catalog management logic
* Added the Tag model for Projects

## 09-13-2021
#### :art: UI/UX
* Added the Publisher filter to Commons Catalog
* Fixed a bug when using URL params to directly view search results
* Added the ability to delete a collection in Collections Manager
* Implemented ability to manage user roles in Users Manager
* Started implementing Campus Settings in Control Panel

#### :satellite: Server
* Added the ability to filter by Publisher/Program
* Improved Catalog search result accuracy for Campus Commons
* Updated backend logic to manage user roles
* Added backend logic to update Organization info


## 09-12-2021
#### :art: UI/UX
* Fixed an issue causing infinite loops when the user's authorization token has expired
* Finished implementing SSO for LibreCommons
* Implemented campus branding in Commons Catalog
* Updated language in OER Integration Request & Harvesting Requests dashboard

#### :satellite: Server
* Finished implementing SSO for LibreCommons

## 09-10-2021
#### :art: UI/UX
* Itemized Mode in Commons Collection View now matches Catalog styling
* Finished implementing Table of Contents in Book View
* Fixed a bug in setting the page title in Commons
* Updated the Account Settings UI (including Roles list)
* Added the ability to change user's name in Account Settings
* Added the ability to update user's email in Account Settings
* Implemented the Password Change flow in Account Settings
* Updates to the Commons Footer for both Libre- and Campus Commons
* Started implementing the Users Manager

#### :satellite: Server
* Implemented backend logic to update non-SSO user name
* Implemented backend logic to update non-SSO user email
* Implemented backend logic to update non-SSO user password
* Added a Password Change Notification email
* Started implementing backend logic for User management

## 09-09-2021
#### :art: UI/UX
* Implemented Summary in Book View
* Fixed missing information between desktop & mobile Book View
* Implemented an early version of Table of Contents in Book View

#### :satellite: Server
* Implemented Book Summary retrieval
* Early draft of SSO authentication
* Implemented Book TOC retrieval

## 09-08-2021
#### :art: UI/UX
* Implemented Reset Password functionality
* Set Libraries icons to have a fixed aspect ratio
* Updated all Libraries icons to higher-resolution versions
* Started work to connect to MindTouch API for Book Summary and TOC

#### :satellite: Server
* Renamed methods & routes for Libraries (previously Directory)
* Implemented Reset Password (via email) functionality
* Connected to the Mailgun API
* Introduced the Welcome to Conductor email for new users
* More investigation into SSO auth

## 09-07-2021
#### :art: UI/UX
* Introduced Directory to Commons
* Implemented static URLs for Commons Collections
* Moved "About LibreTexts" and "Login to Conductor" to Commons Navbar
* Increased the font-size of Commons Navbar and Menu items
* Implemented the Registration authentication flow

#### :satellite: Server
* Introduced backend logic for Directory
* Implemented static URLs for Commons Collections
* Implemented backend logic for Registration
* Started backend work for SSO authentication

## 09-06-2021
#### :satellite: Server
* Updated the CSP to allow gtag.js and the ANDI tool

## 09-03-2021
#### :art: UI/UX
* Upgrades to Commons Pagination UI
* Upgrades to the Commons Catalog Itemized Mode
* Implemented Collection View in Commons
* Modified Homework to retrieve results from the Conductor database
* Added Homework Manager and sync abilities in Conductor
* Started work on User Registration
* Added Google Analytics (may need further review)

#### :satellite: Server
* Improved Books import algorithm
* Added the Homework model
* Added backend logic to sync ADAPT Commons with Conductor
* Introduced auto-generated Collections
* Renamed authentication cookies to prevent conflicts with other LibreTexts cookies

## 09-02-2021
#### :art: UI/UX
* Upgrades to the Commons Catalog UI
* Folded the desktop and mobile Commons Catalog UI into one to reduce code complexity and duplication
* "ADAPT" is now "Homework" in preparation for LibreStudio connection
* Added the Central/Campus Bookshelves or Learning Objects filter
* Fixed a default Commons jumbotron image issue
* Reduced Commons jumbotron size and Campus Commons logo size
* Added the "Clear" search button
* Added Organization data retrieval in Conductor to prevent missing information
* Finished integrating Collections Manager
    * Ability to change Privacy
    * Ability to remove Books/Resources in a Collection
* More work on Books Manager
    * Ability to add/remove non-campus Books to/from Campus Commons

#### :satellite: Server
* Upgraded backend logic to provide filter lists for Campus Commons
* Added the location field to Book model to clarify Commons Organization
* Added backend logic to support Custom Catalog entries for Campus Commons
* Upgraded backend logic to retrieve Catalog results for Campus Commons (in progress)

## 09-01-2021
#### :art: UI/UX
* Book "Institution" is now referred to as "Affiliation"
* UI updates in Control Panel
* UI updates in Commons Catalog
* Commons Catalog results now appear only after a search has been performed
* Commons Catalog no longer updates immediately on filter change
* Switched to local store in Catalog to improve performance & reduce complexity
* Started improving Campus Commons branding

#### :satellite: Server
* Book "Institution" is now referred to as "Affiliation"
* Added an early version of Campus Commons catalog(s)
* Removed some deprecated User functions and API endpoints

## 08-31-2021
#### :art: UI/UX
* Changed Filters layout in the Commons Catalog to support new filters
* Enabled text-search through filters with a large amount of options
* Removed client-side filtering & sorting
* Implemented retrieval of Catalog filters from the server instead of client-side generation
* Added ability to add Book to Collection in Books Manager
* Implemented Control Panel
    * Updated Navbar
* Added Commons link to Navbar dropdown
* Changed Books Manager to use server-side filtering and sorting

#### :satellite: Server
* Improved algorithms used to extract Book information from the LibreTexts API
* Added the Course/Campus field in Book information
* Added text indices on main Book fields for classic text-search
* Implemented Catalog filtering & sorting on the server-side to improve client performance
* Implemented Catalog filter generation (author, institution, etc.) on the server-side
* New backend logic to add or remove resources from Collections

## 08-30-2021
#### :art: UI/UX
* Increased the number of Commons items per row to 6
* More work on Books Manager
* Added the Collections Manager
* Started implementing Collection View in Commons

#### :satellite: Server
* Updated the Book ID regex to fix K12 library bug
* Prevent startup if necessary settings are missing
* Updates to the Collection model
* Added more backend logic for Collections management & access

## 08-27-2021
#### :art: UI/UX
* Implemented dynamic Commons Catalog
* Updates to the filter and sort process in Catalog
* Added manual sync tool in Books Manager
* Small UI improvements in Commons Catalog
* Several updates to helper functions
* Started implementing functionality in Books Manager

#### :satellite: Server
* Updates to the Book model
* Created backend logic to sync Commons with Libraries
* Backend logic to retrieve the main Commons catalog
* Backend logic to retrieve book details

## 08-25-2021
#### :art: UI/UX
* Preliminary work for dynamic Commons catalog
* Introduced the Books Manager

#### :satellite: Server
* Preliminary work for SSO authentication
* Created the Collection model
* Introduced backend logic and validation for Collections actions
* Created the Book model
* Started designing backend logic for dynamic Commons books
* Added Delete Adoption Report API call

## 08-24-2021
#### :art: UI/UX
* Implemented filters in URL parameters and Redux store to improve inter-page persistence and link shareability
* Connected the global error handling mechanism to the global store and removed the extra ErrorProvider
* General component cleanup and documentation
* Small UI improvements in Commons
* Started implementing the new Create Project form

## 08-23-2021
#### :art: UI/UX
* Improved the global error handling mechanism to avoid duplicate code
* Introduced the Harvesting Requests dashboard & Harvesting Request View modal
* Updated the React application to use a standard React-Redux setup
    * Introduced split reducers for different state sections
* Added more loading indicators in the Commons UI
* Started integrating filters with Redux store for inter-page persistence

#### :satellite: Server
* Fixed an issue with handling incorrect Login details
* Restricted viewing of Adoption Reports to SuperAdmins
* New backend logic to retrieve submitted OER/Harvesting Requests
* New fields in the Project model for the new upcoming design

#### :memo: Documentation
* Updated platform name in README.md & package.json(s)
* **Renamed the Github repository**

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
