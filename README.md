# UCU CAMPUS LOST AND FOUND SYSTEM

## 1. Project Overview
The UCU Campus Lost and Found System is a web-based application developed to help students and administrators manage lost and found property within Uganda Christian University.

The system provides a central platform where students can report lost or found items, upload photographs, search for reported items and submit ownership claims. Administrators can review reports and claims and manage the return of recovered property.

## 2. Project Objectives
- Provide a central platform for lost and found items.
- Make it easier for students to report missing or recovered property.
- Allow students to upload item photographs.
- Support ownership claims and verification.
- Enable administrators to manage reports and claims.

## 3. Technologies Used

### Frontend
- React.js
- Vite
- JavaScript
- CSS
- Axios

### Backend
- Node.js
- Express.js
- JSON Web Tokens (JWT)
- Multer

### Database
- MySQL

## 4. Main System Features

### Student Features
- Student registration and login.
- Report lost items.
- Report found items.
- Upload item photographs.
- Search and view reported items.
- Submit ownership claims.
- View personal reports and claims.

### Administrator Features
- Administrator login.
- View submitted reports.
- Review and approve or reject reports.
- Review ownership claims.
- Approve or reject claims.
- Mark items as returned.

## 5. Project Structure

ucu-campus-lost-and-found/
- frontend/
- backend/
- ucu_lost_and_found.sql
- README.md

## 6. Installation Requirements
- Node.js and npm
- MySQL Server 8.0
- Visual Studio Code or another code editor

## 7. How to Run the System

### Database Setup
1. Start MySQL Server.
2. Create a database named ucu_lost_and_found or import the supplied SQL backup.
3. Configure the backend database credentials in backend/.env.

### Backend Setup
Open a terminal:

cd backend
npm install
npm run dev

The backend runs on http://localhost:5000.

### Frontend Setup
Open another terminal:

cd frontend
npm install
npm run dev

Open http://localhost:5173 in your browser.

## 8. Database Backup
The project includes ucu_lost_and_found.sql, which contains the database export for restoring the project database.

## 9. Security Notes
- Database credentials and secret keys should be configured locally in environment files.
- Environment files containing passwords must not be shared publicly.
- Students and administrators have different access permissions.

## 10. Conclusion
The UCU Campus Lost and Found System provides a practical digital solution for managing lost and found property within the university community. It improves reporting, communication and tracking of recovered items.
