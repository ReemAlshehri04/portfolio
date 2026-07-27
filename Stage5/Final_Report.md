# 🥗 Qooti Project — Final Report

---

## 📑 Table of Contents

- [1. Results Summary](#1-results-summary)
- [2. Lessons Learned](#2-lessons-learned)
- [3. Team Retrospective Highlights](#3-team-retrospective-highlights)
- [4. Conclusion](#4-conclusion)

---

# 1. 📊 Results Summary

The **Qooti Project** is a full-stack web platform that allows users to subscribe to healthy meals from different restaurants through one flexible weekly plan.

The project was created to solve the problem of customers being limited to one restaurant during the entire subscription period.

## ⚙️ Core MVP Functionalities

The final MVP includes the following main functionalities:

- 👤 Customer registration and login.
- 🏪 Restaurant registration and login.
- 🔐 Secure authentication using JWT.
- ✅ Displaying approved healthy restaurants.
- 🍱 Browsing meals and nutritional information.
- 📅 Selecting one meal for each working day from Sunday to Thursday.
- 📍 Saving the customer’s delivery address and preferred delivery time.
- 🧾 Reviewing weekly meal selections before confirmation.
- 📦 Creating and storing a weekly subscription.
- 🏷️ Applying a discount code.
- ✏️ Allowing restaurant owners to add, update, and delete meals.
- 📋 Displaying customer orders to restaurant owners.
- 🛡️ Allowing the admin to approve or reject restaurant accounts.
- 💳 Processing the subscription payment.
- 🚀 Deploying the frontend and backend so the website can be accessed online.

## 🛠️ Technologies Used

| Layer                           | Technology         |
| ------------------------------- | ------------------ |
| Frontend                        | React.js           |
| Backend                         | Python and FastAPI |
| Database                        | PostgreSQL         |
| Authentication                  | JWT                |
| API Testing                     | Postman            |
| Version Control                 | GitHub             |
| Frontend Deployment             | Vercel             |
| Backend and Database Deployment | Railway            |

---

## 🎯 Comparison with the Project Charter Objectives

### ✅ Objective 1: Deliver a Functional Full-Stack MVP

**Result: Achieved**

The team delivered a working full-stack web application that includes the main customer, restaurant, and admin features defined in the Project Charter.

The completed features include:

- Authentication.
- Restaurant and meal listings.
- Weekly meal selection.
- Delivery information.
- Subscription submission.
- Restaurant meal management.
- Admin restaurant management.

---

### ✅ Objective 2: Demonstrate a Multi-Restaurant Subscription Flow

**Result: Achieved**

The customer can browse meals from different restaurants and select one lunch meal for each working day.

The selected meals are grouped into one weekly subscription request. The system stores five meal selections for each subscription, covering Sunday to Thursday.

---

### ✅ Objective 3: Apply Software Engineering Practices

**Result: Achieved**

The project applied the following software engineering practices:

- 🗄️ Database design and relationships.
- 🔗 RESTful API development.
- 🔐 Authentication and authorization.
- ♻️ CRUD operations.
- 🔄 Frontend and backend integration.
- 🌿 Git and GitHub version control.
- 🧪 API testing using Postman.
- 🖥️ Manual user-flow testing.
- 📝 Technical documentation.
- 🚀 Application deployment.

---

## 📈 Key Project Indicators

| KPIs                     | Planned | Achived |
| ------------------------ | ------- | ------: |
| Number of Restaurants    | 2       |       4 |
| Main user roles          | 3       |       3 |
| Weekly subscription days | 5       |       5 |
| Number of API endpoints  | 14      |      25 |
| Number of Meals          | 10      |      15 |

---

# 2. 💡 Lessons Learned

## 🌟 What Went Well

### 1. Clear Distribution of Responsibilities

The team divided the main responsibilities between:

- Backend development.
- Database development.
- Frontend development.
- Authentication.
- Testing.
- Documentation.

This helped each member focus on an area that matched their strengths.

### 2. Good Team Communication

The team used regular meetings and WhatsApp communication to:

- Discuss progress.
- Report technical problems.
- Coordinate tasks.
- Make shared decisions.
- Support members when problems occurred.

### 3. Using Familiar Technologies

Using React, FastAPI, PostgreSQL, GitHub, and Postman helped the team build a complete project using technologies learned during the Holberton program.

### 4. Simplifying the Subscription Model

The team reduced the subscription to a five-day lunch plan instead of implementing a complex monthly subscription.

This helped keep the project achievable within the available time.

### 5. Testing APIs Before Integration

Testing backend endpoints with Postman helped identify errors before connecting the backend to the frontend.

This reduced some integration problems and made debugging easier.

---

## ⚠️ Challenges and How They Were Addressed

### 1. Frontend and Backend Integration

**Challenge:**  
Some frontend requests did not initially match the backend endpoints or expected response formats.

**Solution:**  
The team:

- Tested endpoints through Postman.
- Reviewed request and response structures.
- Corrected API URLs.
- Updated frontend integration.
- Repeated tests after each correction.

---

### 2. Database Consistency

**Challenge:**  
Team members sometimes had different local database data, especially restaurant, meal, logo, and image records.

**Solution:**  
The team:

- Combined the database seed files.
- Added the required data to the deployed PostgreSQL database.
- Checked that the frontend received the same data from the deployed backend.
- Verified the final data after deployment.

---

### 3. Image and Logo Display

**Challenge:**  
Some meal images and restaurant logos worked locally but did not appear after deployment.

**Solution:**  
The team:

- Checked image URLs.
- Replaced local paths with publicly accessible URLs when needed.
- Reviewed uploaded file paths.
- Tested images through the deployed website.
- Verified that the backend returned correct image values.

---

### 4. Deployment Configuration

**Challenge:**  
The frontend and backend required different deployment settings. Refreshing some React pages also caused routing errors.

**Solution:**  
The team:

- Deployed the backend and database on Railway.
- Deployed the frontend on Vercel.
- Updated environment variables.
- Added the required routing configuration.
- Connected the deployed frontend to the deployed backend.

---

### 5. Payment Redirection

**Challenge:**  
The payment process did not always return the customer to the correct success page.

**Solution:**  
The team reviewed:

- The payment callback URL.
- The frontend success route.
- The backend payment response.
- The deployed frontend and backend URLs.
- The redirect settings after payment.

---

### 6. Scope Changes

**Challenge:**  
The Project Charter originally excluded real online payment from the MVP, while payment was later included in the technical design and implementation.

**Lesson Learned:**  
Any change in project scope should be:

1. Discussed and approved by the team.
2. Added to the Project Charter.
3. Updated in the technical documentation.
4. Reflected in the project plan.
5. Tested before final deployment.

---

## 🔧 Improvements for Future Projects

For future projects, the team should:

- Finalize the database schema before starting full development.
- Define all API request and response formats early.
- Use one shared and updated seed file.
- Prepare an `.env.example` file for all team members.
- Start frontend and backend integration earlier.
- Review code before merging.
- Allocate more time for deployment and bug fixing.
- Update documentation during development.
- Record scope changes immediately.

---

# 3. 👥 Team Retrospective Highlights

During the retrospective meeting, each team member discussed:

- What worked well.
- The challenges faced.
- How the challenges were resolved.
- What could be improved in future projects.

---

## 🧑‍💻 Backend Perspective

The backend structure and REST APIs made the application features easier to organize.

Testing endpoints individually helped identify errors before integration.

However, frontend and backend integration should have started earlier instead of waiting until most backend features were completed.

### Backend Improvement

For future projects, the backend member should:

- Share endpoint formats early.
- Provide clear sample requests and responses.
- Test authentication and permissions before integration.
- Update API documentation after every major change.

---

## 🗄️ Database Perspective

The relational database structure successfully connected:

- Users.
- Restaurants.
- Meals.
- Subscriptions.
- Order items.
- Payments.
- Reviews.

The main challenge was keeping local and deployed data consistent.

### Database Improvement

For future projects, the database member should:

- Use one shared seed file.
- Document all database changes.
- Verify deployed data before frontend testing.

---

## 🎨 Frontend Perspective

React components helped organize the customer, restaurant, and admin interfaces.

The main difficulties involved:

- API integration.
- Image display.
- Environment variables.
- Authentication tokens.
- Routing after deployment.

### Frontend Improvement

For future projects, the frontend member should:

- Connect each completed page directly to the backend.
- Test loading, success, and error states.
- Use shared components to reduce repeated code.
- Test routes after deployment.
- Confirm that all images use valid public paths.

---

## 🧪 Authentication, Testing and Documentation Perspective

JWT authentication and Postman testing helped protect routes and validate APIs.

Manual testing also helped identify integration and deployment problems.

However, more automated tests and a structured bug-tracking process would improve project quality.

### Testing and Documentation Improvement

For future projects, the responsible member should:

- Prepare test cases early.
- Record bugs with clear reproduction steps.
- Classify bugs by severity.
- Repeat testing after fixes.
- Update documentation continuously.
- Confirm that documentation matches the final implementation.

---

## 🤝 Overall Team Feedback

### ✅ What Worked Well as a Team?

- Responsibilities were divided according to team members’ strengths.
- Members supported each other when technical problems occurred.
- Regular communication helped the team follow project progress.
- GitHub allowed the team to combine work from different members.
- The team remained focused on delivering a functional MVP.
- Members participated in testing and problem-solving.

### ⚠️ What Challenges Did We Face?

- Limited development time.
- Different levels of technical experience.
- Frontend and backend integration issues.
- Differences between local and deployed environments.
- Database and image-data inconsistencies.
- Deployment configuration issues.
- Payment redirection problems.
- Late changes to some project requirements.

### 🚀 How Can We Improve Collaboration?

- Hold shorter and more regular progress meetings.
- Report blockers immediately.
- Review pull requests before merging.
- Test integrated features continuously.
- Keep documentation updated during development.
- Use a shared checklist for final testing.
- Confirm task completion clearly before moving to the next stage.

---

# 4. 🏁 Conclusion

The Qooti team successfully developed and deployed a functional full-stack MVP for flexible healthy meal subscriptions.

The project demonstrated the team’s ability to use:

- Frontend development.
- Backend APIs.
- Database design.
- Authentication.
- Testing.
- GitHub collaboration.
- Technical documentation.
- Application deployment.

The main lesson was that successful software development does not depend only on writing code.

It also requires:

- Clear task distribution.
- Early integration.
- Shared and consistent data.
- Continuous testing.
- Accurate documentation.
- Good communication.
- Organized deployment planning.

The project provided the team with practical experience in building a real full-stack application and created a foundation for future improvements such as more restaurants, advanced subscriptions, improved payment integration, delivery tracking, and user recommendations.

---

## 👩‍💻 Team Roles

| Team Member     | Main Role                                      |
| --------------- | ---------------------------------------------- |
| Moudhi Almutlaq | Lead Backend                                   |
| Badryah Almalki | Lead Database                                  |
| Reem Alshehri   | Lead Frontend                                  |
| Yara Ibrahim    | Lead Authentication, Testing and Documentation |

---

<div align="center">

### 🥗 Qooti

**Healthy meals, more choices, one flexible subscription.**

</div>
