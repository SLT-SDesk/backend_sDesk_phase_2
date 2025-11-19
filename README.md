# Service Desk Backend API

A NestJS-based backend API for Service Desk management system.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Support for different user types (SLT Users, Technicians, Team Admins)
- **Incident Management**: Complete incident tracking and management
- **Location Management**: Regional and location-based organization
- **Team Management**: Team creation and administration
- **Categories**: Hierarchical category management for incidents

## Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT tokens
- **Language**: TypeScript
- **Testing**: Jest

## Getting Started

### Prerequisites

- Node.js (>=18.0.0)
- npm (>=8.0.0)
- PostgreSQL database

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sdesk-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the application**
   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run build
   npm run start:prod
   ```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=your_database_name

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Application Configuration
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Deployment

### Heroku Deployment

This application is ready for Heroku deployment with the following configurations:

#### Prerequisites

1. **Heroku CLI installed**
2. **Git repository initialized**
3. **Heroku account**

#### Deployment Steps

1. **Initialize Git (if not already done)**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

3. **Add PostgreSQL Database**
   ```bash
   heroku addons:create heroku-postgresql:essential-0
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=$(openssl rand -base64 32)
   heroku config:set JWT_EXPIRES_IN=24h
   heroku config:set FRONTEND_URL=https://your-frontend-app.herokuapp.com
   ```

5. **Deploy to Heroku**
   ```bash
   git push heroku main
   ```

6. **Open your app**
   ```bash
   heroku open
   ```

#### Important Notes for Heroku:

- **Database**: Heroku automatically sets `DATABASE_URL` environment variable
- **Port**: Heroku automatically sets `PORT` environment variable
- **Build Process**: Configured with `heroku-postbuild` script
- **Procfile**: Configured to run production build

### Environment Variables for Production

Set these on Heroku:

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secure-jwt-secret
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set FRONTEND_URL=https://your-frontend-app.herokuapp.com
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/microsoft` - Microsoft OAuth login

### Users
- `GET /sltusers` - Get all SLT users
- `POST /sltusers` - Create SLT user
- `PUT /sltusers/:id/role` - Update user role

### Incidents
- `GET /incident` - Get all incidents
- `POST /incident` - Create new incident
- `PUT /incident/:id` - Update incident
- `DELETE /incident/:id` - Delete incident

### Categories
- `GET /categories` - Get all categories
- `POST /categories` - Create category

### Teams
- `GET /team` - Get all teams
- `POST /team` - Create team

### Locations
- `GET /location` - Get all locations
- `POST /location` - Create location

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Scripts

- `npm run build` - Build the application
- `npm run start:dev` - Start in development mode
- `npm run start:prod` - Start in production mode
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## License

This project is licensed under the UNLICENSED License.
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
