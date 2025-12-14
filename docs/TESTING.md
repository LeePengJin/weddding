# Testing Documentation

This document provides comprehensive testing documentation for Weddding, covering test strategies, test plans, test data, and test cases.

---

## Test Strategies

### Unit Testing

Unit testing is a fundamental testing approach where individual components, functions, and modules are tested in isolation to verify that each unit of code performs correctly according to its specifications. This testing strategy focuses on validating the smallest testable parts of an application independently, without dependencies on external systems or other components. Unit tests typically cover business logic, data processing functions, calculation algorithms, and utility functions, ensuring that each piece of code produces the expected output for given inputs. In the context of Weddding, unit testing is applied to validate core functionality such as authentication services, booking logic, payment calculations, and 3D model processing utilities. By testing each unit independently, developers can quickly identify and fix bugs at the source, ensuring that individual components function correctly before they interact with other parts of the system, which ultimately leads to more stable and maintainable code.

### System Testing

System testing evaluates the complete, integrated system as a whole to ensure that all components work together correctly and that the system meets its functional and non-functional requirements. This testing approach validates end-to-end scenarios that involve multiple modules working in concert, testing complete user workflows from start to finish. System testing focuses on verifying that different system components integrate properly, that data flows correctly across all layers of the application, and that business rules are correctly enforced throughout the entire system. It also encompasses performance testing to ensure the system handles expected loads and maintains acceptable response times, as well as compatibility testing to verify the system works across different browsers and devices. For Weddding, system testing validates complete user journeys involving multiple features working together, ensures proper integration between the frontend, backend, and database layers, and verifies that the system performs adequately under realistic usage conditions. By testing the system as a complete entity, system testing ensures that Weddding delivers a cohesive, reliable experience that meets the needs of all users.

---

## Test Plan

### Testing Techniques

The testing process for Weddding applies a combination of black-box functional testing, scenario-based testing, boundary and validation testing, and negative testing. Black-box functional testing is used to derive test cases directly from requirements and use case diagrams for each module—User Management, Wedding Planning, 3D Venue Design, Budget Management, and Vendor Management—without considering internal implementation details. Scenario-based testing focuses on realistic end-to-end workflows that cut across multiple modules, such as a couple registering, creating a wedding project, designing the venue in 3D, booking vendors, making payments, cancelling bookings, and leaving reviews. Boundary and validation testing concentrate on edge values and constraints for critical fields like dates, times, budgets, prices, quantities, and OTP codes, ensuring that input validation behaves correctly at limits. Negative testing intentionally uses invalid data and disallowed actions, for example wrong OTP codes, attempts to book services without a confirmed venue, invalid budget and expense values, or deleting listings with active bookings, to verify that the system responds with clear error messages and prevents data corruption.

### Test Entry and Exit Criteria

Testing for a given module in Weddding begins only when clear entry criteria are satisfied. From a code perspective, the relevant backend APIs and frontend pages for that module must be implemented, the application must start without critical runtime errors, and the main navigation paths must be usable without crashes. From an environment perspective, database migrations must have been applied successfully and a consistent set of seed or test data must be available, including at least one admin user, couple account, vendor account with listings, and a wedding project with a venue where applicable; required environment variables and upload directories must also be configured. In addition, the test cases for that module must be documented or updated in this Testing document and there must be no open “blocker” or “critical” defects that would make further testing meaningless (for example, being unable to log in or access the relevant pages).

Exit criteria define when testing for a module or iteration can be considered complete. Testing is regarded as finished when all planned test cases for that module have been executed at least once and their actual results (including Pass/Fail status and notes) have been recorded. All blocker and critical defects discovered during testing must be fixed and successfully re-tested, while any remaining medium- or low-priority issues must be documented with agreed workarounds or scheduled for future improvement. Furthermore, key end-to-end scenarios—such as registering and logging in, creating a project, selecting a venue, designing the venue in 3D, booking and paying vendors, updating budgets, cancelling bookings, and reviewing vendors—must complete without failures in the test environment. Finally, there should be no evidence of data corruption or instability, and derived values like booking statuses, 3D design links, budget totals, and cancellation/refund records should remain consistent across the database and user interface.

### Test Environment

All testing activities for Weddding are carried out in a controlled development or test environment that mirrors the intended production stack as closely as possible. The application stack consists of a React-based frontend, running either via the development server (`npm start`) or as a production build served by a web server, and a Node.js/Express backend API connected to a PostgreSQL database through Prisma. The database uses a dedicated development or testing schema that includes seed data for typical entities such as users (admin, couples, vendors), wedding projects, service listings, bookings, venue designs, budgets, and cancellations, so that realistic scenarios can be executed without manually recreating data each time. On the client side, testing is primarily performed on Windows 10 or later laptops/desktops using the latest version of Google Chrome, with additional smoke tests on Microsoft Edge and optionally Firefox to confirm basic browser compatibility; macOS may be used for supplementary checks if needed. Test machines are expected to have at least 8 GB of RAM, a modern multi-core CPU, a minimum screen resolution of 1920×1080 (Full HD) to properly display complex UI screens such as the 3D designer and budget dashboards, and sufficient free storage (at least 10–20 GB) to accommodate local builds, logs, and uploaded 3D model and image files.

Supporting services are also configured for a safe test environment. The email and notification subsystem is run in test mode, where emails are either logged to the console or sent to a controlled test inbox rather than to real end users, allowing verification of content without triggering live notifications. Local file storage for uploads—such as listing images, PDFs, and GLB 3D model files—is configured under the server’s `uploads` directory with sufficient space and appropriate permissions, ensuring that file upload and retrieval flows can be exercised end-to-end. This environment setup allows the team to test functional behaviour, data integrity, and file/notification handling in a way that closely reflects real usage while avoiding unintended side effects, while the hardware assumptions help ensure that performance observations are consistent and realistic.

### Testing Activities

Testing activities for Weddding are organised around both module-level and cross-module validation. At the module level, testers execute the detailed positive and negative test cases defined in this document for each major module (User Management, Wedding Planning, 3D Venue Design, Budget Management, and Vendor Management), recording the actual outcomes, pass/fail status, and any observations or follow-up issues. Beyond isolated modules, integration and end-to-end testing is performed to validate complete user journeys—for example, a couple progressing from registration and login, through project creation and venue selection, into 3D venue design, vendor booking, payment, cancellation handling, and vendor reviews; and a vendor moving from account registration and listing creation, through availability management and booking request handling, to viewing past bookings and payments. During these activities, particular attention is paid to data integrity checks, such as verifying that budgets match their categories and expenses, booking statuses correctly reflect linked 3D elements and project services, and cancellation records correctly capture reasons, fees, and refunds. When defects are discovered and fixed, the directly affected test cases will be re-executed to confirm the fix, but no formal, repeated regression test cycles are planned within the scope of this project.

---

## Test Cases — User Management Module

The following test cases follow the provided template. Each use case has one positive and one negative scenario. Test Data IDs reference the trace table at the end of this section.

