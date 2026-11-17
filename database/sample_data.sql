USE college_management;

INSERT INTO departments (name, code) VALUES ('Computer Science and Engineering', 'CSE');
INSERT INTO departments (name, code) VALUES ('Electronics and Communication', 'ECE');

INSERT INTO subjects (name, code, department_id) VALUES ('Operating Systems', 'CS201', 1);
INSERT INTO subjects (name, code, department_id) VALUES ('Database Management Systems', 'CS205', 1);
INSERT INTO subjects (name, code, department_id) VALUES ('Data Structures', 'CS101', 1);

INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Admin User', 'admin@college.edu', 'pbkdf2:sha256:260000$demo$replace', 'admin', TRUE);
INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Dr. Sharmila Kumari M', 'teacher1@college.edu', 'pbkdf2:sha256:260000$demo$replace', 'teacher', TRUE);
INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Fathima Shazna', 'student1@college.edu', 'pbkdf2:sha256:260000$demo$replace', 'student', TRUE);
INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Fathimath Irshahana', 'student2@college.edu', 'pbkdf2:sha256:260000$demo$replace', 'student', TRUE);
INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Fathimath Shaima', 'student3@college.edu', 'pbkdf2:sha256:260000$demo$replace', 'student', TRUE);
INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Assiya Riha', 'student4@college.edu', 'pbkdf2:sha256:260000$demo$replace', 'student', TRUE);

INSERT INTO teachers (user_id, employee_id, department_id, designation) VALUES (2, 'TCH-101', 1, 'Associate Professor');
INSERT INTO students (user_id, roll_number, department_id, semester, section, batch) VALUES (3, '4PA24CS027', 1, 5, 'A', '2024');
INSERT INTO students (user_id, roll_number, department_id, semester, section, batch) VALUES (4, '4PA24CS028', 1, 5, 'A', '2024');
INSERT INTO students (user_id, roll_number, department_id, semester, section, batch) VALUES (5, '4PA24CS030', 1, 5, 'A', '2024');
INSERT INTO students (user_id, roll_number, department_id, semester, section, batch) VALUES (6, '4PA24CS013', 1, 5, 'A', '2024');

INSERT INTO student_subject_allocations (student_id, subject_id) VALUES (1, 1), (2, 1), (3, 1), (4, 1);

INSERT INTO attendance (student_id, subject_id, date, status, period) VALUES
(1, 1, '2026-10-01', 'present', 1),
(1, 1, '2026-10-03', 'present', 1),
(1, 1, '2026-10-05', 'absent', 1),
(1, 1, '2026-10-08', 'present', 1),
(2, 1, '2026-10-01', 'present', 1),
(2, 1, '2026-10-03', 'absent', 1),
(2, 1, '2026-10-05', 'present', 1),
(2, 1, '2026-10-08', 'present', 1);

INSERT INTO notices (title, content, type, department_id, semester, class_name, target_role) VALUES
('Mid-Semester Seminar', 'A seminar on operating system security will be held on 20 October.', 'event', 1, 5, 'CSE-A', 'student'),
('Holiday Notice', 'The college will remain closed on 18 October for Gandhi Jayanti.', 'notice', 1, NULL, NULL, 'all');
