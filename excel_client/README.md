# Excel Client

This is the frontend client for the Excel Tagging and Analysis application, built with React, TypeScript, and Vite.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (which includes npm)

## Getting Started

### 1. Install Dependencies

In the `excel_client` directory, run the following command to install the necessary packages:

```bash
npm install
```

### 2. Run the Development Server

To start the development server and see the application in action, run:

```bash
npm run dev
```

The application will typically be available at `http://localhost:5173` (or the port specified in the terminal output).

### 3. Build for Production

To create a production-ready build of the application, run:

```bash
npm run build
```

The compiled files will be located in the `dist/` directory.

### 4. Preview the Production Build

You can preview the production build locally by running:

```bash
npm run preview
```

## Project Structure

- `src/components/`: Reusable UI components.
- `src/pages/`: Main application pages (e.g., Welcome, SheetInfo).
- `src/domain/`: Business logic, state management, and API service providers.
- `src/assets/`: Static assets like images and icons.

## Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds the project for production.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run preview`: Previews the production build locally.