### Register Account (Couple) 

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-REG-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Register couple account successfully |
| Description | New couple registration with valid details and OTP |
| Pre-conditions | Email not used; OTP service available |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open registration page and choose couple | Navigate to `/register` | Registration form loads |  |  |  |
| 2 | Enter full name | Name: Jane Doe | Name accepted; inline validation passes |  |  |  |
| 3 | Enter email | Email: jane.new@example.com | Email accepted; no duplicate error |  |  |  |
| 4 | Enter password | Password: SecurePass123! | Password meets policy; field accepts input |  |  |  |
| 5 | Enter confirm password | Confirm: SecurePass123! | Match validation passes |  |  |  |
| 6 | Click “Sign up” | Form data above | OTP request sent; redirected to `/otp`; sessionStorage set (`otpPurpose=register`, `otpEmail`) |  |  |  |
| 7 | On OTP page, enter 6 digits | OTP: 123456 across 6 inputs | Code captured; “Verify” enabled |  |  |  |
| 8 | Click “Verify” | OTP: 123456 | OTP accepted; account created; auth cookie set; redirect to `/` (logged in) |  |  |  |

Post-conditions: Account status active; profile initialized.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-REG-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Registration blocked for duplicate email |
| Description | Prevent registration when email already exists |
| Pre-conditions | Email already registered |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open registration page and choose couple | Navigate to `/register` | Form loads |  |  |  |
| 2 | Enter full name | Name: Jane Doe | Name accepted |  |  |  |
| 3 | Enter duplicate email | Email: jane.existing@example.com | Email accepted initially |  |  |  |
| 4 | Enter password | Password: SecurePass123! | Field accepts input |  |  |  |
| 5 | Enter confirm password | Confirm: SecurePass123! | Field accepts input |  |  |  |
| 6 | Click “Sign up” | Email: jane.existing@example.com | Error shown: email already in use; no OTP sent; stay on page |  |  |  |

Post-conditions: No new account created.

---

### Login

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-LOGIN-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Successful login with valid credentials |
| Description | Authenticate active user |
| Pre-conditions | Account active |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open login page | Navigate to `/login` | Page loads |  |  |  |
| 2 | Enter email | Email: user@example.com | Email accepted |  |  |  |
| 3 | Enter password | Password: ValidPass123! | Password accepted |  |  |  |
| 4 | Click “Log in” | Email/password above | Session cookie set; redirect (couple → `/projects`, vendor → `/vendor/dashboard`) |  |  |  |

Post-conditions: Active session stored.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-LOGIN-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Login rejected with wrong password |
| Description | Ensure authentication fails with invalid password |
| Pre-conditions | Account active |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open login page | Navigate to `/login` | Page loads |  |  |  |
| 2 | Enter email | Email: user@example.com | Email accepted |  |  |  |
| 3 | Enter wrong password | Password: WrongPass123! | Password accepted |  |  |  |
| 4 | Click “Log in” | Email/password above | Error shown; no session created |  |  |  |

Post-conditions: No session created.

---

### Forget/Reset Password

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-RST-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Reset password with valid OTP |
| Description | Recover account via email and OTP |
| Pre-conditions | Account exists; OTP service available |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open “Forget password” page | Navigate to `/forgot-password` | Email input shown |  |  |  |
| 2 | Enter registered email | Email: user@example.com | Email accepted |  |  |  |
| 3 | Click “Submit” | Email above | OTP sent; sessionStorage set (`otpPurpose=reset`, `otpEmail`); redirect to `/otp` |  |  |  |
| 4 | On OTP page, enter 6 digits | OTP: 123456 across 6 inputs | Code captured; “Verify” enabled |  |  |  |
| 5 | Click “Verify” | OTP: 123456 | OTP accepted; sessionStorage stores `otpCode`; redirect to `/reset-password` |  |  |  |
| 6 | On reset page, enter new password | New Password: NewSecurePass123! | Password meets policy |  |  |  |
| 7 | Re-enter password | Confirm: NewSecurePass123! | Match validation passes |  |  |  |
| 8 | Click “Set Password” | New/confirm above | Password updated; success message; redirect to `/login` |  |  |  |

Post-conditions: Password changed; previous password invalid.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-RST-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Reset password blocked with invalid/expired OTP |
| Description | Ensure recovery fails with bad OTP |
| Pre-conditions | Account exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open “Forget password” page | Navigate to `/forgot-password` | Email input shown |  |  |  |
| 2 | Enter registered email | Email: user@example.com | Email accepted |  |  |  |
| 3 | Click “Submit” | Email above | OTP sent; redirected to `/otp` |  |  |  |
| 4 | Enter invalid/expired OTP | OTP: 000000 | Error shown; reset blocked; remain on `/otp` |  |  |  |

Post-conditions: Password unchanged.

---

### Logout

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-LOGOUT-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | User Management |
| Test Title | Successful logout |
| Description | End active session |
| Pre-conditions | User logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Click logout | Logged-in session for user@example.com | Session cleared; redirected to login |  |  |  |
| 2 | Attempt to access protected page | Logged-in session for user@example.com | Redirected to login |  |  |  |

Post-conditions: No active session.

---

### View Profile Details

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-VIEW-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | User Management |
| Test Title | View own profile |
| Description | Authenticated user views profile |
| Pre-conditions | User logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Navigate to profile page | Logged-in session for user@example.com | Profile details displayed (name, email, phone, photo) |  |  |  |

Post-conditions: None.

---

### Edit Profile Details

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-EDIT-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | User Management |
| Test Title | Update profile with valid data |
| Description | Save valid profile changes |
| Pre-conditions | User logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open profile page | Navigate to `/profile` while logged in | Form shows current data |  |  |  |
| 2 | Edit name field | Jane D. Doe | Name validation passes |  |  |  |
| 3 | Edit contact number field | +1-555-0100 | Contact validation passes |  |  |  |
| 4 | Upload new profile photo (optional) | profile.jpg (<=5MB image) | Preview shows new image; validation passes |  |  |  |
| 5 | Click “Save” and confirm update | Data above | Changes saved; success message; page reflects updates |  |  |  |

Post-conditions: Profile updated.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-EDIT-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | User Management |
| Test Title | Reject invalid phone format |
| Description | Validation for bad phone number |
| Pre-conditions | User logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open edit profile | Logged-in session for user@example.com | Form shows current data |  |  |  |
| 2 | Enter invalid phone and submit | Phone: abc123 | Validation error; no changes saved |  |  |  |

Post-conditions: Profile unchanged.

---

### Register Business Account (Vendor)

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-REGV-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Register vendor with business info |
| Description | Vendor registration including business details |
| Pre-conditions | Email not used |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open vendor registration page | Navigate to `/vendor/register` | Vendor form loads |  |  |  |
| 2 | Enter business name | Floral Dreams | Field accepts input |  |  |  |
| 3 | Enter email | vendor.new@example.com | Field accepts input |  |  |  |
| 4 | Enter password | VendorPass123! | Meets policy |  |  |  |
| 5 | Enter confirm password | VendorPass123! | Match validation passes |  |  |  |
| 6 | Enter contact number | 012-3456789 | Passes Malaysia contact validation |  |  |  |
| 7 | Select business type | Florist | Selection accepted |  |  |  |
| 8 | Enter location | Kuala Lumpur | Field accepts input |  |  |  |
| 9 | Upload verification documents | business_license.pdf | At least one file attached (<=5) |  |  |  |
| 10 | Click “Request Account Creation” | Data above | OTP request sent; sessionStorage set (`otpPurpose=register_vendor`, `otpEmail`); redirect to `/otp` |  |  |  |
| 11 | On OTP page, enter 6 digits | OTP: 123456 | Code captured; “Verify” enabled |  |  |  |
| 12 | Click “Verify” | OTP: 123456 | OTP accepted; vendor submitted; status `pending_verification`; message shown |  |  |  |

