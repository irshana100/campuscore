# API Quick Guide

## Authentication

POST /api/auth/login

Request:
{
  "email": "student1@college.edu",
  "password": "student123"
}

Response:
{
  "token": "...",
  "user": { "id": 1, "name": "Aarav Patel", "role": "student" }
}

## Protected endpoints
- GET /api/dashboard
- GET /api/notifications
- GET /api/notices
- GET /api/attendance
- POST /api/notices/process

Authorization header:
Authorization: Bearer <token>
