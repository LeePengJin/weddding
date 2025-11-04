# Wedding Management System - Deployment Diagram Specification

## System Overview
This deployment diagram represents the architecture for a wedding planning and management system that supports web browser access on laptop/desktop devices with PostgreSQL database backend.

## Deployment Components

### 1. Devices (`<<device>>`)

#### Laptop/Desktop
- **Description**: Client device for accessing the wedding management system
- **Operating System**: Windows/macOS/Linux
- **Primary Interface**: Web Browser
- **Supported Browsers**: Chrome, Firefox, Safari, Edge

### 2. Nodes (`<<node>>`)

#### Web Server
- **Purpose**: Hosts and serves the React frontend application
- **Technology**: Nginx/Apache HTTP Server
- **Responsibilities**: 
  - Serve static React build files
  - Handle client requests
  - SSL/TLS termination
  - Load balancing (if multiple instances)

#### Backend Server  
- **Purpose**: API server and business logic processing
- **Technology**: Node.js/Express or Python/Django
- **Responsibilities**:
  - REST API endpoints
  - Authentication and authorization
  - Business logic processing
  - File upload handling
  - Real-time communication

#### Database Server
- **Purpose**: Data persistence and management
- **Technology**: PostgreSQL RDBMS
- **Responsibilities**:
  - Store user data, projects, bookings
  - Vendor information and listings
  - Payment records and transactions
  - Messages and notifications
  - Venue designs and configurations

#### Cache Server (Optional)
- **Purpose**: Performance optimization and session management
- **Technology**: Redis
- **Responsibilities**:
  - Session storage
  - Frequently accessed data caching
  - Real-time data for messaging

### 3. Artifacts (`<<artifact>>`)

#### wedding-management-web.js
- **Location**: Web Server
- **Description**: Compiled React application bundle
- **Contains**: All frontend components, styles, and assets

#### wedding-backend-api.jar/.py
- **Location**: Backend Server  
- **Description**: Backend application deployment package
- **Contains**: API endpoints, business logic, middleware

#### wedding-database.sql
- **Location**: Database Server
- **Description**: Database schema and initial data
- **Contains**: Tables, indexes, stored procedures, seed data

#### static-assets/
- **Location**: Web Server
- **Description**: Static files and media
- **Contains**: Images, CSS, fonts, uploaded vendor photos

### 4. Components (`<<component>>`)

#### Frontend Components
- **Wedding Management Web App**: Main React application
- **Authentication Module**: Login/registration interface
- **Project Dashboard**: Project management interface
- **Vendor Directory**: Vendor browsing and selection
- **Venue Designer**: 3D venue planning tool
- **Booking System**: Appointment and booking management
- **Payment Interface**: Payment processing frontend
- **Messaging System**: Real-time communication interface

#### Backend Components
- **Authentication Service**: User authentication and authorization
- **Project Management Service**: Wedding project CRUD operations
- **Vendor Management Service**: Vendor listings and profiles
- **Booking Service**: Appointment scheduling and management
- **Payment Service**: Payment processing and transactions
- **Notification Service**: Email/SMS notifications
- **File Upload Service**: Handle media uploads
- **Venue Design Service**: 3D venue configuration management
- **Message Service**: Real-time messaging backend

### 5. Communication Paths and Protocols

#### Client to Web Server
- **Protocol**: HTTPS (Port 443)
- **Purpose**: Secure web application delivery
- **Data**: HTML, CSS, JavaScript, Images
- **Security**: SSL/TLS encryption

#### Web Server to Backend Server
- **Protocol**: HTTP/HTTPS (Port 8080/8443)
- **Purpose**: API calls and data exchange
- **Data**: JSON REST API requests/responses
- **Authentication**: JWT tokens or API keys

#### Backend Server to Database Server
- **Protocol**: TCP/IP (Port 5432)
- **Purpose**: Database operations
- **Data**: SQL queries and results
- **Security**: Database authentication, connection pooling

#### Backend Server to Cache Server (Optional)
- **Protocol**: TCP/IP (Port 6379)
- **Purpose**: Caching and session management
- **Data**: Key-value pairs, session data
- **Security**: Redis AUTH, network isolation

#### Real-time Communication (Optional)
- **Protocol**: WebSocket (WSS - Port 443)
- **Purpose**: Real-time messaging and notifications
- **Data**: JSON messages, status updates
- **Security**: Secure WebSocket over SSL

## Network Architecture

### Security Considerations
- **DMZ Setup**: Web server in DMZ, backend and database in private network
- **Firewall Rules**: Restrict access between network zones
- **SSL Certificates**: HTTPS for all client communication
- **Database Security**: No direct external access to PostgreSQL

### Scalability Options
- **Load Balancer**: Multiple web server instances behind load balancer
- **Database Clustering**: PostgreSQL master-slave replication
- **CDN**: Content delivery network for static assets
- **Microservices**: Split backend components into separate services

### Monitoring and Logging
- **Application Monitoring**: Performance metrics and error tracking
- **Database Monitoring**: Query performance and resource usage
- **Security Logging**: Access logs and security events
- **Health Checks**: Service availability monitoring

## Deployment Environment Recommendations

### Development Environment
- Single server running all components
- Local PostgreSQL instance
- Hot-reload for frontend development

### Production Environment
- Separate servers for each major component
- Database server with backup and replication
- CDN for static asset delivery
- SSL certificates and security hardening
- Automated deployment pipeline

### Required Infrastructure
- **Minimum**: 3 servers (Web, Backend, Database)
- **Recommended**: 5+ servers (Load Balancer, Web Cluster, Backend Cluster, Database, Cache)
- **Storage**: File storage for uploaded images and documents
- **Backup**: Automated database and file backups