Post-conditions: Vendor pending verification.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-REGV-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | User Management |
| Test Title | Vendor registration blocked when required fields missing |
| Description | Ensure missing fields prevent submission |
| Pre-conditions | Email not used |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open vendor registration page | Navigate to `/vendor/register` | Form loads |  |  |  |
| 2 | Leave required fields empty | Business: _empty_; Email: vendor.incomplete@example.com; Password: _empty_; Contact: _empty_; Business Type: _empty_; Location: _empty_; Docs: _none_ | Required-field errors shown inline |  |  |  |
| 3 | Click “Request Account Creation” | Empty/missing fields | Validation errors; request blocked; no OTP sent |  |  |  |

Post-conditions: No vendor account created.

---

### Verify Account Creation (Admin)

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-VERIFY-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | User Management |
| Test Title | Admin verifies pending vendor account |
| Description | Approve vendor after review |
| Pre-conditions | Admin logged in; pending vendor exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Admin opens vendor approval list | Admin: admin@example.com / AdminPass123! | Pending vendor visible |  |  |  |
| 2 | Approve pending vendor | Vendor: vendor.pending@example.com | Vendor status set to active; notification sent |  |  |  |

Post-conditions: Vendor active.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | UM-VERIFY-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | User Management |
| Test Title | Non-admin cannot verify account |
| Description | Enforce role-based access on verification |
| Pre-conditions | Non-admin session |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Non-admin navigates to verification URL | Email: user@example.com; Password: ValidPass123! | Access denied (403 or redirect to login) |  |  |  |

Post-conditions: No status change.

---

## Test Cases — Wedding Planning Module

The following test cases align with current frontend routes (`/projects`, `/create-project`, `/project-dashboard`, `/venue-designer`, `/checklist`) and backend validations.

### Create a Wedding Project

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-PRJ-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Wedding Planning |
| Test Title | Create project with date/time, venue, type, and name |
| Description | Full project creation wizard succeeds |
| Pre-conditions | User logged in (couple) |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open projects list | Navigate to `/projects` | Page loads; “Create new wedding project” card visible |  |  |  |
| 2 | Start creation wizard | Click “Create new wedding project” → `/create-project` | Wizard step 1 shown |  |  |  |
| 3 | Select wedding date | Date: 2025-09-20 | Date accepted |  |  |  |
| 4 | Select start time | Start: 10:00 | Time accepted; within 8:00–23:00 |  |  |  |
| 5 | Select end time | End: 18:00 | End after start; within 8:00–23:00 |  |  |  |
| 6 | Click Next (to step 2) | — | Proceeds to venue selection |  |  |  |
| 7 | Select venue listing | Choose venue card (e.g., “Grand Hall”) | Venue stored (venueServiceListingId set) |  |  |  |
| 8 | Click Next (to step 3) | — | Proceeds to wedding type |  |  |  |
| 9 | Choose wedding type | self_organized | Type stored |  |  |  |
| 10 | Click Next (to step 4) | — | Proceeds to project name |  |  |  |
| 11 | Enter project name | “Autumn Celebration” | Name ≥ 3 chars accepted |  |  |  |
| 12 | (Optional) Enter budget | 50000 | Parsed as number |  |  |  |
| 13 | Click Next (to step 5 summary) | — | Summary shows date/time/venue/type/name/budget |  |  |  |
| 14 | Confirm create project | Click “Confirm/Create” | Project POST succeeds; redirect to `/projects` |  |  |  |

Post-conditions: Project appears in `/projects` list; times saved; status draft/ready.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-PRJ-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | Wedding Planning |
| Test Title | Block creation with missing/invalid date/time |
| Description | Wizard stops when date/time invalid or missing |
| Pre-conditions | User logged in (couple) |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open `/create-project` | — | Step 1 visible |  |  |  |
| 2 | Leave date empty, click Next | Date: _empty_ | Error: “Please select a wedding date” |  |  |  |
| 3 | Leave start time empty | Date: 2025-09-20; Start: _empty_; End: _empty_ | Error: “Please select a start time” |  |  |  |
| 4 | Leave end time empty | Date: 2025-09-20; Start: 10:00; End: _empty_ | Error: “Please select an end time” |  |  |  |
| 5 | End time before start | Date: 2025-09-20; Start: 10:00; End: 09:00 | Error: “End time must be after start time” |  |  |  |

Post-conditions: No project created.

---

### Design Wedding Venue (Access 3D Designer)

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-DES-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Wedding Planning |
| Test Title | Open 3D designer for project with venue |
| Description | Couples can access 3D venue designer when project has a venue |
| Pre-conditions | Project exists with venueServiceListingId set |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open project dashboard | `/project-dashboard?projectId={id}` | Dashboard loads |  |  |  |
| 2 | Click “Design venue” | — | Navigates to `/venue-designer?projectId={id}` |  |  |  |
| 3 | Wait for scene load | — | Venue model renders; catalog visible |  |  |  |
| 4 | Add an element | Choose item (e.g., chair) and place | Item placed; collision respected; budget updates |  |  |  |
| 5 | Save design | Auto/save triggered | Design persists; reload shows item |  |  |  |

Post-conditions: Design stored for the project.

---


| Field | Value |
| --- | --- |
| Test Case ID | WP-DES-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Wedding Planning |
| Test Title | Block 3D designer without venue |
| Description | Designer requires venue selection |
| Pre-conditions | Project exists without venueServiceListingId |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open `/project-dashboard?projectId={id}` (no venue) | — | Dashboard loads |  |  |  |
| 2 | Click “Design venue” | — | Error/message: select venue first; no designer access |  |  |  |

Post-conditions: No design session started.

---

### Manage Checklist (Tasks/Subtasks)

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-CHK-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Wedding Planning |
| Test Title | Add and manage main task with subtasks |
| Description | Create main task, add subtask, edit, update progress |
| Pre-conditions | Project exists; checklist page accessible |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open checklist page | `/checklist?projectId={id}` | Checklist loads |  |  |  |
| 2 | Add main task | Title: “Book photographer”; Due: 2025-07-01 | Task created and listed |  |  |  |
| 3 | View main task | Click task row | Task detail opens |  |  |  |
| 4 | Add subtask | Title: “Compare 3 quotes”; Due: 2025-06-15 | Subtask added under main |  |  |  |
| 5 | Edit main task | Change title to “Book wedding photographer” | Updated title saved |  |  |  |
| 6 | Edit subtask | Change due to 2025-06-20 | Subtask updated |  |  |  |
| 7 | Update task progress | Set status “In Progress” | Status updated |  |  |  |
| 8 | Delete subtask | Select subtask → delete | Subtask removed |  |  |  |
| 9 | Delete main task | Delete main task | Task removed |  |  |  |

