# Requirements Document

## Introduction

This feature involves converting the LibreOne App Licenses page from Semantic UI components to Davis React components. The page displays app license information in a table format and includes a "Bulk Generate Access Codes" button that opens a modal. All UI components must be converted to use Davis React instead of Semantic UI while maintaining the same functionality.

## Requirements

### Requirement 1

**User Story:** As an admin user, I want to view app licenses information in a clean, modern interface so that I can manage licenses effectively.

#### Acceptance Criteria

1. WHEN the app licenses page loads THEN the system SHALL display a page header using Davis React Heading component
2. WHEN the page loads THEN the system SHALL display a breadcrumb navigation using Davis React Breadcrumb component  
3. WHEN the page loads THEN the system SHALL display app licenses data in a Davis React DataTable component
4. WHEN the page loads THEN the system SHALL NOT use any Semantic UI components

### Requirement 2

**User Story:** As an admin user, I want to bulk generate access codes through a modern modal interface so that I can efficiently create multiple access codes.

#### Acceptance Criteria

1. WHEN the user clicks "Bulk Generate Access Codes" button THEN the system SHALL open a Davis React Modal component
2. WHEN the modal opens THEN the system SHALL display app license selection using Davis React Select component
3. WHEN the modal opens THEN the system SHALL display quantity input using Davis React Input component
4. WHEN the user submits the form THEN the system SHALL generate and download access codes as CSV
5. WHEN the modal is displayed THEN the system SHALL NOT use any Semantic UI components

### Requirement 3

**User Story:** As an admin user, I want the table to display all relevant app license information so that I can understand license details at a glance.

#### Acceptance Criteria

1. WHEN the table loads THEN the system SHALL display ID, Name, Stripe ID, Perpetual, Trial, Is Academy License, Academy Level, and Duration columns
2. WHEN the table loads THEN the system SHALL format boolean values as "Yes"/"No" text
3. WHEN the table loads THEN the system SHALL display "N/A" for null academy levels
4. WHEN the table loads THEN the system SHALL format academy levels using the getPrettyAcademyOnlineAccessLevel helper
5. WHEN the table displays THEN the system SHALL maintain the same data structure and formatting as the current implementation