Post-conditions: Tasks/subtasks updated accordingly.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-CHK-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Wedding Planning |
| Test Title | Validation blocks empty task creation |
| Description | Adding task/subtask without title should fail |
| Pre-conditions | Project exists; checklist page accessible |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open checklist page | `/checklist?projectId={id}` | Checklist loads |  |  |  |
| 2 | Add main task with empty title | Title: _empty_; Due: 2025-07-01 | Validation error; task not created |  |  |  |
| 3 | Add subtask with empty title | Title: _empty_ | Validation error; subtask not created |  |  |  |

Post-conditions: No new tasks/subtasks created.

---

### Review Wedding Plan (Overview)

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-REV-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Wedding Planning |
| Test Title | View wedding plan overview |
| Description | Overview shows key plan info and progress |
| Pre-conditions | Project exists with tasks |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open project dashboard overview | `/project-dashboard?projectId={id}` | Overview cards load (dates, venue, progress) |  |  |  |
| 2 | View progress section | — | Shows tasks completed/remaining |  |  |  |

Post-conditions: None.

---

### Manage Pre-Packaged Wedding (Admin)

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-PKG-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Wedding Planning (Admin) |
| Test Title | Admin adds new package |
| Description | Create pre-packaged wedding with details |
| Pre-conditions | Admin logged in |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open packages page | Admin packages management | Page loads |  |  |  |
| 2 | Click “Add package” | — | Package form opens |  |  |  |
| 3 | Enter package name | “Classic Gold” | Accepted |  |  |  |
| 4 | Enter description | “Includes venue + decor + catering” | Accepted |  |  |  |
| 5 | Enter price | 120000 | Accepted (numeric) |  |  |  |
| 6 | Save package | Data above | Package created; listed |  |  |  |

Post-conditions: Package visible to admins; selectable.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | WP-PKG-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Wedding Planning (Admin) |
| Test Title | Block package creation without required fields |
| Description | Required validations on add package |
| Pre-conditions | Admin logged in |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open packages page | Admin packages management | Page loads |  |  |  |
| 2 | Click “Add package” | — | Form opens |  |  |  |
| 3 | Leave name empty, click save | Name: _empty_; Price: 120000 | Error: name required |  |  |  |
| 4 | Leave price empty, click save | Name: “Classic Gold”; Price: _empty_ | Error: price required |  |  |  |

Post-conditions: No package created.

---

## Test Cases — 3D Venue Design Module

The following test cases align with `/venue-designer?projectId={id}` and current 3D designer interactions (catalog sidebar, scene placement/transform controls, budget tracker, and save/auto-save).

### Browse Vendor Item Catalog

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-CAT-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | 3D Venue Design |
| Test Title | Browse and filter catalog |
| Description | User can search/filter catalog items |
| Pre-conditions | Project has venue; designer loads |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open venue designer | `/venue-designer?projectId={id}` | Scene and catalog load |  |  |  |
| 2 | Enter search term | “chair” | List filters to chairs |  |  |  |
| 3 | Choose category filter | Category: “Florist” | List filters to florist items |  |  |  |
| 4 | Clear filters | — | Full catalog returns |  |  |  |

Post-conditions: Catalog responsive to search/filter.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-CAT-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | 3D Venue Design |
| Test Title | Empty/invalid search yields empty state |
| Description | Shows empty/notice when no items match |
| Pre-conditions | Designer loaded |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Enter uncommon term | “zzzz-invalid” | No items shown; empty-state message |  |  |  |

Post-conditions: No item selected.

---

### Add Element into Space

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-ADD-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | 3D Venue Design |
| Test Title | Add catalog item into scene |
| Description | Place element within bounds and update budget |
| Pre-conditions | Designer loaded; budget tracker visible |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Select catalog item | Item: “Banquet Chair” | Item preview ready |  |  |  |
| 2 | Click “Add” / place in scene | — | Element appears at cursor position |  |  |  |
| 3 | Release to place | Position inside bounds | Element placed; no collision error |  |  |  |
| 4 | Check budget tracker | — | Planned spend increases by item price |  |  |  |

Post-conditions: Element stored in design; budget updated.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-ADD-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | 3D Venue Design |
| Test Title | Prevent placement outside bounds/overlap |
| Description | Placement blocked when out-of-bounds or colliding |
| Pre-conditions | Designer loaded; another element nearby |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Select catalog item | Item: “Table” | Item preview ready |  |  |  |
| 2 | Attempt place outside venue bounds | Drag outside floor grid | Placement blocked; warning shown; no save |  |  |  |
| 3 | Attempt place overlapping existing element | Drag onto existing chair | Collision warning; element not placed |  |  |  |

Post-conditions: No invalid placement saved.

---

### Modify Element (Move / Rotate / Duplicate / Remove / Lock)

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-MOD-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | 3D Venue Design |
| Test Title | Move, rotate, duplicate, lock, remove element |
| Description | Element transform and lifecycle operations succeed |
| Pre-conditions | Element exists in scene; designer loaded |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Select existing element | e.g., “Banquet Chair #1” | Element highlighted |  |  |  |
| 2 | Move element | Drag within bounds | New position saved; no collisions |  |  |  |
| 3 | Rotate element | Use rotate control to 90° | Rotation applied and saved |  |  |  |
| 4 | Duplicate element | Click duplicate on selected element | New copy appears offset; same metadata |  |  |  |
| 5 | Lock position | Toggle lock for element | Element marked locked; move disabled |  |  |  |
| 6 | Attempt move locked element | Drag locked element | Move blocked; lock warning |  |  |  |
| 7 | Remove element | Delete selected element | Element removed; budget updates |  |  |  |

Post-conditions: Changes persisted; budget reflects additions/removals.

---

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-MOD-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | 3D Venue Design |
| Test Title | Prevent invalid move/rotate |
| Description | Movement blocked when exceeding bounds/collision |
| Pre-conditions | Two elements placed close together |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Select element | — | Element highlighted |  |  |  |
| 2 | Drag through another element | — | Collision warning; position reverts |  |  |  |
| 3 | Rotate if locked | Lock element then rotate | Rotation blocked; warning shown |  |  |  |

Post-conditions: Original valid state remains.

---

### Camera Controls (Move / Zoom)

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-CAM-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | 3D Venue Design |
| Test Title | Move camera and zoom |
| Description | Camera navigation works for viewing scene |
| Pre-conditions | Designer loaded; scene visible |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Orbit/pan camera | Mouse drag / WASD as supported | Scene view changes accordingly |  |  |  |
| 2 | Zoom in/out | Mouse wheel / trackpad | Zoom level changes; no jump |  |  |  |

Post-conditions: Camera state updated; design unchanged.

---

### Save Venue Design

✅
| Field | Value |
| --- | --- |
| Test Case ID | VD-SAVE-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | 3D Venue Design |
| Test Title | Save/auto-save design |
| Description | Design persists after refresh |
| Pre-conditions | Elements placed; network available |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Make changes in scene | Move/add element | Unsaved changes present |  |  |  |
| 2 | Trigger save | Click Save or wait for auto-save | Save request sent; toast/last-saved updated |  |  |  |
| 3 | Reload designer | Refresh `/venue-designer?projectId={id}` | Changes persist |  |  |  |

Post-conditions: Latest design stored server-side.

---

## Test Data Trace Table (User Management)

| Test Data ID | Description | Example Values | Used In (Test IDs) |
| --- | --- | --- | --- |
| TD-USER-NEW | New couple registration data | Name, unique email, strong password | UM-REG-P |
| TD-USER-DUPLICATE | Existing email | Registered email | UM-REG-N |
| TD-USER-VALID | Active user credentials | user@example.com / ValidPass123! | UM-LOGIN-P, UM-LOGOUT-P, UM-VIEW-P, UM-EDIT-P |
| TD-USER-INVALID-PW | Wrong password | user@example.com / WrongPass | UM-LOGIN-N |
| TD-OTP-VALID | Valid OTP | 6-digit valid code | UM-REG-P, UM-RST-P |
| TD-OTP-INVALID | Invalid/expired OTP | 000000 | UM-RST-N |
| TD-PW-NEW | New password | NewSecurePass123! | UM-RST-P |
| TD-PROFILE-UPDATE | Profile updates | Name, phone, photo file | UM-EDIT-P |
| TD-PROFILE-BAD-PHONE | Invalid phone | Alphabetic phone string | UM-EDIT-N |
| TD-VENDOR-NEW | New vendor info | Email, password, business name/category | UM-REGV-P |
| TD-DOC-VALID | Valid vendor docs | PDF/JPG proof file | UM-REGV-P |
| TD-VENDOR-INCOMPLETE | Missing vendor fields | No category/docs | UM-REGV-N |
| TD-ADMIN | Admin credentials | admin@example.com | UM-VERIFY-P |
| TD-VENDOR-PENDING | Vendor awaiting approval | Pending vendor record | UM-VERIFY-P |

---

## Test Cases — Budget Management Module

The following test cases align with the Budget Management implementation at `/budget?projectId={id}` and backend routes.

### Manage Wedding Budget

| Field | Value |
| --- | --- |
| Test Case ID | BM-BGT-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Budget Management |
| Test Title | Set/update total wedding budget |
| Description | Enter and save total budget amount |
| Pre-conditions | Project exists; user logged in (couple) |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads; shows current budget or 0 |  |  |  |
| 2 | Click edit budget button | — | Budget input field becomes editable |  |  |  |
| 3 | Enter total budget amount | 50000 | Field accepts numeric input |  |  |  |
| 4 | Click save/confirm | — | Budget saved; success message; totals recalculated |  |  |  |

Post-conditions: Budget updated; totals reflect new amount.

---

| Field | Value |
| --- | --- |
| Test Case ID | BM-BGT-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | Budget Management |
| Test Title | Block invalid budget values |
| Description | Validation rejects negative/zero/excessive amounts |
| Pre-conditions | Project exists; user logged in (couple) |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Click edit budget button | — | Budget input becomes editable |  |  |  |
| 3 | Enter negative budget | -1000 | Error: "Budget must be a positive number" |  |  |  |
| 4 | Enter zero budget | 0 | Error: "Budget must be a positive number" |  |  |  |
| 5 | Enter budget exceeding limit | 10000001 | Error: "Budget cannot exceed RM 10,000,000" |  |  |  |
| 6 | Leave budget empty | _empty_ | Error: "Budget is required" |  |  |  |

Post-conditions: Budget unchanged.

---

### View Category Overview

| Field | Value |
| --- | --- |
| Test Case ID | BM-VIEW-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | View detailed expense breakdown by category |
| Description | Overview displays categories with totals and charts |
| Pre-conditions | Budget exists with categories and expenses |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget overview loads |  |  |  |
| 2 | View category pie chart | — | Chart shows category distribution |  |  |  |
| 3 | View category bar chart | — | Estimated vs actual costs displayed |  |  |  |
| 4 | View category list | — | Categories listed with totals |  |  |  |
| 5 | Click on category | Select "Photography" | Category details expand; expenses shown |  |  |  |

Post-conditions: None.

---

### Add New Budget Category

| Field | Value |
| --- | --- |
| Test Case ID | BM-CAT-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Budget Management |
| Test Title | Add category with valid name |
| Description | Create new budget category successfully |
| Pre-conditions | Budget exists; user logged in (couple) |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Click "Add Category" button | — | Add category dialog opens |  |  |  |
| 3 | Enter category name | "Photography" | Field accepts input |  |  |  |
| 4 | Click "Add" or "Save" | — | Category created; success message; category appears in list |  |  |  |

Post-conditions: New category visible; can add expenses to it.

---

| Field | Value |
| --- | --- |
| Test Case ID | BM-CAT-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | Block category creation with invalid name |
| Description | Validation rejects empty/long/invalid names |
| Pre-conditions | Budget exists; user logged in (couple) |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Click "Add Category" button | — | Add category dialog opens |  |  |  |
| 3 | Leave name empty, click Add | Name: _empty_ | Error: "Category name is required" |  |  |  |
| 4 | Enter name exceeding 100 chars | Name: "A".repeat(101) | Error: "Category name must be 100 characters or less" |  |  |  |
| 5 | Enter SQL injection attempt | Name: "SELECT * FROM users" | Error: "Category name contains invalid characters" |  |  |  |

Post-conditions: No category created.

---

### Edit Budget Category

| Field | Value |
| --- | --- |
| Test Case ID | BM-EDITCAT-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | Update category name successfully |
| Description | Rename existing category |
| Pre-conditions | Budget exists with at least one category |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Find category to edit | Locate "Photography" category | Category visible in list |  |  |  |
| 3 | Click edit icon/button | — | Category name becomes editable |  |  |  |
| 4 | Enter new category name | "Wedding Photography" | Field accepts input |  |  |  |
| 5 | Click save/confirm | — | Category name updated; success message |  |  |  |

Post-conditions: Category renamed; expenses remain linked.

---

| Field | Value |
| --- | --- |
| Test Case ID | BM-EDITCAT-N |
| Test Priority (Low/Medium/High) | Low |
| Module Name | Budget Management |
| Test Title | Block category edit with invalid name |
| Description | Validation rejects empty/long names during edit |
| Pre-conditions | Budget exists with at least one category |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Click edit on category | Select "Photography" → edit | Name becomes editable |  |  |  |
| 3 | Clear name, click save | Name: _empty_ | Error: "Category name is required" |  |  |  |
| 4 | Enter name > 100 chars | Name: "A".repeat(101) | Error: "Category name must be 100 characters or less" |  |  |  |

Post-conditions: Category name unchanged.

---

### Delete Budget Category

| Field | Value |
| --- | --- |
| Test Case ID | BM-DELCAT-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | Delete empty category successfully |
| Description | Remove category with no expenses |
| Pre-conditions | Budget exists with empty category |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Find empty category | Locate category with 0 expenses | Category visible |  |  |  |
| 3 | Click delete icon/button | — | Confirmation dialog appears |  |  |  |
| 4 | Confirm deletion | Click "Delete" | Category removed; success message; totals updated |  |  |  |

Post-conditions: Category deleted; budget totals recalculated.

---

| Field | Value |
| --- | --- |
| Test Case ID | BM-DELCAT-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | Prevent deletion of category with expenses |
| Description | System blocks deletion when expenses exist |
| Pre-conditions | Budget exists with category containing expenses |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Find category with expenses | Locate "Photography" with expenses | Category shows expense count |  |  |  |
| 3 | Attempt to delete | Click delete button | Error: "Cannot delete category with expenses" or delete disabled |  |  |  |

Post-conditions: Category remains; expenses intact.

---

### Add New Expense

| Field | Value |
| --- | --- |
| Test Case ID | BM-EXP-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Budget Management |
| Test Title | Add expense with valid details |
| Description | Create expense in category successfully |
| Pre-conditions | Budget exists with at least one category |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Select category | Click "Photography" category | Category selected; expenses list shown |  |  |  |
| 3 | Click "Add Expense" button | — | Add expense dialog opens |  |  |  |
| 4 | Enter expense name | "Wedding photographer" | Field accepts input |  |  |  |
| 5 | Enter estimated cost | 5000 | Field accepts numeric input |  |  |  |
| 6 | Enter actual cost (optional) | 4800 | Field accepts numeric input |  |  |  |
| 7 | Enter remark (optional) | "Booked for 8 hours" | Field accepts text |  |  |  |
| 8 | Click "Add" or "Save" | — | Expense created; success message; appears in category list; totals updated |  |  |  |

Post-conditions: Expense added; category totals updated; budget totals recalculated.

---

| Field | Value |
| --- | --- |
| Test Case ID | BM-EXP-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | Budget Management |
| Test Title | Block expense creation with invalid data |
| Description | Validation rejects missing/invalid expense fields |
| Pre-conditions | Budget exists with at least one category |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Select category | Click "Photography" | Category selected |  |  |  |
| 3 | Click "Add Expense" | — | Add expense dialog opens |  |  |  |
| 4 | Leave name empty, click Add | Name: _empty_; Estimated: 5000 | Error: "Expense name is required" |  |  |  |
| 5 | Enter name > 200 chars | Name: "A".repeat(201); Estimated: 5000 | Error: "Expense name must be 200 characters or less" |  |  |  |
| 6 | Leave estimated cost empty | Name: "Photographer"; Estimated: _empty_ | Error: "Estimated cost is required" |  |  |  |
| 7 | Enter negative estimated cost | Name: "Photographer"; Estimated: -100 | Error: "Cost must be a positive number" |  |  |  |
| 8 | Enter negative actual cost | Name: "Photographer"; Estimated: 5000; Actual: -100 | Error: "Cost must be a positive number" |  |  |  |
| 9 | Enter cost > 10M | Name: "Photographer"; Estimated: 10000001 | Error: "Cost cannot exceed RM 10,000,000" |  |  |  |
| 10 | Enter remark > 500 chars | Name: "Photographer"; Estimated: 5000; Remark: "A".repeat(501) | Error: "Remark must be 500 characters or less" |  |  |  |

Post-conditions: No expense created.

---

### Edit Expense

| Field | Value |
| --- | --- |
| Test Case ID | BM-EDITEXP-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | Update expense details successfully |
| Description | Modify expense name, costs, or remark |
| Pre-conditions | Budget exists with category containing expense |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Select category | Click "Photography" | Category selected; expenses shown |  |  |  |
| 3 | Find expense to edit | Locate "Wedding photographer" expense | Expense visible in list |  |  |  |
| 4 | Click edit icon/button | — | Edit expense dialog opens with current data |  |  |  |
| 5 | Update expense name | Change to "Professional wedding photographer" | Field accepts input |  |  |  |
| 6 | Update estimated cost | Change to 5500 | Field accepts numeric input |  |  |  |
| 7 | Update actual cost | Change to 5200 | Field accepts numeric input |  |  |  |
| 8 | Update remark | Change to "Booked for 10 hours" | Field accepts text |  |  |  |
| 9 | Click "Save" or "Update" | — | Expense updated; success message; totals recalculated |  |  |  |

Post-conditions: Expense updated; category and budget totals reflect changes.

---

| Field | Value |
| --- | --- |
| Test Case ID | BM-EDITEXP-N |
| Test Priority (Low/Medium/High) | Low |
| Module Name | Budget Management |
| Test Title | Block expense edit with invalid data |
| Description | Validation rejects invalid fields during edit |
| Pre-conditions | Budget exists with category containing expense |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Select category and expense | Click "Photography" → edit expense | Edit dialog opens |  |  |  |
| 3 | Clear expense name, click Save | Name: _empty_; Estimated: 5000 | Error: "Expense name is required" |  |  |  |
| 4 | Enter negative estimated cost | Name: "Photographer"; Estimated: -100 | Error: "Cost must be a positive number" |  |  |  |
| 5 | Enter cost > 10M | Name: "Photographer"; Estimated: 10000001 | Error: "Cost cannot exceed RM 10,000,000" |  |  |  |

Post-conditions: Expense unchanged.

---

### Delete Expense

| Field | Value |
| --- | --- |
| Test Case ID | BM-DELEXP-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Budget Management |
| Test Title | Delete expense successfully |
| Description | Remove expense from category |
| Pre-conditions | Budget exists with category containing expense |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open budget management page | Navigate to `/budget?projectId={id}` | Budget page loads |  |  |  |
| 2 | Select category | Click "Photography" | Category selected; expenses shown |  |  |  |
| 3 | Find expense to delete | Locate "Wedding photographer" expense | Expense visible |  |  |  |
| 4 | Click delete icon/button | — | Confirmation dialog appears |  |  |  |
| 5 | Confirm deletion | Click "Delete" | Expense removed; success message; category totals updated |  |  |  |

Post-conditions: Expense deleted; category and budget totals recalculated.

---

## Test Cases — Vendor Management Module

The following test cases align with Vendor Management implementation for both Couple and Vendor actors.

### Search Vendor Items (Couple)

| Field | Value |
| --- | --- |
| Test Case ID | VM-SEARCH-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Search vendors with valid query |
| Description | Find vendors by name, description, or vendor name |
| Pre-conditions | User logged in (couple); project exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open venue designer or catalog | Navigate to `/venue-designer?projectId={id}` | Catalog sidebar visible |  |  |  |
| 2 | Enter search query | "photographer" | Search field accepts input |  |  |  |
| 3 | Submit search | — | Results filtered; matching listings shown |  |  |  |

Post-conditions: Search results displayed.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-SEARCH-N |
| Test Priority (Low/Medium/High) | Low |
| Module Name | Vendor Management |
| Test Title | Search returns no results for non-existent query |
| Description | Empty result set for unmatched search |
| Pre-conditions | User logged in (couple); project exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open catalog | Navigate to `/venue-designer?projectId={id}` | Catalog visible |  |  |  |
| 2 | Enter non-existent search | "xyzabc123nonexistent" | Search field accepts input |  |  |  |
| 3 | Submit search | — | No results message shown; empty list |  |  |  |

Post-conditions: No listings displayed.

---

### Filter Vendor Items (Couple)

| Field | Value |
| --- | --- |
| Test Case ID | VM-FILTER-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Filter vendors by category |
| Description | Apply category filter to narrow results |
| Pre-conditions | User logged in (couple); project exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open catalog | Navigate to `/venue-designer?projectId={id}` | Catalog visible |  |  |  |
| 2 | Select filter criteria | Choose "Photographer" from category dropdown | Category selected |  |  |  |
| 3 | View filtered results | — | Only photographer listings shown |  |  |  |

Post-conditions: Filtered results displayed.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-FILTER-N |
| Test Priority (Low/Medium/High) | Low |
| Module Name | Vendor Management |
| Test Title | Filter with no matching results |
| Description | Empty result set when filter matches nothing |
| Pre-conditions | User logged in (couple); project exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open catalog | Navigate to `/venue-designer?projectId={id}` | Catalog visible |  |  |  |
| 2 | Select filter with no matches | Choose category with no listings | Filter applied |  |  |  |
| 3 | View results | — | No results message; empty list |  |  |  |

Post-conditions: No listings displayed.

---

### Book Vendor (Couple)

| Field | Value |
| --- | --- |
| Test Case ID | VM-BOOK-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Book vendor service successfully |
| Description | Create booking request for vendor service |
| Pre-conditions | Project exists with venue; user logged in (couple); vendor listing active |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open venue designer | Navigate to `/venue-designer?projectId={id}` | Designer loads |  |  |  |
| 2 | Browse catalog | Select vendor item (e.g., photographer) | Item details shown |  |  |  |
| 3 | Add item to design | Place item in 3D scene | Item placed |  |  |  |
| 4 | Proceed to checkout | Click "Proceed to Checkout" | Contract review modal opens |  |  |  |
| 5 | Review contract | Review terms and cancellation policy | Contract details displayed |  |  |  |
| 6 | Acknowledge contract | Check acknowledgment checkbox | Checkbox checked |  |  |  |
| 7 | Continue to checkout | Click "Acknowledge & Continue" | Checkout modal opens |  |  |  |
| 8 | Confirm booking | Click "Confirm Booking" | Booking request created; status `pending_vendor_confirmation` |  |  |  |

Post-conditions: Booking request visible in "My Bookings"; vendor notified.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-BOOK-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Block booking without venue |
| Description | Venue-first rule enforced |
| Pre-conditions | Project exists without venue; user logged in (couple) |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open project without venue | Navigate to project dashboard | Dashboard loads |  |  |  |
| 2 | Attempt to book non-venue service | Try to book photographer | Error: "You must book a confirmed venue before booking other services" |  |  |  |

Post-conditions: No booking created.

---

### Cancel Booking (Couple)

| Field | Value |
| --- | --- |
| Test Case ID | VM-CANCEL-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Cancel booking with reason |
| Description | Couple cancels booking request |
| Pre-conditions | Booking exists with status `pending_vendor_confirmation` or `pending_deposit_payment` |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open "My Bookings" | Navigate to `/my-bookings` | Bookings list loads |  |  |  |
| 2 | Find pending booking | Locate booking with `pending_vendor_confirmation` | Booking visible |  |  |  |
| 3 | Click "Cancel Booking" | — | Cancellation dialog opens |  |  |  |
| 4 | Enter cancellation reason | "Change of plans" | Reason field accepts input |  |  |  |
| 5 | Confirm cancellation | Click "Confirm" | Booking cancelled; status `cancelled_by_couple`; no fee if early |  |  |  |

Post-conditions: Booking cancelled; appears in "Cancelled" tab.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-CANCEL-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Block cancellation without reason |
| Description | Reason required for cancellation |
| Pre-conditions | Booking exists with cancellable status |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open "My Bookings" | Navigate to `/my-bookings` | Bookings list loads |  |  |  |
| 2 | Click "Cancel Booking" | — | Cancellation dialog opens |  |  |  |
| 3 | Leave reason empty, click Confirm | Reason: _empty_ | Error: reason required; cancellation blocked |  |  |  |

Post-conditions: Booking unchanged.

---

### View Vendor Item Details (Couple)

| Field | Value |
| --- | --- |
| Test Case ID | VM-VIEW-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | View vendor listing details |
| Description | Display full listing information |
| Pre-conditions | User logged in (couple); active listing exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open catalog | Navigate to `/venue-designer?projectId={id}` | Catalog visible |  |  |  |
| 2 | Click on vendor listing | Select listing card | Listing detail panel opens |  |  |  |
| 3 | View details | — | Shows name, description, price, images, 3D preview (if available), reviews |  |  |  |

Post-conditions: None.

---

### Review Vendor (Couple)

| Field | Value |
| --- | --- |
| Test Case ID | VM-REVIEW-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Submit review with rating and comment |
| Description | Create review for completed booking |
| Pre-conditions | Booking exists with status `completed` |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open "My Bookings" | Navigate to `/my-bookings` | Bookings list loads |  |  |  |
| 2 | Find completed booking | Locate booking with status `completed` | Booking visible |  |  |  |
| 3 | Click "Leave Review" | — | Review dialog opens |  |  |  |
| 4 | Select service to review | Choose service from dropdown | Service selected |  |  |  |
| 5 | Select rating | Choose 5 stars | Rating selected (1-5) |  |  |  |
| 6 | Enter comment (optional) | "Excellent service!" | Comment field accepts text |  |  |  |
| 7 | Submit review | Click "Submit Review" | Review created; success message; review appears |  |  |  |

Post-conditions: Review visible on listing; average rating updated.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-REVIEW-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Block review without rating |
| Description | Rating required for review |
| Pre-conditions | Booking exists with status `completed` |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open "My Bookings" | Navigate to `/my-bookings` | Bookings list loads |  |  |  |
| 2 | Click "Leave Review" | — | Review dialog opens |  |  |  |
| 3 | Select service | Choose service | Service selected |  |  |  |
| 4 | Leave rating empty, submit | Rating: _not selected_; Comment: "Good" | Error: rating required; review not created |  |  |  |

Post-conditions: No review created.

---

### View Booking Requests (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-VIEWREQ-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | View all booking requests |
| Description | Vendor sees incoming booking requests |
| Pre-conditions | Vendor logged in; booking requests exist |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open booking requests page | Navigate to `/vendor/booking-requests` | Booking requests list loads |  |  |  |
| 2 | View request details | Click on booking | Details show couple name, date, services, total amount, venue |  |  |  |

Post-conditions: None.

---

### Accept Booking Requests (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-ACCEPT-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Accept booking request |
| Description | Vendor approves booking |
| Pre-conditions | Booking exists with status `pending_vendor_confirmation` |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open booking requests | Navigate to `/vendor/booking-requests` | Requests list loads |  |  |  |
| 2 | View booking details | Click on pending booking | Details displayed |  |  |  |
| 3 | Click "Accept" | — | Confirmation dialog appears |  |  |  |
| 4 | Confirm acceptance | Click "Accept" in dialog | Booking status → `pending_deposit_payment`; deposit due date set (7 days); couple notified |  |  |  |

Post-conditions: Booking status updated; couple can pay deposit.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-ACCEPT-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Block accepting non-pending booking |
| Description | Cannot accept already accepted/rejected booking |
| Pre-conditions | Booking exists with status `confirmed` or `rejected` |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open booking requests | Navigate to `/vendor/booking-requests` | Requests list loads |  |  |  |
| 2 | Find non-pending booking | Locate `confirmed` or `rejected` booking | Booking visible |  |  |  |
| 3 | Attempt to accept | Click "Accept" (if shown) | Error or button disabled; no status change |  |  |  |

Post-conditions: Booking status unchanged.

---

### Reject Booking Requests (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-REJECT-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Reject booking request |
| Description | Vendor declines booking |
| Pre-conditions | Booking exists with status `pending_vendor_confirmation` |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open booking requests | Navigate to `/vendor/booking-requests` | Requests list loads |  |  |  |
| 2 | View booking details | Click on pending booking | Details displayed |  |  |  |
| 3 | Click "Reject" | — | Confirmation dialog appears |  |  |  |
| 4 | Confirm rejection | Click "Reject" in dialog | Booking status → `rejected`; couple notified |  |  |  |

Post-conditions: Booking rejected; appears in rejected list.

---

### Set Availability (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-AVAIL-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Mark dates unavailable |
| Description | Vendor sets unavailable dates |
| Pre-conditions | Vendor logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open availability management | Navigate to availability page | Calendar/date picker visible |  |  |  |
| 2 | Select unavailable date | Choose date (e.g., 2025-12-25) | Date selected |  |  |  |
| 3 | Mark as unavailable | Click "Mark Unavailable" | Date marked; time slot created |  |  |  |

Post-conditions: Date unavailable; bookings blocked for that date.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-AVAIL-N |
| Test Priority (Low/Medium/High) | Low |
| Module Name | Vendor Management |
| Test Title | Block setting past dates as unavailable |
| Description | Cannot mark past dates |
| Pre-conditions | Vendor logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open availability management | Navigate to availability page | Calendar visible |  |  |  |
| 2 | Select past date | Choose yesterday's date | Past date selected (if allowed) |  |  |  |
| 3 | Attempt to mark unavailable | Click "Mark Unavailable" | Error: "Cannot mark past dates" or date disabled |  |  |  |

Post-conditions: No time slot created.

---

### View Past Bookings (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-PAST-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | View completed and past bookings |
| Description | Vendor sees booking history |
| Pre-conditions | Vendor logged in; past bookings exist |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open booking requests | Navigate to `/vendor/booking-requests` | Bookings list loads |  |  |  |
| 2 | Filter by status | Select "Completed" or "Past" filter | Completed/past bookings shown |  |  |  |
| 3 | View booking details | Click on booking | Details show couple, date, services, payments, status |  |  |  |

Post-conditions: None.

---

### Create Listing (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-CREATE-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Create service listing with all details |
| Description | Vendor creates new listing successfully |
| Pre-conditions | Vendor logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open manage listings | Navigate to `/vendor/manage-listings` | Listings page loads |  |  |  |
| 2 | Click "Add Listing" | — | Listing wizard opens (Step 1) |  |  |  |
| 3 | Enter listing name | "Professional Wedding Photography Package" | Field accepts input (min 10 chars) |  |  |  |
| 4 | Enter description | "Full day coverage with edited photos" | Field accepts input (min 10 chars) |  |  |  |
| 5 | Select category | Choose "Photographer" | Category selected |  |  |  |
| 6 | Enter price | 5000 | Field accepts numeric input |  |  |  |
| 7 | Select availability type | Choose "exclusive" | Type selected |  |  |  |
| 8 | Select pricing policy | Choose "fixed_package" | Policy selected |  |  |  |
| 9 | Upload images | Select 1-5 image files | Images uploaded |  |  |  |
| 10 | (Optional) Upload 3D model | Select GLB file (≤150MB) | Model uploaded |  |  |  |
| 11 | Enter cancellation policy | "Cancellations 7+ days: 10% fee" | Policy text accepted |  |  |  |
| 12 | Set cancellation fee tiers | >90: 0%, 30-90: 10%, 7-30: 25%, <7: 50% | Tiers set |  |  |  |
| 13 | Complete wizard | Click through all steps → "Save" | Listing created; success message; appears in list |  |  |  |

Post-conditions: Listing visible; active by default.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-CREATE-N |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Block listing creation with missing required fields |
| Description | Validation rejects incomplete listings |
| Pre-conditions | Vendor logged in |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open manage listings | Navigate to `/vendor/manage-listings` | Listings page loads |  |  |  |
| 2 | Click "Add Listing" | — | Wizard opens |  |  |  |
| 3 | Leave name empty, proceed | Name: _empty_; Description: "Test"; Category: "Photographer" | Error: "Service name must be at least 10 characters" |  |  |  |
| 4 | Enter name < 10 chars | Name: "Short"; Description: "Test"; Category: "Photographer" | Error: "Service name must be at least 10 characters" |  |  |  |
| 5 | Leave category empty | Name: "Valid Name Here"; Category: _empty_ | Error: category required |  |  |  |
| 6 | Leave price empty (non-time-based) | Name: "Valid Name"; Category: "Photographer"; Pricing: "fixed_package"; Price: _empty_ | Error: "Price is required for this pricing policy" |  |  |  |

Post-conditions: No listing created.

---

### Edit Listing (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-EDIT-P |
| Test Priority (Low/Medium/High) | High |
| Module Name | Vendor Management |
| Test Title | Update listing details successfully |
| Description | Vendor edits existing listing |
| Pre-conditions | Vendor logged in; own listing exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open manage listings | Navigate to `/vendor/manage-listings` | Listings page loads |  |  |  |
| 2 | Find listing to edit | Locate own listing | Listing visible |  |  |  |
| 3 | Click edit icon | — | Edit wizard opens with current data |  |  |  |
| 4 | Update listing name | Change to "Updated Photography Package" | Field accepts input |  |  |  |
| 5 | Update price | Change to 5500 | Field accepts numeric input |  |  |  |
| 6 | Update description | Change description text | Field accepts input |  |  |  |
| 7 | Save changes | Click "Save" | Listing updated; success message |  |  |  |

Post-conditions: Listing reflects changes.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-EDIT-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Block editing another vendor's listing |
| Description | Access control prevents unauthorized edits |
| Pre-conditions | Vendor logged in; other vendor's listing exists |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Attempt to edit other vendor's listing | Try to access edit for listing not owned | Edit button hidden or 403 error |  |  |  |

Post-conditions: Listing unchanged.

---

### Delete Listing (Vendor)

| Field | Value |
| --- | --- |
| Test Case ID | VM-DELETE-P |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Delete listing without active bookings |
| Description | Remove listing successfully |
| Pre-conditions | Vendor logged in; own listing exists with no active bookings |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open manage listings | Navigate to `/vendor/manage-listings` | Listings page loads |  |  |  |
| 2 | Find listing to delete | Locate own listing | Listing visible |  |  |  |
| 3 | Click delete icon | — | Confirmation dialog appears |  |  |  |
| 4 | Confirm deletion | Click "Delete" | Listing removed; success message |  |  |  |

Post-conditions: Listing deleted; no longer visible.

---

| Field | Value |
| --- | --- |
| Test Case ID | VM-DELETE-N |
| Test Priority (Low/Medium/High) | Medium |
| Module Name | Vendor Management |
| Test Title | Block deletion of listing with active bookings |
| Description | Cannot delete listing with pending/confirmed bookings |
| Pre-conditions | Vendor logged in; listing has active bookings |
| Test Designed by | QA |
| Test Designed date | _TBD_ |
| Test Executed by | _TBD_ |
| Test Execution date | _TBD_ |

| Step | Test Steps | Test Data | Expected Result | Actual Status | Status (Pass/Fail) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Open manage listings | Navigate to `/vendor/manage-listings` | Listings page loads |  |  |  |
| 2 | Find listing with active booking | Locate listing with `confirmed` booking | Listing visible |  |  |  |
| 3 | Attempt to delete | Click delete icon | Error: "Cannot delete listing with active bookings" or delete disabled |  |  |  |

Post-conditions: Listing remains; bookings intact.

---
